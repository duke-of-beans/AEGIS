import { getLogger } from '../logger/index.js'
import {
  LoadedProfile,
  AutoDetectConfig,
} from '../config/types.js'
import { WorkerIpc } from '../worker/ipc.js'

interface DetectionState {
  isRunning: boolean
  isPaused: boolean
  pauseReason: string | null
  lastDetectionTime: number
  lastSuggestedProfile: string | null
  cooldownUntil: number
  antiFlappingSwitches: number
  antiFlappingWindowStart: number
  manualOverrideCooldownUntil: number
}

export class AutoDetectEngine {
  private profiles: LoadedProfile[] = []
  private config: AutoDetectConfig | null = null
  private ipc: WorkerIpc | null = null
  private state: DetectionState = {
    isRunning: false,
    isPaused: false,
    pauseReason: null,
    lastDetectionTime: 0,
    lastSuggestedProfile: null,
    cooldownUntil: 0,
    antiFlappingSwitches: 0,
    antiFlappingWindowStart: 0,
    manualOverrideCooldownUntil: 0,
  }
  private pollInterval: NodeJS.Timeout | null = null
  private suggestCallback:
    | ((profileName: string, triggerProcesses: string[]) => void)
    | null = null
  private autoSwitchCallback:
    | ((profileName: string) => void)
    | null = null
  private logger = getLogger()
  private pollIntervalMs = 5000

  start(
    profiles: LoadedProfile[],
    config: AutoDetectConfig,
    ipc: WorkerIpc
  ): void {
    if (this.state.isRunning) {
      this.logger.warn('AutoDetect engine already running')
      return
    }

    this.profiles = profiles
    this.config = config
    this.ipc = ipc
    this.state.isRunning = true
    this.state.antiFlappingWindowStart = Date.now()

    this.logger.info('AutoDetect engine started', { mode: config.mode })
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

    this.logger.info('AutoDetect engine stopped')
  }

  pause(reason: string): void {
    this.state.isPaused = true
    this.state.pauseReason = reason
    this.logger.info('AutoDetect paused', { reason })
  }

  resume(): void {
    this.state.isPaused = false
    this.state.pauseReason = null
    this.logger.info('AutoDetect resumed')
  }

  updateProfiles(profiles: LoadedProfile[]): void {
    this.profiles = profiles
    this.logger.debug('AutoDetect profiles updated', {
      profileCount: profiles.length,
    })
  }

  setManualOverrideCooldown(minutes: number): void {
    this.state.manualOverrideCooldownUntil = Date.now() + minutes * 60 * 1000
  }

  onSuggest(
    callback: (profileName: string, triggerProcesses: string[]) => void
  ): void {
    this.suggestCallback = callback
  }

  onAutoSwitch(callback: (profileName: string) => void): void {
    this.autoSwitchCallback = callback
  }

  private async poll(): Promise<void> {
    if (!this.state.isRunning || this.config === null || this.ipc === null) {
      return
    }

    if (this.state.isPaused) {
      this.scheduleNextPoll()
      return
    }

    if (Date.now() < this.state.cooldownUntil) {
      this.scheduleNextPoll()
      return
    }

    try {
      const allTriggerProcesses = new Set<string>()
      for (const profile of this.profiles) {
        if (profile.auto_detect?.triggers !== undefined) {
          for (const trigger of profile.auto_detect.triggers) {
            allTriggerProcesses.add(trigger.process)
          }
        }
      }

      const response = await this.ipc.call('get_process_list', {
        process_names: Array.from(allTriggerProcesses),
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

      for (const profile of this.profiles) {
        if (
          profile.auto_detect === undefined ||
          profile.auto_detect.triggers === undefined
        ) {
          continue
        }

        const matchedTriggers: string[] = []
        for (const trigger of profile.auto_detect.triggers) {
          if (runningProcesses.has(trigger.process.toLowerCase())) {
            matchedTriggers.push(trigger.process)
          }
        }

        const requireAll = profile.auto_detect.require_all ?? false
        const triggersMatch = requireAll
          ? matchedTriggers.length === profile.auto_detect.triggers.length
          : matchedTriggers.length > 0

        if (triggersMatch) {
          this.state.lastDetectionTime = Date.now()
          this.state.lastSuggestedProfile = profile.name

          const debounceUntil =
            this.state.lastDetectionTime + this.config.debounce_sec * 1000

          if (this.config.mode === 'auto') {
            if (
              Date.now() > this.state.manualOverrideCooldownUntil &&
              this.canAutoSwitch()
            ) {
              if (this.autoSwitchCallback !== null) {
                this.autoSwitchCallback(profile.name)
              }
              this.state.cooldownUntil =
                debounceUntil + this.config.cooldown_min * 60 * 1000
              this.state.antiFlappingSwitches += 1

              this.logger.info('AutoDetect auto-switched', {
                profile: profile.name,
                triggers: matchedTriggers,
              })
            }
          } else if (this.config.mode === 'suggest') {
            if (this.suggestCallback !== null) {
              this.suggestCallback(profile.name, matchedTriggers)
            }
            this.state.cooldownUntil = debounceUntil
            this.logger.info('AutoDetect suggested', {
              profile: profile.name,
              triggers: matchedTriggers,
            })
          }

          this.scheduleNextPoll()
          return
        }
      }

      this.state.lastSuggestedProfile = null
    } catch (error) {
      this.logger.warn('AutoDetect poll failed', { error })
    }

    this.scheduleNextPoll()
  }

  private canAutoSwitch(): boolean {
    if (this.config === null) return false

    const now = Date.now()
    const windowStart = this.state.antiFlappingWindowStart
    const windowDuration = this.config.anti_flap_window_min * 60 * 1000

    if (now - windowStart > windowDuration) {
      this.state.antiFlappingWindowStart = now
      this.state.antiFlappingSwitches = 0
    }

    return (
      this.state.antiFlappingSwitches <
      this.config.anti_flap_max_switches
    )
  }

  private scheduleNextPoll(): void {
    this.pollInterval = setTimeout(() => {
      void this.poll()
    }, this.pollIntervalMs)
  }
}
