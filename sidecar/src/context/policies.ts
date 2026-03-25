import { getLogger } from '../logger/index.js'
import type { ContextName } from './engine.js'

// ============================================================
// Policy Types
// ============================================================

export type PolicyDomain =
  | 'browser'       // tab suspension behaviour
  | 'cpu'           // process priority overrides
  | 'memory'        // trim/purge behaviour
  | 'services'      // service stop/start
  | 'network'       // QoS rules
  | 'watchdog'      // runaway detection thresholds

export interface ProcessPriorityRule {
  name: string                // process name pattern (substring match)
  cpu_priority: string
  io_priority: string
  memory_priority: string
}

export interface ServiceRule {
  name: string
  action: 'stop' | 'start'
}

export interface BrowserPolicyRule {
  enabled: boolean
  inactivity_threshold_min: number
  memory_pressure_threshold_mb: number
}

export interface Policy {
  id: string
  name: string
  description: string
  domain: PolicyDomain
  // Domain-specific rule payloads
  browser?: BrowserPolicyRule
  cpu_rules?: ProcessPriorityRule[]
  service_rules?: ServiceRule[]
  // Metadata
  created_at: string
  is_overlay: boolean          // true = temporary, auto-pops when trigger clears
  trigger_context?: ContextName  // context that auto-applied this policy
  expires_at?: number          // epoch ms, for timed overlays
}

export interface PolicyStack {
  base: Policy[]               // always-active policies
  overlays: Policy[]           // temporary on top of base
}

// ============================================================
// Built-in base policies (seeded on first run)
// ============================================================

export const BUILTIN_POLICIES: Policy[] = [
  {
    id: 'browser-default',
    name: 'Browser Tab Management',
    description: 'Suspend inactive Brave tabs after 20 minutes',
    domain: 'browser',
    browser: { enabled: true, inactivity_threshold_min: 20, memory_pressure_threshold_mb: 500 },
    created_at: new Date().toISOString(),
    is_overlay: false,
  },
  {
    id: 'searchindexer-throttle',
    name: 'SearchIndexer Throttle',
    description: 'Keep SearchIndexer at idle priority always',
    domain: 'cpu',
    cpu_rules: [{ name: 'searchindexer', cpu_priority: 'idle', io_priority: 'background', memory_priority: 'idle' }],
    created_at: new Date().toISOString(),
    is_overlay: false,
  },
  {
    id: 'diagtrack-throttle',
    name: 'Telemetry Throttle',
    description: 'Keep DiagTrack at idle priority always',
    domain: 'cpu',
    cpu_rules: [{ name: 'diagtrack', cpu_priority: 'idle', io_priority: 'background', memory_priority: 'idle' }],
    created_at: new Date().toISOString(),
    is_overlay: false,
  },
]

export const CONTEXT_OVERLAY_TEMPLATES: Record<ContextName, Policy[]> = {
  deep_work: [
    {
      id: 'overlay-deepwork-browser',
      name: 'Deep Work: Aggressive Tab Suspension',
      description: 'Suspend inactive tabs after 5 minutes during deep work',
      domain: 'browser',
      browser: { enabled: true, inactivity_threshold_min: 5, memory_pressure_threshold_mb: 200 },
      created_at: new Date().toISOString(),
      is_overlay: true,
      trigger_context: 'deep_work',
    },
    {
      id: 'overlay-deepwork-services',
      name: 'Deep Work: Stop Background Services',
      description: 'Stop SearchIndexer and DiagTrack during deep work',
      domain: 'services',
      service_rules: [
        { name: 'WSearch', action: 'stop' },
        { name: 'DiagTrack', action: 'stop' },
      ],
      created_at: new Date().toISOString(),
      is_overlay: true,
      trigger_context: 'deep_work',
    },
  ],
  build: [
    {
      id: 'overlay-build-cpu',
      name: 'Build: Elevate Node/Compiler Priority',
      description: 'Boost build tools to above_normal, throttle everything else',
      domain: 'cpu',
      cpu_rules: [
        { name: 'node', cpu_priority: 'above_normal', io_priority: 'high', memory_priority: 'above_normal' },
        { name: 'tsc', cpu_priority: 'above_normal', io_priority: 'high', memory_priority: 'above_normal' },
        { name: 'cargo', cpu_priority: 'above_normal', io_priority: 'high', memory_priority: 'above_normal' },
        { name: 'msbuild', cpu_priority: 'above_normal', io_priority: 'high', memory_priority: 'above_normal' },
        { name: 'searchindexer', cpu_priority: 'idle', io_priority: 'background', memory_priority: 'idle' },
        { name: 'sysmain', cpu_priority: 'idle', io_priority: 'background', memory_priority: 'idle' },
      ],
      created_at: new Date().toISOString(),
      is_overlay: true,
      trigger_context: 'build',
    },
  ],
  meeting: [
    {
      id: 'overlay-meeting-browser',
      name: 'Meeting: Suspend All Non-Essential Tabs',
      description: 'Suspend all browser tabs except whitelisted during meetings',
      domain: 'browser',
      browser: { enabled: true, inactivity_threshold_min: 1, memory_pressure_threshold_mb: 100 },
      created_at: new Date().toISOString(),
      is_overlay: true,
      trigger_context: 'meeting',
    },
  ],
  research: [],
  media: [],
  gaming: [
    {
      id: 'overlay-gaming-services',
      name: 'Gaming: Stop Background Services',
      description: 'Stop non-essential services during gaming sessions',
      domain: 'services',
      service_rules: [
        { name: 'WSearch', action: 'stop' },
        { name: 'SysMain', action: 'stop' },
        { name: 'DiagTrack', action: 'stop' },
      ],
      created_at: new Date().toISOString(),
      is_overlay: true,
      trigger_context: 'gaming',
    },
  ],
  idle: [],
  unknown: [],
}

