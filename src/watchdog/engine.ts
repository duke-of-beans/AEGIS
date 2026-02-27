import { getLogger } from '../logger/index.js'
import { WatchdogEntry } from '../config/types.js'
import { WorkerIpc } from '../worker/ipc.js'

interface WatchdogState {
  isRunning: boolean
  lastSeen: Set<string>
  restartCounts: Map<string, number>
  backoffExpires: Map<string, number>
}

export class WatchdogEngine {
  private ipc: WorkerIpc | null = null
  private rules: WatchdogEntry[] = []
  private state: WatchdogState = {
    isRunning: false,
    lastSeen: new Set(),
    restartCounts: new Map(),
    backoffExpires: new Map(),
  }
  private pollInterval: NodeJS.Timeout | null = null
  private processRestartedCallback:
    | ((processName: string, attempt: number) => void)
    | null = null
  private logger = getLogger()
  private pollIntervalMs = 10000

  start(rules: WatchdogEntry[], ipc: WorkerIpc): void {
    if (this.state.isRunning) {
      this.logger.warn('Watchdog engine already running')
      return
    }

    this.rules = rules
    this.ipc = ipc
    this.state.isRunning = true
    this.state.lastSeen.clear()
    this.state.restartCounts.clear()
    this.state.backoffExpires.clear()

    this.logger.info('Watchdog engine started', { ruleCount: rules.length })

    void this.poll()
  }

  stop(): void {
    if (!this.state.isRunning) {
      return
    }

    this.state.isRunning = false

    if (this.pollInterval !== null) {
      clearTimeout(this.pollInterval)
      this.pollInterval = null
    }

    this.logger.info('Watchdog engine stopped')
  }

  updateRules(rules: WatchdogEntry[], ipc: WorkerIpc): void {
    this.rules = rules
    this.ipc = ipc
    this.logger.info('Watchdog rules updated', { ruleCount: rules.length })
  }

  onProcessRestarted(
    callback: (processName: string, attempt: number) => void
  ): void {
    this.processRestartedCallback = callback
  }

  private async poll(): Promise<void> {
    if (!this.state.isRunning || this.ipc === null) {
      return
    }

    try {
      const watchedProcesses = this.rules.map((r) => r.process)
      const response = await this.ipc.call('get_process_list', {
        process_names: watchedProcesses,
      })

      const runningProcesses = new Set<string>()
      if (Array.isArray(response.processes)) {
        for (const proc of response.processes) {
          if (typeof proc === 'object' && proc !== null) {
            const typedProc = proc as { name?: unknown }
            const name = typedProc.name
            if (typeof name === 'string') {
              runningProcesses.add(name.toLowerCase())
            }
          }
        }
      }

      for (const rule of this.rules) {
        const processLower = rule.process.toLowerCase()

        if (
          this.state.lastSeen.has(processLower) &&
          !runningProcesses.has(processLower)
        ) {
          if (rule.restart_on_crash) {
            await this.restartProcess(rule)
          }
          this.state.lastSeen.delete(processLower)
        } else if (runningProcesses.has(processLower)) {
          this.state.lastSeen.add(processLower)
        }
      }
    } catch (error) {
      this.logger.warn('Watchdog poll failed', { error })
    }

    this.pollInterval = setTimeout(() => {
      void this.poll()
    }, this.pollIntervalMs)
  }

  private async restartProcess(rule: WatchdogEntry): Promise<void> {
    const processLower = rule.process.toLowerCase()
    const count = (this.state.restartCounts.get(processLower) ?? 0) + 1

    if (count > rule.max_restarts) {
      this.logger.error('Process exceeded max restarts', {
        process: rule.process,
        maxRestarts: rule.max_restarts,
      })
      return
    }

    const backoffExpire = this.state.backoffExpires.get(processLower) ?? 0
    if (Date.now() < backoffExpire) {
      this.logger.debug('Process restart backoff active', {
        process: rule.process,
      })
      return
    }

    try {
      if (rule.pre_restart_script !== null && this.ipc !== null) {
        await this.ipc.call('run_script', { script: rule.pre_restart_script })
      }
    } catch {
      this.logger.warn('Pre-restart script failed', { process: rule.process })
    }

    try {
      if (this.ipc !== null) {
        await this.ipc.call('start_process', { process: rule.process })
      }
      this.logger.info('Process restarted', {
        process: rule.process,
        attempt: count,
      })
      this.state.restartCounts.set(processLower, count)

      if (this.processRestartedCallback !== null) {
        this.processRestartedCallback(rule.process, count)
      }
    } catch (error) {
      this.logger.error('Failed to restart process', {
        process: rule.process,
        error,
      })
      return
    }

    try {
      if (rule.post_restart_script !== null && this.ipc !== null) {
        await this.ipc.call('run_script', {
          script: rule.post_restart_script,
        })
      }
    } catch {
      this.logger.warn('Post-restart script failed', { process: rule.process })
    }

    const delay =
      rule.backoff === 'exponential'
        ? rule.restart_delay_sec * Math.pow(2, count - 1) * 1000
        : rule.restart_delay_sec * 1000

    this.state.backoffExpires.set(processLower, Date.now() + delay)
  }
}
