import { getLogger } from '../logger/index.js'
import {
  AegisConfig,
  LoadedProfile,
  RuntimeState,
} from '../config/types.js'
import { WorkerManager } from '../worker/manager.js'
import { ProfileRegistry } from './registry.js'
import { updateState } from '../config/state.js'
import { checkIsElevated } from '../system/elevation.js'

export class ProfileManager {
  private registry: ProfileRegistry
  private worker: WorkerManager
  private config: AegisConfig
  private currentState: RuntimeState
  private profileChangedCallback:
    | ((profile: LoadedProfile) => void)
    | null = null
  private logger = getLogger()

  constructor(deps: {
    registry: ProfileRegistry
    worker: WorkerManager
    config: AegisConfig
    state: RuntimeState
  }) {
    this.registry = deps.registry
    this.worker = deps.worker
    this.config = deps.config
    this.currentState = deps.state
  }

  async applyProfile(name: string): Promise<void> {
    const profile = this.registry.getProfile(name)
    if (profile === undefined) {
      throw new Error(`Profile not found: ${name}`)
    }

    const ipc = this.worker.ipc

    try {
      const previousProfile = this.currentState.active_profile

      // All IPC operations require a live worker. When worker is down,
      // we skip straight to state update + callbacks (graceful degradation).
      if (ipc !== null) {
        const isElevated = await checkIsElevated()
        if (!isElevated) {
          this.logger.warn(
            'Profile applied without elevation — privileged operations skipped',
            { profile: name }
          )
        }

        // ── on_deactivate script ──
        if (previousProfile !== '') {
          const prev = this.registry.getProfile(previousProfile)
          if (
            prev !== undefined &&
            prev.on_deactivate?.script !== null &&
            prev.on_deactivate?.script !== undefined
          ) {
            try {
              await ipc.call('run_script', { script: prev.on_deactivate.script })
            } catch {
              this.logger.warn('on_deactivate script failed', { profile: previousProfile })
            }
          }
        }

        if (isElevated) {
          // ── Remove QoS policies ──
          try { await ipc.call('remove_qos_policies', {}) }
          catch { this.logger.warn('Failed to remove QoS policies') }

          // ── Resume previously paused services ──
          for (const service of (this.currentState.active_profile !== ''
            ? this.registry.getProfile(this.currentState.active_profile)?.system.pause_services ?? []
            : [])) {
            try { await ipc.call('manage_service', { service, action: 'start' }) }
            catch { this.logger.warn('Failed to resume service', { service }) }
          }

          // ── Disable power throttling on previously throttled processes ──
          for (const processName of (this.currentState.active_profile !== ''
            ? this.registry.getProfile(this.currentState.active_profile)
                ?.throttled_processes?.map((p) => p.name) ?? []
            : [])) {
            try { await ipc.call('enable_power_throttling', { process: processName }) }
            catch { this.logger.warn('Failed to enable power throttling', { process: processName }) }
          }

          // ── Set power plan ──
          try { await ipc.call('set_power_plan', { plan: profile.power_plan }) }
          catch { this.logger.warn('Failed to set power plan', { plan: profile.power_plan }) }

          // ── Set throttled process priorities ──
          for (const proc of profile.throttled_processes) {
            try {
              await ipc.call('set_all_priorities', {
                process: proc.name, cpu_priority: proc.cpu_priority,
                io_priority: proc.io_priority, memory_priority: proc.memory_priority,
                cpu_affinity: proc.cpu_affinity,
              })
            } catch { this.logger.warn('Failed to set throttled process priority', { process: proc.name }) }
          }

          // ── Set elevated process priorities ──
          for (const proc of profile.elevated_processes) {
            try {
              await ipc.call('set_all_priorities', {
                process: proc.name, cpu_priority: proc.cpu_priority,
                io_priority: proc.io_priority, memory_priority: proc.memory_priority,
                cpu_affinity: proc.cpu_affinity,
              })
            } catch { this.logger.warn('Failed to set elevated process priority', { process: proc.name }) }
          }

          // ── Apply QoS policies ──
          for (const qos of profile.network_qos) {
            try { await ipc.call('set_qos_policy', { app: qos.app, priority: qos.priority, dscp: qos.dscp }) }
            catch { this.logger.warn('Failed to set QoS policy', { app: qos.app }) }
          }

          // ── Pause services ──
          for (const service of profile.system.pause_services) {
            try { await ipc.call('manage_service', { service, action: 'stop' }) }
            catch { this.logger.warn('Failed to pause service', { service }) }
          }

          // ── Memory preflight trim ──
          if (profile.memory.preflight_trim_on_activate) {
            try { await ipc.call('trim_working_set', { processes: profile.elevated_processes.map((p) => p.name) }) }
            catch { this.logger.warn('Failed to trim working sets') }
          }
        } // end isElevated

        // ── Flush temp files (worker-side, not elevation-gated) ──
        if (profile.system.flush_temp_on_activate) {
          try { await ipc.call('flush_temp_files', {}) }
          catch { this.logger.warn('Failed to flush temp files') }
        }

        // ── on_activate script ──
        if (
          profile.on_activate?.script !== null &&
          profile.on_activate?.script !== undefined
        ) {
          try { await ipc.call('run_script', { script: profile.on_activate.script }) }
          catch { this.logger.warn('on_activate script failed', { profile: name }) }
        }
      } else {
        this.logger.warn('Worker not ready — profile applied without resource control', { profile: name })
      } // end ipc !== null

      // ── Update state (always runs) ──
      updateState({
        active_profile: name,
        previous_profile: previousProfile,
        profile_history: [
          ...(this.currentState.profile_history ?? []),
          { profile: name, switched_at: new Date().toISOString() },
        ],
      })

      this.logger.info('Profile applied', { profile: name, workerAvailable: ipc !== null })

      // ── Profile changed callback (always fires) ──
      if (this.profileChangedCallback !== null) {
        this.profileChangedCallback(profile)
      }
    } catch (error) {
      this.logger.error('Failed to apply profile', { profile: name, error })
      throw error
    }
  }

  async switchProfile(name: string): Promise<void> {
    await this.applyProfile(name)
  }

  getActiveProfile(): LoadedProfile | null {
    const name = this.currentState.active_profile
    if (name === '') {
      return null
    }
    return this.registry.getProfile(name) ?? null
  }

  onProfileChanged(callback: (profile: LoadedProfile) => void): void {
    this.profileChangedCallback = callback
  }

  updateState(newState: RuntimeState): void {
    this.currentState = newState
  }
}
