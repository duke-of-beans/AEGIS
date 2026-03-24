import { getLogger } from '../logger/index.js'
import { SystemSnapshot, ProcessStats, BrowserTabsSnapshot } from '../config/types.js'
import { WorkerIpc } from '../worker/ipc.js'
import { TabManager } from '../browser/tab-manager.js'
import { checkIsElevated } from '../system/elevation.js'
import type { CatalogManager } from '../catalog/manager.js'
import type { MonitorCollector } from './monitor-collector.js'
import type { ContextEngine } from '../context/engine.js'
import type { PolicyManager } from '../context/policies.js'
import type { SniperEngine, SniperEvent } from '../sniper/engine.js'
import type { LearningStore } from '../learning/store.js'
import type { CognitiveLoadEngine } from '../learning/load.js'
import { CognitiveLoadEngine as LoadEngineClass } from '../learning/load.js'
import * as os from 'os'

export class StatsCollector {
  private ipc: WorkerIpc | null
  private pollInterval: NodeJS.Timeout | null = null
  private latestStats: SystemSnapshot | null = null
  private updateCallback: ((snapshot: SystemSnapshot) => void) | null = null
  private logger = getLogger()
  private lastCpuInfo: os.CpuInfo[] | null = null
  private pollIntervalMs = 2000
  private isRunning = false
  private tabManager: TabManager | null = null
  private browserEnabled = false
  private catalog: CatalogManager | null = null
  private monitorCollector: MonitorCollector | null = null
  private contextEngine: ContextEngine | null = null
  private policyManager: PolicyManager | null = null
  private sniperEngine: SniperEngine | null = null
  private recentSniperEvents: SniperEvent[] = []
  private learningStore: LearningStore | null = null
  private loadEngine: CognitiveLoadEngine | null = null

  constructor(ipc: WorkerIpc | null, _activeProfile: string) {
    this.ipc = ipc
  }

  setTabManager(tabManager: TabManager | null, browserEnabled: boolean): void {
    this.tabManager = tabManager
    this.browserEnabled = browserEnabled
  }

  setCatalog(catalog: CatalogManager): void {
    this.catalog = catalog
  }

  setMonitorCollector(mc: MonitorCollector): void {
    this.monitorCollector = mc
  }

  setContextEngine(engine: ContextEngine, policies: PolicyManager): void {
    this.contextEngine = engine
    this.policyManager = policies
  }

  setSniperEngine(engine: SniperEngine): void {
    this.sniperEngine = engine
    engine.on('event', (evt: SniperEvent) => {
      this.recentSniperEvents.unshift(evt)
      if (this.recentSniperEvents.length > 20) {
        this.recentSniperEvents = this.recentSniperEvents.slice(0, 20)
      }
    })
  }

