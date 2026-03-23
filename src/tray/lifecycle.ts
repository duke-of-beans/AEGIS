import { existsSync } from 'fs'
import { spawn } from 'child_process'
import { join } from 'path'
import { getLogger, initLogger } from '../logger/index.js'
import { loadConfig } from '../config/loader.js'
import {
  loadState,
  startAutoSave,
  stopAutoSave,
  updateState,
} from '../config/state.js'
import {
  acquireSingleInstance,
  releaseSingleInstance,
  watchForSignal,
  sendSignalToRunningInstance,
} from '../singleton.js'
import { WorkerManager } from '../worker/manager.js'
import { ProfileRegistry } from '../profiles/registry.js'
import { ProfileManager } from '../profiles/manager.js'
import { ProfileTimer } from '../profiles/timer.js'
import { WatchdogEngine } from '../watchdog/engine.js'
import { AutoDetectEngine } from '../watchdog/detector.js'
import { StatusServer } from '../status/server.js'
import { StatsCollector } from '../status/collector.js'

import { McpServer } from '../mcp/server.js'
import { KernlClient } from '../mcp/kernl-client.js'
import { TrayManager } from './index.js'
import { notify } from './notifications.js'
import { MemoryManager } from '../memory/manager.js'
import { TabManager, launchBrave } from '../browser/tab-manager.js'
import { checkIsElevated } from '../system/elevation.js'

let globalWorkerManager: WorkerManager | null = null
let globalProfileManager: ProfileManager | null = null
let globalTimer: ProfileTimer | null = null
let globalStatusServer: StatusServer | null = null
let globalTrayManager: TrayManager | null = null
let globalWatchdogEngine: WatchdogEngine | null = null
let globalAutoDetectEngine: AutoDetectEngine | null = null
let globalMemoryManager: MemoryManager | null = null
let globalTabManager: TabManager | null = null
let globalStatsCollector: StatsCollector | null = null