// ============================================================
// PolicyManager
// ============================================================

export class PolicyManager {
  private stack: PolicyStack = { base: [], overlays: [] }
  private logger = getLogger()
  private changeListeners: Array<(stack: PolicyStack) => void> = []

  constructor() {
    this.stack.base = [...BUILTIN_POLICIES]
  }

  getStack(): PolicyStack {
    return {
      base: [...this.stack.base],
      overlays: [...this.stack.overlays],
    }
  }

  getActive(): Policy[] {
    return [...this.stack.base, ...this.stack.overlays]
  }

  // Called when context changes — push/pop overlay templates
  applyContextOverlays(context: ContextName): void {
    // Remove existing context overlays
    this.stack.overlays = this.stack.overlays.filter((o) => !o.is_overlay || o.trigger_context === context)

    // Pop any overlays from previous contexts
    this.stack.overlays = this.stack.overlays.filter((o) => o.trigger_context === context)

    // Push new overlays for this context
    const templates = CONTEXT_OVERLAY_TEMPLATES[context] ?? []
    for (const tmpl of templates) {
      const exists = this.stack.overlays.some((o) => o.id === tmpl.id)
      if (!exists) {
        this.stack.overlays.push({ ...tmpl, created_at: new Date().toISOString() })
      }
    }

    this.logger.info('Context overlays applied', {
      context,
      overlayCount: this.stack.overlays.length,
      overlayIds: this.stack.overlays.map((o) => o.id),
    })

    this.notifyListeners()
  }

  pushOverlay(policy: Policy): void {
    this.stack.overlays = this.stack.overlays.filter((o) => o.id !== policy.id)
    this.stack.overlays.push({ ...policy, is_overlay: true })
    this.logger.info('Overlay pushed', { id: policy.id })
    this.notifyListeners()
  }

  popOverlay(id: string): void {
    this.stack.overlays = this.stack.overlays.filter((o) => o.id !== id)
    this.logger.info('Overlay popped', { id })
    this.notifyListeners()
  }

  addBasePolicy(policy: Policy): void {
    this.stack.base = this.stack.base.filter((p) => p.id !== policy.id)
    this.stack.base.push({ ...policy, is_overlay: false })
    this.notifyListeners()
  }

  removeBasePolicy(id: string): void {
    this.stack.base = this.stack.base.filter((p) => p.id !== id)
    this.notifyListeners()
  }

  // Expire timed overlays
  pruneExpired(): void {
    const now = Date.now()
    const before = this.stack.overlays.length
    this.stack.overlays = this.stack.overlays.filter((o) => !o.expires_at || o.expires_at > now)
    if (this.stack.overlays.length !== before) {
      this.logger.info('Expired overlays pruned')
      this.notifyListeners()
    }
  }

  onStackChanged(listener: (stack: PolicyStack) => void): void {
    this.changeListeners.push(listener)
  }

  private notifyListeners(): void {
    const stack = this.getStack()
    for (const l of this.changeListeners) {
      try { l(stack) } catch (_) { /* */ }
    }
  }
}
