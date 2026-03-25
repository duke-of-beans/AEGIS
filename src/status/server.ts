import express from 'express'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import * as yaml from 'js-yaml'
import { getLogger } from '../logger/index.js'
import type { SystemSnapshot, HistoryPoint } from '../config/types.js'
import type { LoadedProfile, AegisConfig } from '../config/types.js'
import type { Server } from 'http'
import { buildStatusHtml } from './html.js'
import type { ProfileRegistry } from '../profiles/registry.js'

export class StatusServer {
  private app = express()
  private server: Server | null = null
  private port: number
  private snapshot: SystemSnapshot | null = null
  private switchCallback: ((profileName: string) => Promise<void>) | null = null
  private timerSetCallback: ((profile: string, durationMin: number) => Promise<void>) | null = null
  private timerCancelCallback: (() => Promise<void>) | null = null
  private tabSuspendCallback: ((tabId: string) => Promise<void>) | null = null
  private tabRestoreCallback: ((tabId: string) => Promise<void>) | null = null
  private identificationRequestCallback: ((req: { name: string; path?: string; publisher?: string; network?: string[] }) => Promise<void>) | null = null
  private catalogResolveCallback: ((req: { name: string; trust_tier: number; risk_label: string; action_permissions: string[]; notes?: string; source: string }) => Promise<void>) | null = null
  private feedbackCallback: ((req: { action_id: string; signal: string; intensity: string }) => Promise<void>) | null = null
  private registry: ProfileRegistry | null = null
  private registryConfig: AegisConfig | null = null
  private historyGetter: (() => HistoryPoint[]) | null = null
  private logger = getLogger()

  constructor(port: number) {
    this.port = port
    this.setupRoutes()
  }

  private setupRoutes(): void {
    this.app.use(express.json())
    this.app.use((_req, res, next) => {
      res.header('Access-Control-Allow-Origin', 'localhost')
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      res.header('Access-Control-Allow-Headers', 'Content-Type')
      next()
    })

    this.app.get('/status', (_req, res) => {
      if (this.snapshot === null) { res.status(503).json({ error: 'Status not available' }); return }
      res.json(this.snapshot)
    })

    this.app.post('/switch', (req, res): void => {
      void (async (): Promise<void> => {
        const body = req.body as Record<string, unknown> | undefined
        const profile = body?.profile
        if (typeof profile !== 'string') { res.status(400).json({ error: 'Missing profile name' }); return }
        try { if (this.switchCallback !== null) await this.switchCallback(profile); res.json({ success: true }) }
        catch (error) { this.logger.error('Switch profile failed', { profile, error }); res.status(500).json({ error: 'Switch failed' }) }
      })()
    })

    this.app.post('/timer/set', (req, res): void => {
      void (async (): Promise<void> => {
        const body = req.body as Record<string, unknown> | undefined
        const profile = body?.profile; const durationMin = body?.duration_min
        if (typeof profile !== 'string' || typeof durationMin !== 'number') { res.status(400).json({ error: 'Missing profile or duration_min' }); return }
        try { if (this.timerSetCallback !== null) await this.timerSetCallback(profile, durationMin); res.json({ success: true }) }
        catch (error) { this.logger.error('Timer set failed', { error }); res.status(500).json({ error: 'Timer set failed' }) }
      })()
    })

    this.app.post('/timer/cancel', (_req, res): void => {
      void (async (): Promise<void> => {
        try { if (this.timerCancelCallback !== null) await this.timerCancelCallback(); res.json({ success: true }) }
        catch (error) { this.logger.error('Timer cancel failed', { error }); res.status(500).json({ error: 'Timer cancel failed' }) }
      })()
    })

    this.app.get('/health', (_req, res) => { res.json({ alive: true, version: '2.1.0' }) })
    this.app.get('/', (_req, res) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.send(buildStatusHtml()) })

