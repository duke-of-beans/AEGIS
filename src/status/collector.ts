import { getLogger } from '../logger/index.js'
import { SystemSnapshot, ProcessStats } from '../config/types.js'
import { WorkerIpc } from '../worker/ipc.js'

export class StatsCollector {
  private ipc: WorkerIpc
  private pollInterval: NodeJS.Timeout | null = null
  private latestStats: SystemSnapshot | null = null
  private updateCallback: ((snapshot: SystemSnapshot) => void) | null = null
  private logger = getLogger()
  private pollIntervalMs = 2000
  private isRunning = false

  constructor(ipc: WorkerIpc, _activeProfile: string) {
    this.ipc = ipc
  }

  start(): void {
    if (this.isRunning) {
      return
    }

    this.isRunning = true
    this.logger.info('Stats collector started')
    void this.poll()
  }

  stop(): void {
    if (!this.isRunning) {
      return
    }

    this.isRunning = false

    if (this.pollInterval !== null) {
      clearTimeout(this.pollInterval)
      this.pollInterval = null
    }

    this.logger.info('Stats collector stopped')
  }

  getLatestStats(): SystemSnapshot {
    return (
      this.latestStats ?? {
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        active_profile: '',
        active_profile_color: '',
        cpu_percent: 0,
        memory_percent: 0,
        memory_mb_used: 0,
        memory_mb_available: 0,
        power_plan: { guid: '', name: '' },
        processes: [],
        timer: {
          active: false,
          target_profile: null,
          return_profile: null,
          started_at: null,
          duration_min: null,
          expires_at: null,
        },
        worker_status: 'online',
      }
    )
  }

  onStatsUpdated(callback: (snapshot: SystemSnapshot) => void): void {
    this.updateCallback = callback
  }

  private async poll(): Promise<void> {
    if (!this.isRunning) {
      return
    }

    try {
      const response = await this.ipc.call('get_system_stats', {})

      const processes: ProcessStats[] = []
      if (Array.isArray(response.processes)) {
        for (const proc of response.processes) {
          if (typeof proc === 'object' && proc !== null) {
            const typedProc = proc as {
              name?: unknown
              pid?: unknown
              cpu_percent?: unknown
              memory_mb?: unknown
              priority?: unknown
              status?: unknown
            }
            processes.push({
              name: String(typedProc.name ?? ''),
              pid: Number(typedProc.pid ?? 0),
              cpu_percent: Number(typedProc.cpu_percent ?? 0),
              memory_mb: Number(typedProc.memory_mb ?? 0),
              priority: String(typedProc.priority ?? ''),
              status: String(typedProc.status ?? ''),
            })
          }
        }
      }

      const powerPlan = (response['power_plan'] ?? {}) as {
        guid?: unknown
        name?: unknown
      }
      const workerTimer = (response['timer'] ?? {}) as {
        active?: unknown
        target_profile?: unknown
        return_profile?: unknown
        started_at?: unknown
        duration_min?: unknown
        expires_at?: unknown
      }

      this.latestStats = {
        timestamp: new Date().toISOString(),
        version: String(response['version'] ?? '2.0.0'),
        active_profile: String(response['active_profile'] ?? ''),
        active_profile_color: String(response['active_profile_color'] ?? ''),
        cpu_percent: Number(response['cpu_percent'] ?? 0),
        memory_percent: Number(response['memory_percent'] ?? 0),
        memory_mb_used: Number(response['memory_mb_used'] ?? 0),
        memory_mb_available: Number(response['memory_mb_available'] ?? 0),
        power_plan: {
          guid: String(powerPlan.guid ?? ''),
          name: String(powerPlan.name ?? ''),
        },
        processes,
        timer: {
          active: Boolean(workerTimer.active ?? false),
          target_profile:
            (workerTimer.target_profile as string | null | undefined) ?? null,
          return_profile:
            (workerTimer.return_profile as string | null | undefined) ?? null,
          started_at:
            (workerTimer.started_at as string | null | undefined) ?? null,
          duration_min:
            (workerTimer.duration_min as number | null | undefined) ?? null,
          expires_at:
            (workerTimer.expires_at as string | null | undefined) ?? null,
        },
        worker_status: 'online',
      }

      if (this.updateCallback !== null) {
        this.updateCallback(this.latestStats)
      }
    } catch (error) {
      this.logger.warn('Failed to collect stats', { error })
    }

    this.pollInterval = setTimeout(() => {
      void this.poll()
    }, this.pollIntervalMs)
  }
}
