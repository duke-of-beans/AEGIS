import { getLogger } from '../logger/index.js'
import { MemoryConfig, SystemConfig } from '../config/types.js'
import { WorkerIpc } from '../worker/ipc.js'
import { TabManager } from '../browser/tab-manager.js'

export class MemoryManager {
  private config: MemoryConfig | null = null
  private systemConfig: SystemConfig | null = null
  private ipc: WorkerIpc | null = null
  private elevatedProcesses: string[] = []
  private trimInterval: NodeJS.Timeout | null = null
  private purgeInterval: NodeJS.Timeout | null = null
  private pressureInterval: NodeJS.Timeout | null = null
  private tabManager: TabManager | null = null
  private pressureActive = false
  private logger = getLogger()

  setTabManager(tm: TabManager): void {
    this.tabManager = tm
  }

  start(
    config: MemoryConfig,
    systemConfig: SystemConfig,
    elevatedProcesses: string[],
    ipc: WorkerIpc
  ): void {
    this.config = config
    this.systemConfig = systemConfig
    this.ipc = ipc
    this.elevatedProcesses = elevatedProcesses

    if (config.trim_background_working_sets && config.trim_interval_min > 0) {
      this.trimInterval = setInterval(() => {
        void this.trimNow(elevatedProcesses)
        void this.checkMemoryPressure()
      }, config.trim_interval_min * 60 * 1000)
    } else {
      this.pressureInterval = setInterval(() => {
        void this.checkMemoryPressure()
      }, 60 * 1000)
    }

    if (
      systemConfig.purge_standby_memory &&
      systemConfig.standby_purge_interval_min > 0
    ) {
      this.purgeInterval = setInterval(() => {
        void this.purgeStandbyNow()
      }, systemConfig.standby_purge_interval_min * 60 * 1000)
    }

    this.logger.info('Memory manager started', {
      trimEnabled: config.trim_background_working_sets,
      purgeEnabled: systemConfig.purge_standby_memory,
    })
  }

  stop(): void {
    if (this.trimInterval !== null) {
      clearInterval(this.trimInterval)
      this.trimInterval = null
    }

    if (this.purgeInterval !== null) {
      clearInterval(this.purgeInterval)
      this.purgeInterval = null
    }

    if (this.pressureInterval !== null) {
      clearInterval(this.pressureInterval)
      this.pressureInterval = null
    }

    this.logger.info('Memory manager stopped')
  }

  async trimNow(processNames: string[]): Promise<void> {
    if (this.ipc === null) {
      return
    }

    try {
      await this.ipc.call('trim_working_set', {
        processes: processNames,
      })
      this.logger.debug('Trimmed working sets', {
        processCount: processNames.length,
      })
    } catch (error) {
      this.logger.warn('Failed to trim working sets', { error })
    }
  }

  async purgeStandbyNow(): Promise<void> {
    if (this.ipc === null) {
      return
    }

    try {
      await this.ipc.call('purge_standby_memory', {})
      this.logger.debug('Purged standby memory')
    } catch (error) {
      this.logger.warn('Failed to purge standby memory', { error })
    }
  }

  private async checkMemoryPressure(): Promise<void> {
    if (this.tabManager === null || this.config === null || this.ipc === null) {
      return
    }

    try {
      const result = await this.ipc.call('get_memory_stats', {})
      const availableMb = result['memory_mb_available']
      if (typeof availableMb !== 'number') return

      const threshold = this.config.low_memory_threshold_mb
      const nowUnderPressure = availableMb < threshold

      if (nowUnderPressure !== this.pressureActive) {
        this.pressureActive = nowUnderPressure
        this.tabManager.notifyMemoryPressure(this.pressureActive)
        this.logger.info('Memory pressure state changed', {
          pressureActive: this.pressureActive,
          availableMb,
          threshold,
        })
      }
    } catch (error) {
      this.logger.warn('checkMemoryPressure: stats fetch failed', { error })
    }
  }

  update(
    config: MemoryConfig,
    systemConfig: SystemConfig,
    elevatedProcesses: string[]
  ): void {
    this.stop()
    if (this.ipc !== null) {
      this.start(config, systemConfig, elevatedProcesses, this.ipc)
    }
  }
}