    this.app.post('/tabs/:id/suspend', (req, res): void => {
      void (async (): Promise<void> => {
        const { id } = req.params
        if (typeof id !== 'string' || id.length === 0) { res.status(400).json({ error: 'Missing tab id' }); return }
        try { if (this.tabSuspendCallback !== null) await this.tabSuspendCallback(id); res.json({ success: true }) }
        catch (error) { this.logger.error('Tab suspend failed', { id, error }); res.status(500).json({ error: 'Suspend failed' }) }
      })()
    })

    this.app.post('/tabs/:id/restore', (req, res): void => {
      void (async (): Promise<void> => {
        const { id } = req.params
        if (typeof id !== 'string' || id.length === 0) { res.status(400).json({ error: 'Missing tab id' }); return }
        try { if (this.tabRestoreCallback !== null) await this.tabRestoreCallback(id); res.json({ success: true }) }
        catch (error) { this.logger.error('Tab restore failed', { id, error }); res.status(500).json({ error: 'Restore failed' }) }
      })()
    })

    this.app.post('/catalog/identify', (req, res): void => {
      void (async (): Promise<void> => {
        const body = req.body as Record<string, unknown> | undefined
        const name = body?.name
        if (typeof name !== 'string') { res.status(400).json({ error: 'Missing name' }); return }
        try {
          if (this.identificationRequestCallback !== null) {
            const identReq: { name: string; path?: string; publisher?: string; network?: string[] } = { name }
            if (typeof body?.path === 'string') identReq.path = body.path
            if (typeof body?.publisher === 'string') identReq.publisher = body.publisher
            if (Array.isArray(body?.network)) identReq.network = body.network as string[]
            await this.identificationRequestCallback(identReq)
          }
          res.json({ queued: true })
        } catch (error) { this.logger.error('Catalog identify failed', { name, error }); res.status(500).json({ error: 'Identify failed' }) }
      })()
    })

    this.app.post('/catalog/resolve', (req, res): void => {
      void (async (): Promise<void> => {
        const body = req.body as Record<string, unknown> | undefined
        const name = body?.name
        if (typeof name !== 'string') { res.status(400).json({ error: 'Missing name' }); return }
        try {
          if (this.catalogResolveCallback !== null) {
            const resolveReq = {
              name, trust_tier: Number(body?.trust_tier ?? 3),
              risk_label: String(body?.risk_label ?? 'SAFE'),
              action_permissions: Array.isArray(body?.action_permissions) ? body.action_permissions as string[] : [],
              source: String(body?.source ?? 'user'),
            } as { name: string; trust_tier: number; risk_label: string; action_permissions: string[]; notes?: string; source: string }
            if (typeof body?.notes === 'string') resolveReq.notes = body.notes
            await this.catalogResolveCallback(resolveReq)
          }
          res.json({ success: true })
        } catch (error) { this.logger.error('Catalog resolve failed', { name, error }); res.status(500).json({ error: 'Resolve failed' }) }
      })()
    })

    this.app.post('/feedback', (req, res): void => {
      void (async (): Promise<void> => {
        const body = req.body as Record<string, unknown> | undefined
        const actionId = body?.action_id; const signal = body?.signal; const intensity = body?.intensity
        if (typeof actionId !== 'string' || typeof signal !== 'string' || typeof intensity !== 'string') { res.status(400).json({ error: 'Missing params' }); return }
        try { if (this.feedbackCallback !== null) await this.feedbackCallback({ action_id: actionId, signal, intensity }); res.json({ success: true }) }
        catch (error) { this.logger.error('Feedback failed', { error }); res.status(500).json({ error: 'Feedback failed' }) }
      })()
    })

    // GET /profiles — return ordered list of loaded profiles
    this.app.get('/profiles', (_req, res) => {
      if (this.registry === null || this.registryConfig === null) {
        res.status(503).json({ error: 'Profiles not loaded' })
        return
      }
      try {
        const all = this.registry.getAllProfiles()
        const order = this.registryConfig.profile_order
        const ordered: LoadedProfile[] = []
        for (const name of order) {
          const found = all.find((p: LoadedProfile) => p.name === name)
          if (found !== undefined) ordered.push(found)
        }
        // Append any profiles not in profile_order
        for (const p of all) {
          if (!order.includes(p.name)) ordered.push(p)
        }
        res.json(ordered)
      } catch (error) {
        this.logger.error('GET /profiles failed', { error })
        res.status(500).json({ error: 'Failed to load profiles' })
      }
    })

