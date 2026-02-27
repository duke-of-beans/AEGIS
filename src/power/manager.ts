import { getLogger } from '../logger/index.js'
import { WorkerIpc } from '../worker/ipc.js'

export class PowerManager {
  private ipc: WorkerIpc
  private logger = getLogger()

  constructor(ipc: WorkerIpc) {
    this.ipc = ipc
  }

  async setPlan(plan: string): Promise<void> {
    try {
      await this.ipc.call('set_power_plan', { plan })
      this.logger.info('Power plan set', { plan })
    } catch (error) {
      this.logger.error('Failed to set power plan', { plan, error })
      throw error
    }
  }

  async getActivePlan(): Promise<{ guid: string; name: string }> {
    try {
      const result = await this.ipc.call('get_power_plan', {})
      const guid = result.guid
      const name = result.name

      if (typeof guid === 'string' && typeof name === 'string') {
        return { guid, name }
      }

      throw new Error('Invalid power plan response')
    } catch (error) {
      this.logger.error('Failed to get active power plan', { error })
      throw error
    }
  }
}
