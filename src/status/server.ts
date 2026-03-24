import express from 'express'
import { getLogger } from '../logger/index.js'
import type { SystemSnapshot } from '../config/types.js'
import type { Server } from 'http'

export class StatusServer {
  private app = express()
  private server: Server | null = null
  private port: number
  private snapshot: SystemSnapshot | null = null
  private switchCallback:
    | ((profileName: string) => Promise<void>)
    | null = null
  private timerSetCallback:
    | ((profile: string, durationMin: number) => Promise<void>)
    | null = null
  private timerCancelCallback: (() => Promise<void>) | null = null
  private tabSuspendCallback: ((tabId: string) => Promise<void>) | null = null
  private tabRestoreCallback: ((tabId: string) => Promise<void>) | null = null
  private identificationRequestCallback: ((req: { name: string; path?: string; publisher?: string; network?: string[] }) => Promise<void>) | null = null
  private catalogResolveCallback: ((req: { name: string; trust_tier: number; risk_label: string; action_permissions: string[]; notes?: string; source: string }) => Promise<void>) | null = null
  private logger = getLogger()

  constructor(port: number) {
    this.port = port
    this.setupRoutes()
  }

  private setupRoutes(): void {
    this.app.use(express.json())

    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', 'localhost')
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      res.header('Access-Control-Allow-Headers', 'Content-Type')
      next()
    })

    this.app.get('/status', (_req, res) => {
      if (this.snapshot === null) {
        res.status(503).json({ error: 'Status not available' })
        return
      }
      res.json(this.snapshot)
    })

    this.app.get('/profiles', (req, res) => {
      res.json([])
    })

    this.app.post('/switch', (req, res): void => {
      void (async (): Promise<void> => {
        const body = req.body as Record<string, unknown> | undefined
        const profile = body?.profile
        if (typeof profile !== 'string') {
          res.status(400).json({ error: 'Missing profile name' })
          return
        }

        try {
          if (this.switchCallback !== null) {
            await this.switchCallback(profile)
          }
          res.json({ success: true })
        } catch (error) {
          this.logger.error('Switch profile failed', { profile, error })
          res.status(500).json({ error: 'Switch failed' })
        }
      })()
    })

    this.app.post('/timer/set', (req, res): void => {
      void (async (): Promise<void> => {
        const body = req.body as Record<string, unknown> | undefined
        const profile = body?.profile
        const durationMin = body?.duration_min

        if (typeof profile !== 'string' || typeof durationMin !== 'number') {
          res.status(400).json({ error: 'Missing profile or duration_min' })
          return
        }

        try {
          if (this.timerSetCallback !== null) {
            await this.timerSetCallback(profile, durationMin)
          }
          res.json({ success: true })
        } catch (error) {
          this.logger.error('Timer set failed', { profile, durationMin, error })
          res.status(500).json({ error: 'Timer set failed' })
        }
      })()
    })

    this.app.post('/timer/cancel', (_req, res): void => {
      void (async (): Promise<void> => {
        try {
          if (this.timerCancelCallback !== null) {
            await this.timerCancelCallback()
          }
          res.json({ success: true })
        } catch (error) {
          this.logger.error('Timer cancel failed', { error })
          res.status(500).json({ error: 'Timer cancel failed' })
        }
      })()
    })

    this.app.get('/health', (_req, res) => {
      res.json({ alive: true, version: '2.0.0' })
    })

    this.app.get('/', (_req, res) => {
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.send(buildStatusHtml())
    })

    this.app.post('/tabs/:id/suspend', (req, res): void => {
      void (async (): Promise<void> => {
        const { id } = req.params
        if (typeof id !== 'string' || id.length === 0) {
          res.status(400).json({ error: 'Missing tab id' })
          return
        }
        try {
          if (this.tabSuspendCallback !== null) {
            await this.tabSuspendCallback(id)
          }
          res.json({ success: true })
        } catch (error) {
          this.logger.error('Tab suspend failed', { id, error })
          res.status(500).json({ error: 'Suspend failed' })
        }
      })()
    })

    this.app.post('/tabs/:id/restore', (req, res): void => {
      void (async (): Promise<void> => {
        const { id } = req.params
        if (typeof id !== 'string' || id.length === 0) {
          res.status(400).json({ error: 'Missing tab id' })
          return
        }
        try {
          if (this.tabRestoreCallback !== null) {
            await this.tabRestoreCallback(id)
          }
          res.json({ success: true })
        } catch (error) {
          this.logger.error('Tab restore failed', { id, error })
          res.status(500).json({ error: 'Restore failed' })
        }
      })()
    })

    this.app.post('/catalog/identify', (req, res): void => {
      void (async (): Promise<void> => {
        const body = req.body as Record<string, unknown> | undefined
        const name = body?.name
        if (typeof name !== 'string') {
          res.status(400).json({ error: 'Missing name' })
          return
        }
        try {
          if (this.identificationRequestCallback !== null) {
            const identReq: { name: string; path?: string; publisher?: string; network?: string[] } = { name }
            if (typeof body?.path === 'string') identReq.path = body.path
            if (typeof body?.publisher === 'string') identReq.publisher = body.publisher
            if (Array.isArray(body?.network)) identReq.network = body.network as string[]
            await this.identificationRequestCallback(identReq)
          }
          res.json({ queued: true })
        } catch (error) {
          this.logger.error('Catalog identify failed', { name, error })
          res.status(500).json({ error: 'Identify failed' })
        }
      })()
    })

    this.app.post('/catalog/resolve', (req, res): void => {
      void (async (): Promise<void> => {
        const body = req.body as Record<string, unknown> | undefined
        const name = body?.name
        if (typeof name !== 'string') {
          res.status(400).json({ error: 'Missing name' })
          return
        }
        try {
          if (this.catalogResolveCallback !== null) {
            const resolveReq: { name: string; trust_tier: number; risk_label: string; action_permissions: string[]; notes?: string; source: string } = {
              name,
              trust_tier: Number(body?.trust_tier ?? 3),
              risk_label: String(body?.risk_label ?? 'SAFE'),
              action_permissions: Array.isArray(body?.action_permissions) ? body.action_permissions as string[] : [],
              source: String(body?.source ?? 'user'),
            }
            if (typeof body?.notes === 'string') resolveReq.notes = body.notes
            await this.catalogResolveCallback(resolveReq)
          }
          res.json({ success: true })
        } catch (error) {
          this.logger.error('Catalog resolve failed', { name, error })
          res.status(500).json({ error: 'Resolve failed' })
        }
      })()
    })
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port, () => {
        this.logger.info('Status server started', { port: this.port })
        resolve()
      })

      this.server?.on('error', (error) => {
        this.logger.error('Status server error', { error })
        reject(error)
      })
    })
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server === null) {
        resolve()
        return
      }

      this.server.close(() => {
        this.logger.info('Status server stopped')
        this.server = null
        resolve()
      })
    })
  }

  updateSnapshot(snapshot: SystemSnapshot): void {
    this.snapshot = snapshot
  }

  onSwitch(callback: (profileName: string) => Promise<void>): void {
    this.switchCallback = callback
  }

  onTimerSet(
    callback: (profile: string, durationMin: number) => Promise<void>
  ): void {
    this.timerSetCallback = callback
  }

  onTimerCancel(callback: () => Promise<void>): void {
    this.timerCancelCallback = callback
  }

  onTabSuspend(callback: (tabId: string) => Promise<void>): void {
    this.tabSuspendCallback = callback
  }

  onTabRestore(callback: (tabId: string) => Promise<void>): void {
    this.tabRestoreCallback = callback
  }

  onIdentificationRequest(callback: (req: { name: string; path?: string; publisher?: string; network?: string[] }) => Promise<void>): void {
    this.identificationRequestCallback = callback
  }

  onCatalogResolve(callback: (req: { name: string; trust_tier: number; risk_label: string; action_permissions: string[]; notes?: string; source: string }) => Promise<void>): void {
    this.catalogResolveCallback = callback
  }
}