    // POST /profiles/:name — partial update, merge into YAML file
    this.app.post('/profiles/:name', (req, res): void => {
      if (this.registryConfig === null) { res.status(503).json({ error: 'Config not loaded' }); return }
      const { name } = req.params
      const body = req.body as Record<string, unknown> | undefined
      if (body === undefined || body === null) { res.status(400).json({ error: 'Missing body' }); return }
      try {
        const profilesDir = this.registryConfig.profiles_dir
        const filePath = join(profilesDir, `${name}.yaml`)
        const raw = readFileSync(filePath, 'utf-8')
        const parsed = yaml.load(raw) as Record<string, unknown>
        const profile = (parsed['profile'] ?? parsed) as Record<string, unknown>
        // Deep-merge body into profile
        for (const key of Object.keys(body)) {
          const existing = profile[key]
          const incoming = body[key]
          if (typeof existing === 'object' && existing !== null && !Array.isArray(existing) &&
              typeof incoming === 'object' && incoming !== null && !Array.isArray(incoming)) {
            profile[key] = { ...(existing as Record<string, unknown>), ...(incoming as Record<string, unknown>) }
          } else {
            profile[key] = incoming
          }
        }
        if (parsed['profile'] !== undefined) {
          parsed['profile'] = profile
        }
        writeFileSync(filePath, yaml.dump(parsed['profile'] !== undefined ? parsed : profile, { lineWidth: -1 }), 'utf-8')
        res.json({ success: true })
      } catch (error) {
        this.logger.error('POST /profiles/:name failed', { name, error })
        res.status(500).json({ error: 'Failed to update profile' })
      }
    })

    // GET /history — return CPU/RAM history ring buffer
    this.app.get('/history', (req, res) => {
      if (this.historyGetter === null) { res.json([]); return }
      const buffer = this.historyGetter()
      const minutes = Math.min(30, Math.max(1, parseInt(String(req.query['minutes'] ?? '30'), 10) || 30))
      const maxPoints = Math.ceil((minutes * 60) / 2) // 2s intervals
      const sliced = buffer.length > maxPoints ? buffer.slice(buffer.length - maxPoints) : buffer
      res.json(sliced)
    })
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port, () => { this.logger.info('Status server started', { port: this.port }); resolve() })
      this.server?.on('error', (error) => { this.logger.error('Status server error', { error }); reject(error) })
    })
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server === null) { resolve(); return }
      this.server.close(() => { this.logger.info('Status server stopped'); this.server = null; resolve() })
    })
  }

  updateSnapshot(snapshot: SystemSnapshot): void { this.snapshot = snapshot }
  onSwitch(callback: (profileName: string) => Promise<void>): void { this.switchCallback = callback }
  onTimerSet(callback: (profile: string, durationMin: number) => Promise<void>): void { this.timerSetCallback = callback }
  onTimerCancel(callback: () => Promise<void>): void { this.timerCancelCallback = callback }
  onTabSuspend(callback: (tabId: string) => Promise<void>): void { this.tabSuspendCallback = callback }
  onTabRestore(callback: (tabId: string) => Promise<void>): void { this.tabRestoreCallback = callback }
  onIdentificationRequest(callback: (req: { name: string; path?: string; publisher?: string; network?: string[] }) => Promise<void>): void { this.identificationRequestCallback = callback }
  onCatalogResolve(callback: (req: { name: string; trust_tier: number; risk_label: string; action_permissions: string[]; notes?: string; source: string }) => Promise<void>): void { this.catalogResolveCallback = callback }
  onFeedback(callback: (req: { action_id: string; signal: string; intensity: string }) => Promise<void>): void { this.feedbackCallback = callback }
  setRegistry(registry: ProfileRegistry, config: AegisConfig): void { this.registry = registry; this.registryConfig = config }
  setHistoryGetter(getter: () => HistoryPoint[]): void { this.historyGetter = getter }
}
