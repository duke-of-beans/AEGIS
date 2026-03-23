import { getLogger } from '../logger/index.js'
import { BrowserManagerConfig, TabState } from '../config/types.js'
import { CdpClient } from './cdp-client.js'

// Suspension holding page — a data: URI so CDP can navigate to it
const SUSPENSION_PAGE_HTML =
  'data:text/html,' +
  encodeURIComponent(
    '<html><body style="background:#111;color:#888;font-family:sans-serif;' +
      'display:flex;align-items:center;justify-content:center;height:100vh;margin:0">' +
      '<div style="text-align:center"><p style="font-size:2rem">⏸</p>' +
      '<p>Tab suspended by AEGIS</p><p style="font-size:.8rem;opacity:.5">' +
      'Click to restore</p></div></body></html>'
  )

export class TabManager {
  private config: BrowserManagerConfig
  private cdp: CdpClient
  private tabs: Map<string, TabState> = new Map()
  private pollInterval: NodeJS.Timeout | null = null
  private logger = getLogger()
  private pressureActive = false

  constructor(config: BrowserManagerConfig) {
    this.config = config
    this.cdp = new CdpClient(config.tab_suspension.cdp_port)
  }

  start(): void {
    this.logger.info('TabManager starting', {
      cdpPort: this.config.tab_suspension.cdp_port,
      pollIntervalSec: this.config.tab_suspension.poll_interval_sec,
    })

    // Connect async — non-blocking, errors are tolerated
    void this.cdp.connect()

    this.pollInterval = setInterval(() => {
      void this.poll()
    }, this.config.tab_suspension.poll_interval_sec * 1000)

    // Run an initial poll
    void this.poll()
  }

  stop(): void {
    if (this.pollInterval !== null) {
      clearInterval(this.pollInterval)
      this.pollInterval = null
    }
    this.cdp.disconnect()
    this.logger.info('TabManager stopped')
  }

  async poll(): Promise<void> {
    let targets: Awaited<ReturnType<CdpClient['getTargets']>> = []
    try {
      targets = await this.cdp.getTargets()
    } catch (error) {
      this.logger.warn('TabManager poll: getTargets failed', { error })
      return
    }

    const now = Date.now()
    const seenIds = new Set<string>()

    for (const target of targets) {
      seenIds.add(target.id)
      const existing = this.tabs.get(target.id)

      if (existing === undefined) {
        // New tab — register as active
        this.tabs.set(target.id, {
          id: target.id,
          url: target.url,
          title: target.title,
          suspended: false,
          original_url: null,
          last_active_ms: now,
          suspended_at_ms: null,
        })
      } else if (existing.suspended) {
        // Tab was suspended — check if user navigated away from suspension page
        if (!target.url.startsWith('data:text/html')) {
          // User restored it manually
          existing.suspended = false
          existing.original_url = null
          existing.last_active_ms = now
          existing.url = target.url
          existing.title = target.title
          this.logger.info('Tab restored (user navigated)', { title: target.title })
        }
      } else {
        // Active tab — update title; only update last_active_ms if URL changed
        if (existing.url !== target.url) {
          existing.url = target.url
          existing.title = target.title
          existing.last_active_ms = now
        } else {
          existing.title = target.title
        }
      }
    }

    // Remove closed tabs
    for (const [id] of this.tabs) {
      if (!seenIds.has(id)) {
        this.tabs.delete(id)
      }
    }

    await this.evaluateSuspensions(this.pressureActive)
  }

  async evaluateSuspensions(memoryPressure: boolean): Promise<void> {
    const cfg = this.config.tab_suspension
    const now = Date.now()
    const thresholdMs = cfg.inactivity_threshold_min * 60 * 1000

    const activeTabs = [...this.tabs.values()].filter((t) => !t.suspended)
    const totalActive = activeTabs.length

    // Must always keep at least 1 active tab
    if (totalActive <= 1) return

    const eligible = activeTabs.filter((tab) => {
      // Skip system URLs
      if (
        tab.url.startsWith('chrome://') ||
        tab.url.startsWith('brave://') ||
        tab.url.startsWith('about:')
      ) {
        return false
      }
      // Skip whitelist
      const whitelisted = cfg.whitelist.some((pattern: string) =>
        tab.url.includes(pattern)
      )
      if (whitelisted) return false

      // Qualify by inactivity or memory pressure
      if (memoryPressure) return true
      return now - tab.last_active_ms > thresholdMs
    })

    // Sort oldest-first
    eligible.sort((a, b) => a.last_active_ms - b.last_active_ms)

    // How many can we suspend? Never drop below 1 active
    const currentlySuspended = [...this.tabs.values()].filter(
      (t) => t.suspended
    ).length
    const maxCanSuspend = Math.min(
      cfg.max_suspended_tabs - currentlySuspended,
      totalActive - 1 // keep at least 1 active
    )

    if (maxCanSuspend <= 0) return

    const toSuspend = eligible.slice(0, maxCanSuspend)
    for (const tab of toSuspend) {
      await this.suspendTab(tab.id)
    }
  }

  async suspendTab(tabId: string): Promise<void> {
    const tab = this.tabs.get(tabId)
    if (tab === undefined || tab.suspended) return

    try {
      tab.original_url = tab.url
      tab.suspended = true
      tab.suspended_at_ms = Date.now()
      await this.cdp.navigateTab(tabId, SUSPENSION_PAGE_HTML)
      this.logger.info('Suspended tab', { title: tab.title, url: tab.original_url })
    } catch (error) {
      // Roll back state on failure
      tab.suspended = false
      tab.original_url = null
      tab.suspended_at_ms = null
      this.logger.warn('Failed to suspend tab', { tabId, error })
    }
  }

  async restoreTab(tabId: string): Promise<void> {
    const tab = this.tabs.get(tabId)
    if (tab === undefined || !tab.suspended || tab.original_url === null) return

    try {
      const originalUrl = tab.original_url
      await this.cdp.navigateTab(tabId, originalUrl)
      tab.suspended = false
      tab.original_url = null
      tab.last_active_ms = Date.now()
      this.logger.info('Restored tab', { title: tab.title, url: originalUrl })
    } catch (error) {
      this.logger.warn('Failed to restore tab', { tabId, error })
    }
  }

  async suspendAll(): Promise<void> {
    const activeTabs = [...this.tabs.values()].filter((t) => !t.suspended)
    for (const tab of activeTabs) {
      await this.suspendTab(tab.id)
    }
  }

  async restoreAll(): Promise<void> {
    const suspendedTabs = [...this.tabs.values()].filter((t) => t.suspended)
    for (const tab of suspendedTabs) {
      await this.restoreTab(tab.id)
    }
  }

  getStats(): {
    total: number
    suspended: number
    active: number
    memory_est_mb: number
  } {
    const all = [...this.tabs.values()]
    const suspended = all.filter((t) => t.suspended).length
    const active = all.length - suspended
    return {
      total: all.length,
      suspended,
      active,
      memory_est_mb: suspended * 80,
    }
  }

  notifyMemoryPressure(pressureActive: boolean): void {
    this.pressureActive = pressureActive
    if (pressureActive) {
      this.logger.info('TabManager: memory pressure — triggering suspension')
      void this.evaluateSuspensions(true)
    }
  }
}
