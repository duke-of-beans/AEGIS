import { getLogger } from '../logger/index.js'
import { WorkerIpc } from '../worker/ipc.js'

export class SystemOptimizer {
  private ipc: WorkerIpc
  private logger = getLogger()

  constructor(ipc: WorkerIpc) {
    this.ipc = ipc
  }

  async pauseServices(serviceNames: string[]): Promise<void> {
    for (const service of serviceNames) {
      try {
        await this.ipc.call('manage_service', {
          service,
          action: 'stop',
        })
      } catch (error) {
        this.logger.warn('Failed to pause service', { service, error })
      }
    }
  }

  async resumeServices(serviceNames: string[]): Promise<void> {
    for (const service of serviceNames) {
      try {
        await this.ipc.call('manage_service', {
          service,
          action: 'start',
        })
      } catch (error) {
        this.logger.warn('Failed to resume service', { service, error })
      }
    }
  }

  async flushTemp(): Promise<void> {
    try {
      await this.ipc.call('flush_temp_files', {})
      this.logger.info('Flushed temp files')
    } catch (error) {
      this.logger.warn('Failed to flush temp files', { error })
    }
  }

  async disablePowerThrottling(processNames: string[]): Promise<void> {
    for (const process of processNames) {
      try {
        await this.ipc.call('disable_power_throttling', {
          process,
        })
      } catch (error) {
        this.logger.warn('Failed to disable power throttling', {
          process,
          error,
        })
      }
    }
  }

  async enablePowerThrottling(processNames: string[]): Promise<void> {
    for (const process of processNames) {
      try {
        await this.ipc.call('enable_power_throttling', {
          process,
        })
      } catch (error) {
        this.logger.warn('Failed to enable power throttling', {
          process,
          error,
        })
      }
    }
  }
}