// ─── Status Window HTML ──────────────────────────────────────────────────────

function buildStatusHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AEGIS</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0a0a0f; color: #c9d1d9; font-family: 'Consolas', 'Courier New', monospace; font-size: 13px; padding: 20px; min-width: 480px; }
    h1 { font-size: 18px; color: #58a6ff; letter-spacing: 3px; display: inline; }
    .subtitle { color: #6e7681; margin: 6px 0 18px; }
    .badge { font-size: 11px; padding: 2px 9px; border-radius: 10px; margin-left: 10px; vertical-align: middle; }
    .cdp-ok  { background: #1a3a2a; color: #3fb950; border: 1px solid #3fb95060; }
    .cdp-off { background: #2a1a1a; color: #f85149; border: 1px solid #f8514960; }
    .elev-off { background: #272115; color: #f0883e; border: 1px solid #f0883e60; }
    .warn-banner { background: #272115; border: 1px solid #f0883e; border-radius: 6px; padding: 10px 14px; margin-bottom: 16px; color: #f0883e; font-size: 12px; }
    .metrics { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
    .metric { flex: 1; min-width: 120px; background: #161b22; border: 1px solid #21262d; border-radius: 6px; padding: 12px; }
    .metric-label { color: #6e7681; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; }
    .metric-value { font-size: 22px; color: #c9d1d9; margin: 4px 0; }
    .bar-bg { height: 4px; background: #21262d; border-radius: 2px; }
    .bar { height: 4px; border-radius: 2px; transition: width 0.4s; }
    .bar-cpu { background: #58a6ff; }
    .bar-mem { background: #3fb950; }
    .bar-mem.warn { background: #f0883e; }
    .bar-mem.crit { background: #f85149; }
    .bar-free { background: #58a6ff; }
    .section { margin-bottom: 22px; }
    .section-title { color: #58a6ff; font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 10px; border-bottom: 1px solid #21262d; padding-bottom: 5px; display: flex; justify-content: space-between; }
    .section-sub { color: #6e7681; font-size: 10px; }
    .summary-row { display: flex; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
    .chip { background: #161b22; border: 1px solid #21262d; border-radius: 4px; padding: 7px 14px; }
    .chip-label { color: #6e7681; font-size: 10px; text-transform: uppercase; display: block; margin-bottom: 2px; }
    .chip-value { color: #c9d1d9; font-size: 17px; }
    .actions { display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
    .btn { padding: 4px 12px; border-radius: 4px; border: none; cursor: pointer; font-family: inherit; font-size: 11px; letter-spacing: 0.5px; transition: opacity 0.15s; }
    .btn:hover { opacity: 0.75; }
    .btn-blue   { background: #161b22; color: #58a6ff; border: 1px solid #58a6ff50; }
    .btn-orange { background: #161b22; color: #f0883e; border: 1px solid #f0883e50; }
    .btn-green  { background: #161b22; color: #3fb950; border: 1px solid #3fb95050; }
    .tab-list { background: #0d1117; border: 1px solid #21262d; border-radius: 6px; overflow: hidden; }
    .tab-row { display: flex; align-items: center; padding: 8px 12px; border-bottom: 1px solid #21262d; gap: 10px; }
    .tab-row:last-child { border-bottom: none; }
    .dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
    .dot-on  { background: #3fb950; }
    .dot-off { background: #484f58; }
    .tab-title { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #c9d1d9; }
    .tab-age { color: #6e7681; font-size: 11px; white-space: nowrap; flex-shrink: 0; }
    .proc-list { background: #0d1117; border: 1px solid #21262d; border-radius: 6px; overflow: hidden; }
    .proc-row { display: flex; align-items: center; padding: 6px 12px; border-bottom: 1px solid #21262d; gap: 10px; }
    .proc-row:last-child { border-bottom: none; }
    .proc-name { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .proc-stat { width: 60px; text-align: right; font-size: 11px; color: #6e7681; flex-shrink: 0; }
    .proc-stat.hot { color: #f85149; }
    .empty { color: #6e7681; font-style: italic; padding: 14px 12px; background: #0d1117; border: 1px solid #21262d; border-radius: 6px; }
    #ts { color: #6e7681; font-size: 11px; }
    .disk-list, .net-list, .sys-grid { background: #0d1117; border: 1px solid #21262d; border-radius: 6px; overflow: hidden; }
    .disk-row, .net-row { padding: 8px 12px; border-bottom: 1px solid #21262d; }
    .disk-row:last-child, .net-row:last-child { border-bottom: none; }
    .disk-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
    .disk-letter { font-size: 13px; color: #c9d1d9; }
    .disk-label  { color: #6e7681; font-size: 11px; margin-left: 6px; }
    .disk-io     { font-size: 11px; color: #6e7681; }
    .disk-io span { margin-left: 10px; }
    .disk-io .hot { color: #f0883e; }
    .disk-queue-dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-left: 6px; vertical-align: middle; }
    .health-badge { font-size: 10px; padding: 1px 7px; border-radius: 8px; }
    .health-healthy   { background: #1a3a2a; color: #3fb950; border: 1px solid #3fb95040; }
    .health-warning   { background: #272115; color: #f0883e; border: 1px solid #f0883e40; }
    .health-unhealthy { background: #2a1a1a; color: #f85149; border: 1px solid #f8514940; }
    .health-unknown   { background: #161b22; color: #6e7681; border: 1px solid #21262d; }
    .pdisk-row { display: flex; align-items: center; gap: 8px; padding: 5px 12px; border-bottom: 1px solid #21262d; font-size: 11px; }
    .pdisk-row:last-child { border-bottom: none; }
    .pdisk-name { flex: 1; color: #c9d1d9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .pdisk-type { color: #6e7681; width: 32px; }
    .pdisk-size { color: #6e7681; width: 55px; text-align: right; }
    .net-name   { font-size: 12px; color: #c9d1d9; margin-bottom: 3px; }
    .net-stats  { display: flex; gap: 14px; font-size: 11px; color: #6e7681; }
    .net-stats .val { color: #c9d1d9; }
    .status-up   { color: #3fb950; }
    .status-down { color: #f85149; }
    .gpu-row { padding: 10px 12px; border-bottom: 1px solid #21262d; }
    .gpu-row:last-child { border-bottom: none; }
    .gpu-name { font-size: 12px; color: #c9d1d9; margin-bottom: 6px; }
    .gpu-metrics { display: flex; gap: 14px; flex-wrap: wrap; font-size: 11px; color: #6e7681; }
    .gpu-metrics .val { color: #c9d1d9; }
    .gpu-source { font-size: 10px; padding: 1px 7px; border-radius: 8px; margin-left: 8px; vertical-align: middle; }
    .src-nvidia { background: #1a3a2a; color: #3fb950; border: 1px solid #3fb95040; }
    .src-wmi    { background: #272115; color: #f0883e; border: 1px solid #f0883e40; }
    .sys-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; }
    .sys-cell { padding: 8px 14px; border-bottom: 1px solid #21262d; border-right: 1px solid #21262d; }
    .sys-cell:nth-child(even) { border-right: none; }
    .sys-cell:nth-last-child(-n+2) { border-bottom: none; }
    .sys-cell-label { color: #6e7681; font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; }
    .sys-cell-val   { color: #c9d1d9; font-size: 15px; margin-top: 2px; }
    .sys-cell-val.warn { color: #f0883e; }
    .sys-cell-val.crit { color: #f85149; }
    .tree-container { background: #0d1117; border: 1px solid #21262d; border-radius: 6px; overflow: hidden; }
    .tree-toggle { background: none; border: none; cursor: pointer; color: #6e7681; font-family: inherit; font-size: 11px; padding: 6px 12px; width: 100%; text-align: left; border-bottom: 1px solid #21262d; }
    .tree-toggle:hover { color: #c9d1d9; }
    .tree-body { display: none; max-height: 320px; overflow-y: auto; }
    .tree-body.open { display: block; }
    .tree-node { display: flex; align-items: center; padding: 3px 12px; border-bottom: 1px solid #161b22; font-size: 11px; gap: 6px; }
    .tree-node:last-child { border-bottom: none; }
    .tree-indent { color: #484f58; flex-shrink: 0; }
    .tree-name  { flex: 1; color: #c9d1d9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .tree-mem   { width: 58px; text-align: right; color: #6e7681; flex-shrink: 0; }
    .tree-pid   { width: 42px; text-align: right; color: #484f58; flex-shrink: 0; font-size: 10px; }
  </style>
</head>
<body>
  <div style="margin-bottom:6px">
    <h1>⚙ AEGIS</h1>
    <span id="cdp-badge" class="badge cdp-off">CDP ✕</span>
    <span id="elev-badge" class="badge elev-off" style="display:none">⚠ NOT ELEVATED</span>
  </div>
  <div class="subtitle">
    Profile: <strong id="profile" style="color:#c9d1d9">—</strong>
    &nbsp;·&nbsp; <span id="ts">connecting…</span>
  </div>

  <div id="warn-banner" class="warn-banner" style="display:none">
    ⚠ Running without elevation — process priority and service control are disabled. Restart as Administrator to enable full functionality.
  </div>

  <div class="metrics">
    <div class="metric">
      <div class="metric-label">CPU</div>
      <div class="metric-value" id="cpu-val">—</div>
      <div class="bar-bg"><div class="bar bar-cpu" id="cpu-bar" style="width:0%"></div></div>
    </div>
    <div class="metric">
      <div class="metric-label">RAM Used</div>
      <div class="metric-value" id="mem-val">—</div>
      <div class="bar-bg"><div class="bar bar-mem" id="mem-bar" style="width:0%"></div></div>
    </div>
    <div class="metric">
      <div class="metric-label">RAM Free</div>
      <div class="metric-value" id="free-val">—</div>
      <div class="bar-bg"><div class="bar bar-free" id="free-bar" style="width:0%"></div></div>
    </div>
  </div>

  <div id="browser-section" class="section" style="display:none">
    <div class="section-title">Browser Tabs <span id="last-upd" class="section-sub"></span></div>
    <div class="summary-row" id="tab-summary"></div>
    <div class="actions" id="tab-actions"></div>
    <div id="tab-list"></div>
  </div>

  <div class="section">
    <div class="section-title">Top Processes <span class="section-sub">by memory</span></div>
    <div id="proc-list"><div class="empty">Loading…</div></div>
  </div>

  <div id="catalog-section" class="section" style="display:none">
    <div class="section-title">Process Catalog <span id="catalog-sub" class="section-sub"></span></div>
    <div id="catalog-suspicious"></div>
    <div id="catalog-unresolved"></div>
  </div>

  <div id="disk-section" class="section" style="display:none">
    <div class="section-title">Disk I/O <span class="section-sub">per drive · 10s delta</span></div>
    <div id="disk-list"></div>
    <div id="pdisk-list" style="margin-top:8px"></div>
  </div>

  <div id="network-section" class="section" style="display:none">
    <div class="section-title">Network <span class="section-sub">per adapter · 10s delta</span></div>
    <div id="net-list"></div>
  </div>

  <div id="gpu-section" class="section" style="display:none">
    <div class="section-title">GPU <span id="gpu-source-badge"></span><span class="section-sub" style="margin-left:8px" id="gpu-sub"></span></div>
    <div id="gpu-list"></div>
  </div>

  <div id="sysext-section" class="section" style="display:none">
    <div class="section-title">System <span class="section-sub">DPC · interrupts · faults · uptime</span></div>
    <div id="sysext-grid"></div>
  </div>

  <div id="proctree-section" class="section" style="display:none">
    <div class="section-title">Process Tree <span class="section-sub">read-only · 30s refresh</span></div>
    <div id="proctree-container"></div>
  </div>

  <script>
    let currentTabs = [];

    function esc(s) {
      return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    async function suspendTab(id) {
      await fetch('/tabs/' + encodeURIComponent(id) + '/suspend', { method: 'POST' });
    }
    async function restoreTab(id) {
      await fetch('/tabs/' + encodeURIComponent(id) + '/restore', { method: 'POST' });
    }
    async function suspendAll() {
      await Promise.all(currentTabs.filter(t => !t.suspended).map(t => suspendTab(t.id)));
    }
    async function restoreAll() {
      await Promise.all(currentTabs.filter(t => t.suspended).map(t => restoreTab(t.id)));
    }

    async function requestId(name) {
      await fetch('/catalog/identify', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ name }) });
    }

    function renderCatalog(d) {
      const suspicious = d.suspicious_count || 0;
      const unresolved = d.unresolved_count || 0;
      const sec = document.getElementById('catalog-section');
      if (suspicious === 0 && unresolved === 0) { sec.style.display = 'none'; return; }
      sec.style.display = '';
      document.getElementById('catalog-sub').textContent =
        (suspicious > 0 ? suspicious + ' suspicious' : '') +
        (suspicious > 0 && unresolved > 0 ? ' · ' : '') +
        (unresolved > 0 ? unresolved + ' unresolved' : '');
      const suspEl = document.getElementById('catalog-suspicious');
      suspEl.innerHTML = suspicious > 0
        ? '<div class="warn-banner" style="background:#2a1a1a;border-color:#f85149;color:#f85149;margin-bottom:8px">⛔ ' + suspicious + ' suspicious process' + (suspicious > 1 ? 'es' : '') + ' detected — unknown origin with external network connections. Review immediately.</div>'
        : '';
      const unresEl = document.getElementById('catalog-unresolved');
      if (unresolved > 0) {
        unresEl.innerHTML = '<div style="color:#f0883e;font-size:11px;margin-bottom:6px">⚠ ' + unresolved + ' unrecognized process' + (unresolved > 1 ? 'es' : '') + ' being observed (no actions taken)</div>';
      } else { unresEl.innerHTML = ''; }
    }

    function render(d) {
      document.getElementById('profile').textContent = d.active_profile || '—';
      document.getElementById('ts').textContent = new Date(d.timestamp).toLocaleTimeString();
      document.getElementById('last-upd').textContent = 'updated ' + new Date().toLocaleTimeString();

      const cpu = Math.round(d.cpu_percent || 0);
      document.getElementById('cpu-val').textContent = cpu + '%';
      document.getElementById('cpu-bar').style.width = Math.min(cpu, 100) + '%';

      const used = Math.round(d.memory_mb_used || 0);
      const avail = Math.round(d.memory_mb_available || 0);
      const total = used + avail;
      const pct = total > 0 ? Math.round(used / total * 100) : 0;
      const fpct = total > 0 ? Math.round(avail / total * 100) : 0;

      document.getElementById('mem-val').textContent = used + ' MB';
      const mb = document.getElementById('mem-bar');
      mb.style.width = pct + '%';
      mb.className = 'bar bar-mem' + (pct > 90 ? ' crit' : pct > 75 ? ' warn' : '');

      document.getElementById('free-val').textContent = avail + ' MB';
      document.getElementById('free-bar').style.width = fpct + '%';

      const elevated = d.isElevated;
      document.getElementById('warn-banner').style.display = elevated === false ? '' : 'none';
      document.getElementById('elev-badge').style.display  = elevated === false ? '' : 'none';

      const bt = d.browser_tabs;
      const bsec = document.getElementById('browser-section');
      if (bt && bt.enabled) {
        bsec.style.display = '';
        const badge = document.getElementById('cdp-badge');
        badge.className = 'badge ' + (bt.connected ? 'cdp-ok' : 'cdp-off');
        badge.textContent = bt.connected ? 'CDP ✓' : 'CDP ✕';

        currentTabs = bt.tabs || [];
        const susp = currentTabs.filter(t => t.suspended);
        const act  = currentTabs.filter(t => !t.suspended);

        document.getElementById('tab-summary').innerHTML =
          chip('Active',     act.length) +
          chip('Suspended',  susp.length) +
          chip('Saved',      (bt.memory_recovered_mb || 0) + ' MB');

        document.getElementById('tab-actions').innerHTML =
          '<button class="btn btn-orange" onclick="suspendAll()">⏸ Suspend Inactive</button>' +
          '<button class="btn btn-green"  onclick="restoreAll()">▶ Restore All</button>';

        const listEl = document.getElementById('tab-list');
        if (currentTabs.length === 0) {
          listEl.innerHTML = '<div class="empty">No tabs — connect Brave with --remote-debugging-port</div>';
        } else {
          listEl.innerHTML = '<div class="tab-list">' + currentTabs.map(t => {
            const dotCls = t.suspended ? 'dot dot-off' : 'dot dot-on';
            const age = t.suspended ? '<span class="tab-age">' + (t.suspended_ago_min || 0) + 'm</span>' : '';
            const btn = t.suspended
              ? '<button class="btn btn-green" style="font-size:10px" onclick="restoreTab(\'' + escId(t.id) + '\')">▶ Restore</button>'
              : '<button class="btn btn-orange" style="font-size:10px" onclick="suspendTab(\'' + escId(t.id) + '\')">⏸ Suspend</button>';
            return '<div class="tab-row"><div class="' + dotCls + '"></div><div class="tab-title">' + esc(t.title || '(untitled)') + '</div>' + age + btn + '</div>';
          }).join('') + '</div>';
        }
      } else {
        bsec.style.display = 'none';
      }

      const procs = (d.processes || []).sort((a, b) => b.memory_mb - a.memory_mb).slice(0, 12);
      const procEl = document.getElementById('proc-list');
      if (procs.length === 0) {
        procEl.innerHTML = '<div class="empty">No process data</div>';
      } else {
        procEl.innerHTML = '<div class="proc-list">' + procs.map(p =>
          '<div class="proc-row">' +
          '<div class="proc-name">' + esc(p.name) + '</div>' +
          '<div class="proc-stat ' + (p.cpu_percent > 30 ? 'hot' : '') + '">' + p.cpu_percent.toFixed(1) + '% cpu</div>' +
          '<div class="proc-stat ' + (p.memory_mb > 800 ? 'hot' : '') + '">' + Math.round(p.memory_mb) + ' MB</div>' +
          '</div>'
        ).join('') + '</div>';
      }
      renderCatalog(d);
      renderDisk(d);
      renderNetwork(d);
      renderGpu(d);
      renderSysExt(d);
      renderProcessTree(d);
    }

    function chip(label, value) {
      return '<div class="chip"><span class="chip-label">' + label + '</span><span class="chip-value">' + value + '</span></div>';
    }
    function escId(id) { return id.replace(/'/g, "\\'"); }

    function fmtBytes(b) {
      if (b >= 1048576) return (b / 1048576).toFixed(1) + ' MB/s';
      if (b >= 1024)    return (b / 1024).toFixed(1) + ' KB/s';
      return b + ' B/s';
    }
    function fmtUptime(sec) {
      const d = Math.floor(sec / 86400);
      const h = Math.floor((sec % 86400) / 3600);
      const m = Math.floor((sec % 3600) / 60);
      return (d > 0 ? d + 'd ' : '') + h + 'h ' + m + 'm';
    }

    function renderDisk(d) {
      const ds = d.disk_stats;
      const sec = document.getElementById('disk-section');
      if (!ds || (!ds.drives.length && !ds.physical_disks.length)) { sec.style.display = 'none'; return; }
      sec.style.display = '';
      const driveEl = document.getElementById('disk-list');
      if (ds.drives.length === 0) {
        driveEl.innerHTML = '';
      } else {
        driveEl.innerHTML = '<div class="disk-list">' + ds.drives.map(dr => {
          const pct = dr.size_gb > 0 ? Math.round((dr.free_gb / dr.size_gb) * 100) : 0;
          const queueHot = dr.queue_depth > 1;
          const qDot = '<span class="disk-queue-dot" style="background:' + (queueHot ? '#f85149' : '#3fb950') + '" title="Queue: ' + dr.queue_depth.toFixed(1) + '"></span>';
          return '<div class="disk-row">' +
            '<div class="disk-header">' +
              '<span><span class="disk-letter">' + esc(dr.letter) + '</span>' +
              (dr.label ? '<span class="disk-label">' + esc(dr.label) + '</span>' : '') + qDot + '</span>' +
              '<span style="font-size:11px;color:#6e7681">' + dr.free_gb.toFixed(1) + ' / ' + dr.size_gb.toFixed(1) + ' GB free</span>' +
            '</div>' +
            '<div class="bar-bg" style="margin-bottom:4px"><div class="bar" style="width:' + pct + '%;background:#58a6ff"></div></div>' +
            '<div class="disk-io">'+
              '<span>↓ <span class="' + (dr.read_bytes_sec > 50*1024*1024 ? 'hot' : '') + '">' + fmtBytes(dr.read_bytes_sec) + '</span></span>' +
              '<span>↑ <span class="' + (dr.write_bytes_sec > 50*1024*1024 ? 'hot' : '') + '">' + fmtBytes(dr.write_bytes_sec) + '</span></span>' +
            '</div>' +
          '</div>';
        }).join('') + '</div>';
      }
      const pdiskEl = document.getElementById('pdisk-list');
      if (!ds.physical_disks || ds.physical_disks.length === 0) { pdiskEl.innerHTML = ''; return; }
      pdiskEl.innerHTML = '<div class="disk-list">' + ds.physical_disks.map(pd => {
        const hc = pd.health_status === 'Healthy' ? 'health-healthy' : pd.health_status === 'Warning' ? 'health-warning' : pd.health_status === 'Unhealthy' ? 'health-unhealthy' : 'health-unknown';
        return '<div class="pdisk-row">' +
          '<span class="pdisk-name">' + esc(pd.friendly_name) + '</span>' +
          '<span class="pdisk-type">' + esc(pd.media_type) + '</span>' +
          '<span class="pdisk-size">' + pd.size_gb.toFixed(0) + ' GB</span>' +
          '<span class="health-badge ' + hc + '">' + esc(pd.health_status) + '</span>' +
        '</div>';
      }).join('') + '</div>';
    }

    function renderNetwork(d) {
      const ns = d.network_stats;
      const sec = document.getElementById('network-section');
      if (!ns || !ns.adapters.length) { sec.style.display = 'none'; return; }
      const visible = ns.adapters.filter(a => a.bytes_sent_sec > 0 || a.bytes_recv_sec > 0 || a.status === 'Up');
      if (!visible.length) { sec.style.display = 'none'; return; }
      sec.style.display = '';
      document.getElementById('net-list').innerHTML = '<div class="net-list">' + visible.map(a => {
        const stCls = a.status === 'Up' ? 'status-up' : 'status-down';
        return '<div class="net-row">' +
          '<div class="net-name">' + esc(a.name) + ' <span class="' + stCls + '" style="font-size:10px">' + esc(a.status) + '</span>' +
          (a.link_speed_mbps > 0 ? ' <span style="color:#6e7681;font-size:10px">' + a.link_speed_mbps + ' Mbps</span>' : '') + '</div>' +
          '<div class="net-stats">' +
            '<span>↓ <span class="val">' + fmtBytes(a.bytes_recv_sec) + '</span></span>' +
            '<span>↑ <span class="val">' + fmtBytes(a.bytes_sent_sec) + '</span></span>' +
            '<span>pkt ↓<span class="val">' + a.packets_recv_sec + '</span> ↑<span class="val">' + a.packets_sent_sec + '</span></span>' +
          '</div>' +
        '</div>';
      }).join('') + '</div>';
    }

    function renderGpu(d) {
      const gs = d.gpu_stats;
      const sec = document.getElementById('gpu-section');
      if (!gs || !gs.available) { sec.style.display = 'none'; return; }
      sec.style.display = '';
      const srcBadge = gs.source === 'nvidia-smi'
        ? '<span class="gpu-source src-nvidia">nvidia-smi</span>'
        : gs.source === 'wmi' ? '<span class="gpu-source src-wmi">WMI</span>' : '';
      document.getElementById('gpu-source-badge').innerHTML = srcBadge;
      document.getElementById('gpu-sub').textContent = gs.gpus.length + ' device' + (gs.gpus.length !== 1 ? 's' : '');
      document.getElementById('gpu-list').innerHTML = '<div class="disk-list">' + gs.gpus.map((g, i) => {
        const vramPct = g.vram_total_mb > 0 ? Math.round(g.vram_used_mb / g.vram_total_mb * 100) : 0;
        return '<div class="gpu-row">' +
          (g.name ? '<div class="gpu-name">' + esc(g.name) + '</div>' : '<div class="gpu-name">GPU ' + i + '</div>') +
          '<div class="gpu-metrics">' +
            '<span>GPU <span class="val">' + g.gpu_util_percent.toFixed(0) + '%</span></span>' +
            '<span>VRAM <span class="val">' + g.vram_used_mb.toFixed(0) + ' / ' + g.vram_total_mb.toFixed(0) + ' MB (' + vramPct + '%)</span></span>' +
            (g.temp_celsius > 0 ? '<span>Temp <span class="val ' + (g.temp_celsius > 85 ? 'crit' : g.temp_celsius > 70 ? 'warn' : '') + '">' + g.temp_celsius.toFixed(0) + '°C</span></span>' : '') +
            (g.power_watts > 0 ? '<span>Power <span class="val">' + g.power_watts.toFixed(0) + 'W</span></span>' : '') +
          '</div>' +
        '</div>';
      }).join('') + '</div>';
    }

    function renderSysExt(d) {
      const se = d.system_extended;
      const sec = document.getElementById('sysext-section');
      if (!se) { sec.style.display = 'none'; return; }
      sec.style.display = '';
      const dpcCls   = se.dpc_rate > 5000 ? ' crit' : '';
      const faultCls = se.page_faults_sec > 100 ? ' warn' : '';
      document.getElementById('sysext-grid').innerHTML =
        '<div class="sys-grid">' +
          '<div class="sys-cell"><div class="sys-cell-label">DPC Rate</div><div class="sys-cell-val' + dpcCls + '">' + se.dpc_rate.toLocaleString() + '</div></div>' +
          '<div class="sys-cell"><div class="sys-cell-label">Interrupts/s</div><div class="sys-cell-val' + dpcCls + '">' + se.interrupt_rate.toLocaleString() + '</div></div>' +
          '<div class="sys-cell"><div class="sys-cell-label">Page Faults/s</div><div class="sys-cell-val' + faultCls + '">' + se.page_faults_sec.toLocaleString() + '</div></div>' +
          '<div class="sys-cell"><div class="sys-cell-label">Uptime</div><div class="sys-cell-val">' + fmtUptime(se.uptime_sec) + '</div></div>' +
        '</div>';
    }

    let treeOpen = false;
    function renderProcessTree(d) {
      const pt = d.process_tree;
      const sec = document.getElementById('proctree-section');
      if (!pt || !pt.length) { sec.style.display = 'none'; return; }
      sec.style.display = '';
      const pidMap = {};
      pt.forEach(p => { pidMap[p.pid] = p; });
      const childMap = {};
      pt.forEach(p => {
        if (!childMap[p.parent_pid]) childMap[p.parent_pid] = [];
        childMap[p.parent_pid].push(p);
      });
      const roots = pt.filter(p => !pidMap[p.parent_pid] || p.parent_pid === p.pid);
      const rows = [];
      function walk(node, depth) {
        rows.push({ node, depth });
        (childMap[node.pid] || []).sort((a,b) => b.memory_mb - a.memory_mb).forEach(c => walk(c, depth + 1));
      }
      roots.sort((a,b) => b.memory_mb - a.memory_mb).forEach(r => walk(r, 0));
      const bodyHtml = rows.map(({node, depth}) => {
        const indent = depth > 0 ? '<span class="tree-indent">' + '  '.repeat(depth) + '└ </span>' : '';
        return '<div class="tree-node">' + indent +
          '<span class="tree-name">' + esc(node.name) + '</span>' +
          '<span class="tree-mem">' + node.memory_mb.toFixed(0) + ' MB</span>' +
          '<span class="tree-pid">' + node.pid + '</span>' +
        '</div>';
      }).join('');
      document.getElementById('proctree-container').innerHTML =
        '<div class="tree-container">' +
          '<button class="tree-toggle" onclick="toggleTree()">' +
            (treeOpen ? '▾' : '▸') + ' ' + pt.length + ' processes — click to ' + (treeOpen ? 'collapse' : 'expand') +
          '</button>' +
          '<div class="tree-body' + (treeOpen ? ' open' : '') + '" id="tree-body">' + bodyHtml + '</div>' +
        '</div>';
    }
    function toggleTree() {
      treeOpen = !treeOpen;
      const body = document.getElementById('tree-body');
      if (body) body.className = 'tree-body' + (treeOpen ? ' open' : '');
      const btn = document.querySelector('.tree-toggle');
      if (btn) {
        const count = (btn.textContent.match(/\d+/) || ['?'])[0];
        btn.textContent = (treeOpen ? '▾' : '▸') + ' ' + count + ' processes — click to ' + (treeOpen ? 'collapse' : 'expand');
      }
    }

    async function refresh() {
      try {
        const r = await fetch('/status');
        if (r.ok) render(await r.json());
      } catch (_) {
        document.getElementById('ts').textContent = 'connection error — retrying';
      }
    }

    refresh();
    setInterval(refresh, 2000);
  </script>
</body>
</html>`;
}
