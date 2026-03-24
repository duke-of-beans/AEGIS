import { existsSync } from 'fs'
import { spawn } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
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
import { MonitorCollector } from '../status/monitor-collector.js'

import { McpServer } from '../mcp/server.js'
import { KernlClient } from '../mcp/kernl-client.js'
import { TrayManager } from './index.js'
import { notify } from './notifications.js'
import { MemoryManager } from '../memory/manager.js'
import { TabManager, launchBrave } from '../browser/tab-manager.js'
import { checkIsElevated } from '../system/elevation.js'
import { initCatalog } from '../catalog/manager.js'
import { ContextEngine } from '../context/engine.js'
import { PolicyManager } from '../context/policies.js'
import { initBaseline } from '../sniper/baseline.js'
import { SniperEngine } from '../sniper/engine.js'
import { initLearningStore } from '../learning/store.js'
import { CognitiveLoadEngine } from '../learning/load.js'

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
let globalMonitorCollector: MonitorCollector | null = null
let globalContextEngine: ContextEngine | null = null
let globalPolicyManager: PolicyManager | null = null
let globalSniperEngine: SniperEngine | null = null
let globalLearningStore: ReturnType<typeof initLearningStore> | null = null
let globalLoadEngine: CognitiveLoadEngine | null = null

export async function startup(configPath?: string): Promise<void> {
  // ESM-compatible __dirname shim
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = dirname(__filename)

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
      const cwdConfig = join(process.cwd(), 'aegis-config.yaml')
      if (existsSync(cwdConfig)) {
        resolvedConfigPath = cwdConfig
      } else {
        const appdata = process.env['APPDATA']
        if (appdata === undefined) {
          throw new Error('APPDATA environment variable not set')
        }
        resolvedConfigPath = join(appdata, 'AEGIS', 'aegis-config.yaml')
      }
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

    const appDataPath = process.env['APPDATA'] ?? join(process.cwd(), 'data')

    const stateFilePath = join(appDataPath, 'AEGIS', 'state.json')
    const state = loadState(stateFilePath)
    startAutoSave(stateFilePath)

    globalStatusServer = new StatusServer(config.status_window.port)
    await globalStatusServer.start()

    // Initialize process catalog — prerequisite for all v3 intelligence
    const catalog = initCatalog(appDataPath)
    catalog.seedIfEmpty()

    // Wire catalog identification request → persist to pending file
    globalStatusServer.onIdentificationRequest(async (req): Promise<void> => {
      catalog.requestIdentification(req.name)
    })

    // Wire catalog resolve → update catalog db
    globalStatusServer.onCatalogResolve(async (req): Promise<void> => {
      catalog.resolveProcess(req.name, req)
    })

    // Wire feedback → learning store
    globalStatusServer.onFeedback(async (req): Promise<void> => {
      if (globalLearningStore !== null) {
        const signal = req.signal as import('../learning/store.js').FeedbackSignal
        const intensity = req.intensity as import('../learning/store.js').FeedbackIntensity
        globalLearningStore.recordExplicitFeedback(req.action_id, signal, intensity)
      }
    })

    globalTimer = new ProfileTimer()
    globalTimer.fromState(state.timer)

    globalWorkerManager = new WorkerManager()
    let ipc: import('../worker/ipc.js').WorkerIpc | null = null
    try {
      await globalWorkerManager.start()
      ipc = globalWorkerManager.ipc
    } catch (workerErr) {
      logger.warn('Worker failed to start — priority/memory ops unavailable', { error: String(workerErr) })
      await globalWorkerManager.stop()
    }

    // Start MemoryManager with the default/active profile's config
    const startupProfile = registry.getProfile(
      state.active_profile || config.default_profile
    )
    if (startupProfile !== undefined && ipc !== null) {
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

    // Wire per-tab actions from status window to TabManager
    if (globalStatusServer !== null) {
      globalStatusServer.onTabSuspend(async (tabId: string): Promise<void> => {
        if (globalTabManager !== null) {
          await globalTabManager.suspendTab(tabId)
        }
      })
      globalStatusServer.onTabRestore(async (tabId: string): Promise<void> => {
        if (globalTabManager !== null) {
          await globalTabManager.restoreTab(tabId)
        }
      })
    }

    // Start StatsCollector — feeds the status server with live snapshots
    // ipc may be null if worker unavailable; StatsCollector and MonitorCollector handle null internally
    globalStatsCollector = new StatsCollector(ipc, state.active_profile || config.default_profile)
    globalStatsCollector.setTabManager(globalTabManager, config.browser_manager.enabled)
    globalStatsCollector.setCatalog(catalog)
    globalStatsCollector.onStatsUpdated((snapshot) => {
      if (globalStatusServer !== null) {
        globalStatusServer.updateSnapshot(snapshot)
      }
    })
    globalStatsCollector.start()

    // Start MonitorCollector — extended hardware metrics on slower cadences
    globalMonitorCollector = new MonitorCollector(ipc)
    globalMonitorCollector.start()
    globalStatsCollector.setMonitorCollector(globalMonitorCollector)

    // Start ContextEngine — foreground window tracking, context detection
    globalContextEngine = new ContextEngine()
    globalPolicyManager = new PolicyManager()

    globalContextEngine.on('context_changed', ({ to }: { from: string; to: import('../context/engine.js').ContextName; confidence: number }) => {
      if (globalPolicyManager !== null) {
        globalPolicyManager.applyContextOverlays(to)
      }
    })

    globalContextEngine.start()

    // Wire context state into collector now that engine is live
    globalStatsCollector.setContextEngine(globalContextEngine!, globalPolicyManager!)

    // Start SniperEngine — baseline + deviation detection + graduated actions
    const baseline = initBaseline(appDataPath)
    baseline.start()
    globalSniperEngine = new SniperEngine(baseline, catalog)

    // Wire context changes into sniper
    globalContextEngine.on('context_changed', ({ to }: { to: import('../context/engine.js').ContextName }) => {
      globalSniperEngine?.setContext(to)
    })

    // Wire action callbacks through worker IPC
    globalSniperEngine.onThrottle(async (_name: string, pid: number): Promise<void> => {
      if (ipc === null) { logger.warn('Sniper throttle skipped — worker unavailable', { pid }); return }
      try { await ipc.call('throttle_process_pid', { pid }) }
      catch (e) { logger.warn('Sniper throttle failed', { pid, error: e }) }
    })
    globalSniperEngine.onSuspend(async (_name: string, pid: number): Promise<void> => {
      if (ipc === null) { logger.warn('Sniper suspend skipped — worker unavailable', { pid }); return }
      try { await ipc.call('suspend_process_pid', { pid }) }
      catch (e) { logger.warn('Sniper suspend failed', { pid, error: e }) }
    })
    globalSniperEngine.onKill(async (_name: string, pid: number): Promise<void> => {
      if (ipc === null) { logger.warn('Sniper kill skipped — worker unavailable', { pid }); return }
      try { await ipc.call('kill_process_pid', { pid }) }
      catch (e) { logger.warn('Sniper kill failed', { pid, error: e }) }
    })

    globalSniperEngine.start()
    globalStatsCollector.setSniperEngine(globalSniperEngine)

    // Start learning store + cognitive load engine
    globalLearningStore = initLearningStore(appDataPath)
    globalLearningStore.start()
    globalLoadEngine = new CognitiveLoadEngine(globalLearningStore)
    globalStatsCollector.setLearningEngine(globalLearningStore, globalLoadEngine)

    // Start a session for the current context
    const initialContext = globalContextEngine.getState().current
    globalLearningStore.startSession(initialContext)
    globalContextEngine.on('context_changed', ({ to }: { to: import('../context/engine.js').ContextName }) => {
      if (globalLearningStore !== null && globalLearningStore.getCurrentSessionId() !== null) {
        globalLearningStore.endSession(globalLearningStore.getCurrentSessionId()!)
      }
      globalLearningStore?.startSession(to)
    })

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

    if (globalWatchdogEngine !== null && ipc !== null) {
      const activeProfile = registry.getProfile(
        state.active_profile || config.default_profile
      )
      if (activeProfile !== undefined) {
        globalWatchdogEngine.start(activeProfile.watchdog, ipc)
      }
    }

    if (config.auto_detect.enabled && globalAutoDetectEngine !== null && ipc !== null) {
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
          globalTabManager.updateSuspensionConfig({
            ...switchedProfile.browser_suspension,
          })
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
        const url = `http://localhost:${port}/`
        spawn('cmd', ['/c', `start ${url}`])
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
      mcpServer.setIntelligence({
        contextEngine: globalContextEngine!,
        policyManager: globalPolicyManager!,
        sniperEngine: globalSniperEngine!,
        learningStore: globalLearningStore!,
        loadEngine: globalLoadEngine!,
      })
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
      if (globalStatusServer !== null) {
        const port = config.status_window.port
        const url = `http://localhost:${port}/`
        spawn('cmd', ['/c', `start ${url}`])
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

  if (globalContextEngine !== null) {
    globalContextEngine.stop()
    globalContextEngine = null
  }

  if (globalSniperEngine !== null) {
    globalSniperEngine.stop()
    globalSniperEngine = null
  }

  if (globalLearningStore !== null) {
    globalLearningStore.stop()
    globalLearningStore = null
  }

  if (globalMonitorCollector !== null) {
    globalMonitorCollector.stop()
    globalMonitorCollector = null
  }

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