  setLearningEngine(store: LearningStore, loadEngine: CognitiveLoadEngine): void {
    this.learningStore = store
    this.loadEngine = loadEngine
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
      // Worker unavailable — use Node.js native os module for basic stats
      if (this.ipc === null || (this.ipc as unknown) === undefined) {
        this.pollNative()
        this.pollInterval = setTimeout(() => { void this.poll() }, this.pollIntervalMs)
        return
      }

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

      // Build browser_tabs snapshot from live TabManager if available
      let browserTabs: BrowserTabsSnapshot | undefined
      if (this.browserEnabled) {
        if (this.tabManager !== null) {
          const stats = this.tabManager.getStats()
          const tabList = this.tabManager.getTabList()
          const connected = this.tabManager.isCdpConnected()
          browserTabs = {
            enabled: true,
            connected,
            total: stats.total,
            active: stats.active,
            suspended: stats.suspended,
            memory_recovered_mb: stats.suspended * 80,
            tabs: tabList,
          }
        } else {
          browserTabs = {
            enabled: true,
            connected: false,
            total: 0,
            active: 0,
            suspended: 0,
            memory_recovered_mb: 0,
            tabs: [],
          }
        }
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
        ...(browserTabs !== undefined ? { browser_tabs: browserTabs } : {}),
        isElevated: await checkIsElevated(),
        ...(this.catalog !== null ? {
          unresolved_count: this.catalog.getStats().unknown,
          suspicious_count: this.catalog.getStats().suspicious,
        } : {}),
        ...(this.contextEngine !== null ? (() => {
          const cs = this.contextEngine.getState()
          const overlays = this.policyManager?.getStack().overlays.map((o) => o.name) ?? []
          return {
            context: {
              current: cs.current,
              previous: cs.previous,
              confidence: cs.confidence,
              switched_at: cs.switched_at,
              idle_since: cs.idle_since,
              active_overlays: overlays,
            },
          }
        })() : {}),
      }

      // Merge extended monitor data (disk, network, GPU, system_extended, process_tree)
      if (this.monitorCollector !== null) {
        const ext = this.monitorCollector.getLatestExtended()
        Object.assign(this.latestStats, ext)
      }

      // Record observation for all processes
      if (this.catalog !== null) {
        for (const proc of processes) {
          this.catalog.recordObservation({ name: proc.name })
        }
      }

      // Feed process data to sniper for baseline recording + deviation detection
      if (this.sniperEngine !== null) {
        this.sniperEngine.ingest(processes.map(p => ({
          name: p.name,
          pid: p.pid,
          cpu_percent: p.cpu_percent,
          memory_mb: p.memory_mb,
          handle_count: 0,
        })))
        // Attach sniper stats to snapshot
        const watches = this.sniperEngine.getActiveWatches()
        const recentActions = this.recentSniperEvents
          .filter(e => e.type === 'action_taken')
          .slice(0, 10)
          .map(e => ({
            name: e.name,
            pid: e.pid,
            action: e.action ?? 'notify',
            reason: e.reason,
            timestamp: e.timestamp,
          }))
        this.latestStats.sniper = {
          active_watches: watches.length,
          recent_actions: recentActions,
        }
      }

      // Compute cognitive load score
      if (this.loadEngine !== null && this.latestStats !== null) {
        const activeWatches = this.sniperEngine?.getActiveWatches().length ?? 0
        const breakdown = this.loadEngine.compute(this.latestStats, activeWatches)
        this.latestStats.cognitive_load = {
          score: breakdown.score,
          tier: LoadEngineClass.getTier(breakdown.score),
          cpu_pressure: breakdown.cpu_pressure,
          memory_pressure: breakdown.memory_pressure,
          disk_queue_pressure: breakdown.disk_queue_pressure,
          dpc_pressure: breakdown.dpc_pressure,
        }
        // Record load sample for session history
        if (this.learningStore !== null) {
          this.learningStore.recordLoadSample({
            load_score: breakdown.score,
            cpu_pressure: breakdown.cpu_pressure,
            memory_pressure: breakdown.memory_pressure,
            disk_queue: breakdown.disk_queue_pressure,
            dpc_rate: breakdown.dpc_pressure,
            runaway_count: activeWatches,
            tab_pressure: breakdown.tab_pressure,
            sampled_at: new Date().toISOString(),
          })
        }
      }

      // Include confidence state
      if (this.learningStore !== null) {
        const conf = this.learningStore.getConfidenceState()
        this.latestStats.confidence = {
          score: conf.confidence_score,
          total_decisions: conf.total_decisions,
          auto_mode_unlocked: conf.auto_mode_unlocked,
          decisions_until_auto: conf.decisions_until_auto,
        }
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

  private pollNative(): void {
    try {
      const cpus = os.cpus()
      let cpuPercent = 0
      if (this.lastCpuInfo !== null && this.lastCpuInfo.length === cpus.length) {
        let totalIdle = 0, totalTick = 0
        for (let i = 0; i < cpus.length; i++) {
          const prev = this.lastCpuInfo[i]!.times
          const curr = cpus[i]!.times
          const idle = curr.idle - prev.idle
          const total = Object.values(curr).reduce((a, b) => a + b, 0) -
                        Object.values(prev).reduce((a, b) => a + b, 0)
          totalIdle += idle
          totalTick += total
        }
        cpuPercent = totalTick > 0 ? Math.round((1 - totalIdle / totalTick) * 100) : 0
      }
      this.lastCpuInfo = cpus

      const totalMem = os.totalmem()
      const freeMem = os.freemem()
      const usedMem = totalMem - freeMem
      const memPercent = Math.round((usedMem / totalMem) * 100)

      const base = this.latestStats ?? this.getLatestStats()
      const snapshot: SystemSnapshot = {
        ...base,
        timestamp: new Date().toISOString(),
        version: '3.0.0',
        cpu_percent: cpuPercent,
        memory_percent: memPercent,
        memory_mb_used: Math.round(usedMem / 1024 / 1024),
        memory_mb_available: Math.round(freeMem / 1024 / 1024),
        worker_status: 'failed',
        system_extended: base.system_extended ?? {
          dpc_rate: 0,
          interrupt_rate: 0,
          page_faults_sec: 0,
          page_reads_sec: 0,
          uptime_sec: Math.round(os.uptime()),
        },
      }

      // Merge in context/sniper/cognitive_load if engines are running
      this.latestStats = snapshot
      this.enrichSnapshot()

      if (this.updateCallback !== null && this.latestStats !== null) {
        this.updateCallback(this.latestStats)
      }
    } catch (e) {
      this.logger.warn('Native poll failed', { error: e })
    }
  }

  private enrichSnapshot(): void {
    if (this.latestStats === null) return

    if (this.contextEngine !== null) {
      const cs = this.contextEngine.getState()
      this.latestStats.context = {
        current: cs.current,
        previous: cs.previous,
        confidence: cs.confidence,
        switched_at: cs.switched_at,
        idle_since: cs.idle_since,
        active_overlays: this.policyManager?.getStack().overlays.map(o => o.name) ?? [],
      }
    }

    if (this.sniperEngine !== null) {
      const watches = this.sniperEngine.getActiveWatches?.() ?? []
      this.latestStats.sniper = {
        active_watches: watches.length,
        recent_actions: this.recentSniperEvents.slice(0, 20).map(e => ({
          name: e.name,
          pid: e.pid,
          action: e.action ?? '',
          reason: e.reason,
          timestamp: e.timestamp,
        })),
      }
    }

    if (this.loadEngine !== null) {
      const watches = this.sniperEngine?.getActiveWatches?.()?.length ?? 0
      const breakdown = this.loadEngine.compute(this.latestStats, watches)
      const tier = breakdown.score <= 40 ? 'green' : breakdown.score <= 70 ? 'amber' : 'red'
      this.latestStats.cognitive_load = {
        score: breakdown.score,
        tier: tier as 'green' | 'amber' | 'red',
        cpu_pressure: breakdown.cpu_pressure,
        memory_pressure: breakdown.memory_pressure,
        disk_queue_pressure: breakdown.disk_queue_pressure,
        dpc_pressure: breakdown.dpc_pressure,
      }
    }

    if (this.learningStore !== null) {
      const conf = this.learningStore.getConfidenceState()
      this.latestStats.confidence = {
        score: conf.confidence_score,
        total_decisions: conf.total_decisions,
        auto_mode_unlocked: conf.auto_mode_unlocked,
        decisions_until_auto: conf.decisions_until_auto,
      }
    }
  }
}