export async function startup(configPath?: string): Promise<void> {
  if (!acquireSingleInstance()) {
    sendSignalToRunningInstance()
    process.exit(0)
  }

  let logger = getLogger()

  try {
    const cliArgs = process.argv.slice(2)

    if (cliArgs.includes('--version')) {
      console.log('AEGIS 2.0.0')
      process.exit(0)
    }

    const isMcpMode = cliArgs.includes('--mcp')

    let resolvedConfigPath = configPath
    if (!resolvedConfigPath) {
      const appdata = process.env['APPDATA']
      if (appdata === undefined) {
        throw new Error('APPDATA environment variable not set')
      }
      resolvedConfigPath = join(appdata, 'AEGIS', 'aegis-config.yaml')
    }

    if (cliArgs.includes('--config')) {
      const configIndex = cliArgs.indexOf('--config')
      if (configIndex + 1 < cliArgs.length) {
        resolvedConfigPath = cliArgs[configIndex + 1] ?? resolvedConfigPath
      }
    }

    if (!existsSync(resolvedConfigPath)) {
      console.error(`Config file not found: ${resolvedConfigPath}`)
      process.exit(1)
    }

    const config = loadConfig(resolvedConfigPath)

    initLogger(config.logging.level, config.logging.log_dir)
    logger = getLogger()

    logger.info('AEGIS starting', { version: '2.0.0' })

    const profilesDir = config.profiles_dir
    if (!existsSync(profilesDir)) {
      throw new Error(`Profiles directory not found: ${profilesDir}`)
    }

    const registry = new ProfileRegistry(profilesDir)
    await registry.load()
    registry.startWatcher()

    const appDataPath = process.env['APPDATA']
    if (appDataPath === undefined) {
      throw new Error('APPDATA environment variable not set')
    }

    const stateFilePath = join(appDataPath, 'AEGIS', 'state.json')
    const state = loadState(stateFilePath)
    startAutoSave(stateFilePath)

    globalStatusServer = new StatusServer(config.status_window.port)
    await globalStatusServer.start()

    globalTimer = new ProfileTimer()
    globalTimer.fromState(state.timer)

    globalWorkerManager = new WorkerManager()
    await globalWorkerManager.start()

    if (globalWorkerManager.ipc === null) {
      throw new Error('Worker IPC not available')
    }

    const ipc = globalWorkerManager.ipc

    // Start MemoryManager with the default/active profile's config
    const startupProfile = registry.getProfile(
      state.active_profile || config.default_profile
    )
    if (startupProfile !== undefined) {
      globalMemoryManager = new MemoryManager()
      globalMemoryManager.start(
        startupProfile.memory,
        startupProfile.system,
        startupProfile.elevated_processes.map((p) => p.name),
        ipc
      )
    }

    // Start TabManager if browser_manager is enabled
    if (config.browser_manager.enabled) {
      globalTabManager = new TabManager(config.browser_manager)
      globalTabManager.start()
      if (globalMemoryManager !== null) {
        globalMemoryManager.setTabManager(globalTabManager)
      }
    }

    // Start StatsCollector — feeds the status server with live snapshots
    globalStatsCollector = new StatsCollector(ipc, state.active_profile || config.default_profile)
    globalStatsCollector.setTabManager(globalTabManager, config.browser_manager.enabled)
    globalStatsCollector.onStatsUpdated((snapshot) => {
      if (globalStatusServer !== null) {
        globalStatusServer.updateSnapshot(snapshot)
      }
    })
    globalStatsCollector.start()

    globalProfileManager = new ProfileManager({
      registry,
      worker: globalWorkerManager,
      config,
      state,
    })

    globalWatchdogEngine = new WatchdogEngine()
    globalAutoDetectEngine = new AutoDetectEngine()

    if (state.active_profile !== '' && state.active_profile !== undefined) {
      try {
        await globalProfileManager.applyProfile(state.active_profile)
      } catch (error) {
        logger.error('Failed to apply default profile', { error })
        const defaultProfile = config.default_profile
        if (defaultProfile !== state.active_profile) {
          await globalProfileManager.applyProfile(defaultProfile)
        }
      }
    } else {
      await globalProfileManager.applyProfile(config.default_profile)
    }

    if (globalWatchdogEngine !== null) {
      const activeProfile = registry.getProfile(
        state.active_profile || config.default_profile
      )
      if (activeProfile !== undefined) {
        globalWatchdogEngine.start(activeProfile.watchdog, ipc)
      }
    }

    if (config.auto_detect.enabled && globalAutoDetectEngine !== null) {
      const profiles = registry.getAllProfiles()
      globalAutoDetectEngine.start(profiles, config.auto_detect, ipc)
    }

    globalTrayManager = new TrayManager({
      onProfileSwitch: async (profileName: string): Promise<void> => {
        if (globalProfileManager !== null) {
          await globalProfileManager.switchProfile(profileName)
          globalTimer?.cancel()
        }
        // Apply per-profile browser_suspension override if defined
        const switchedProfile = registry.getProfile(profileName)
        if (
          switchedProfile?.browser_suspension !== undefined &&
          globalTabManager !== null
        ) {
          globalTabManager.updateSuspensionConfig(switchedProfile.browser_suspension)
        }
      },
      onTimerSet: (target: string, returnProf: string, durationMin: number): Promise<void> => {
        globalTimer?.start(target, returnProf, durationMin)
        return Promise.resolve()
      },
      onTimerCancel: (): Promise<void> => {
        globalTimer?.cancel()
        return Promise.resolve()
      },
      onStatusWindowOpen: (): Promise<void> => {
        const port = config.status_window.port
        const url = `http://localhost:${port}/status`
        if (config.status_window.auto_open_on_launch) {
          spawn('cmd', [
            '/c',
            `start ${url}`,
          ])
        }
        return Promise.resolve()
      },
      onSettingsOpen: (): Promise<void> => {
        logger.info('Settings requested')
        return Promise.resolve()
      },
      onQuit: async (): Promise<void> => {
        await shutdown()
        process.exit(0)
      },
      onSuspendTabs: async (): Promise<void> => {
        if (globalTabManager !== null) {
          await globalTabManager.suspendAll()
        }
      },
      onRestoreTabs: async (): Promise<void> => {
        if (globalTabManager !== null) {
          await globalTabManager.restoreAll()
        }
      },
      onLaunchBrave: (): void => {
        const cdpPort = config.browser_manager.tab_suspension.cdp_port
        if (globalTabManager !== null && globalTabManager.isCdpConnected()) {
          notify({ title: 'AEGIS', message: 'Brave already running (CDP active)' })
          return
        }
        launchBrave(cdpPort)
      },
    })

    const iconPath = join(__dirname, '../../assets/icon.ico')
    if (existsSync(iconPath)) {
      globalTrayManager.init(
        iconPath,
        registry.getAllProfiles(),
        state.active_profile,
        config.profile_order,
        0
      )
    }

    if (isMcpMode) {
      const mcpServer = new McpServer(
        globalStatusServer,
        globalProfileManager,
        globalTimer
      )
      mcpServer.startStdio()
    }

    if (config.kernl.enabled) {
      const kernlClient = new KernlClient(config.kernl)
      kernlClient.start()
    }

    globalTimer.onExpired((returnProfile: string): void => {
      void (async (): Promise<void> => {
        if (globalProfileManager !== null) {
          try {
            await globalProfileManager.switchProfile(returnProfile)
            notify({
              title: 'Timer Expired',
              message: `Switched back to ${returnProfile}`,
            })
          } catch (error) {
            logger.error('Timer expiry profile switch failed', { error })
          }
        }
      })()
    })

    watchForSignal((): void => {
      if (globalStatusServer !== null && config.status_window.auto_open_on_launch) {
        const port = config.status_window.port
        const url = `http://localhost:${port}`
        spawn('cmd', [
          '/c',
          `start ${url}`,
        ])
      }
    })

    // Check elevation once after startup — log + toast if not elevated
    const isElevated = await checkIsElevated()
    if (!isElevated) {
      logger.warn('AEGIS running without elevation — resource control disabled')
      notify({
        title: 'AEGIS — No Elevation',
        message: 'Process priority and service control are disabled. Restart as administrator to enable full functionality.',
      })
    }

    logger.info('AEGIS started successfully', {
      profile: state.active_profile,
      elevated: isElevated,
    })
  } catch (error) {
    const logger = getLogger()
    logger.error('Failed to start AEGIS', { error })
    console.error('Fatal error:', error)
    process.exit(1)
  }
}

export async function shutdown(): Promise<void> {
  const logger = getLogger()
  logger.info('AEGIS shutting down')

  if (globalStatsCollector !== null) {
    globalStatsCollector.stop()
    globalStatsCollector = null
  }

  if (globalTabManager !== null) {
    globalTabManager.stop()
  }

  if (globalMemoryManager !== null) {
    globalMemoryManager.stop()
  }

  if (globalAutoDetectEngine !== null) {
    globalAutoDetectEngine.stop()
  }

  if (globalWatchdogEngine !== null) {
    globalWatchdogEngine.stop()
  }

  if (globalTimer !== null) {
    updateState({ timer: globalTimer.toState() })
    stopAutoSave()
  }

  if (globalProfileManager !== null) {
    const activeProfile = globalProfileManager.getActiveProfile()
    if (activeProfile !== null) {
      logger.info('Active profile at shutdown', { profile: activeProfile.name })
    }
  }

  if (globalStatusServer !== null) {
    await globalStatusServer.stop()
  }

  if (globalWorkerManager !== null) {
    await globalWorkerManager.stop()
  }

  if (globalTrayManager !== null) {
    globalTrayManager.destroy()
  }

  releaseSingleInstance()
  logger.info('AEGIS shutdown complete')
}
