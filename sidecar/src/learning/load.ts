// ============================================================
// AEGIS Cognitive Load Score
// One number. Zero to one hundred.
// Computed from weighted stress signals.
// Weights start equal and are learned from feedback over time.
// ============================================================

import { getLogger } from '../logger/index.js'
import type { SystemSnapshot } from '../config/types.js'
import type { LearningStore } from './store.js'

// ============================================================
// Types
// ============================================================

export interface LoadWeights {
  cpu: number
  memory: number
  disk_queue: number
  dpc_rate: number
  runaway_count: number
  tab_pressure: number
}

export interface LoadBreakdown {
  score: number              // 0-100 composite
  cpu_pressure: number       // 0-1 normalized component
  memory_pressure: number
  disk_queue_pressure: number
  dpc_pressure: number
  runaway_pressure: number
  tab_pressure: number
  weights: LoadWeights
}

// Default equal weights — all components contribute equally
const DEFAULT_WEIGHTS: LoadWeights = {
  cpu: 1.0,
  memory: 1.0,
  disk_queue: 1.0,
  dpc_rate: 1.0,
  runaway_count: 1.0,
  tab_pressure: 1.0,
}

// Normalization reference values — what "100%" looks like per signal
const NORM = {
  cpu: 100,           // % CPU
  memory: 95,         // % RAM used
  disk_queue: 8,      // queue depth (saturated disk)
  dpc_rate: 10000,    // DPCs/sec (very high)
  runaway_count: 5,   // 5 runaways = max pressure
  tab_pressure: 20,   // 20 unsuspended tabs = max
}

// ============================================================
// CognitiveLoadEngine
// ============================================================

export class CognitiveLoadEngine {
  private weights: LoadWeights
  private store: LearningStore
  private lastScore = 0
  private logger = getLogger()

  constructor(store: LearningStore) {
    this.store = store
    this.weights = { ...DEFAULT_WEIGHTS }
  }

  compute(snapshot: SystemSnapshot, activeWatches: number): LoadBreakdown {
    // Normalize each signal to 0-1
    const cpuP = Math.min(1, (snapshot.cpu_percent ?? 0) / NORM.cpu)

    const memUsed = snapshot.memory_mb_used ?? 0
    const memAvail = snapshot.memory_mb_available ?? 0
    const memTotal = memUsed + memAvail
    const memP = memTotal > 0 ? Math.min(1, memUsed / memTotal / (NORM.memory / 100)) : 0

    const dq = snapshot.disk_stats?.drives.reduce((max, d) => Math.max(max, d.queue_depth ?? 0), 0) ?? 0
    const diskP = Math.min(1, dq / NORM.disk_queue)

    const dpc = snapshot.system_extended?.dpc_rate ?? 0
    const dpcP = Math.min(1, dpc / NORM.dpc_rate)

    const runaways = activeWatches
    const runP = Math.min(1, runaways / NORM.runaway_count)

    const tabs = snapshot.browser_tabs?.active ?? 0
    const tabP = Math.min(1, tabs / NORM.tab_pressure)

    // Weighted sum
    const w = this.weights
    const totalWeight = w.cpu + w.memory + w.disk_queue + w.dpc_rate + w.runaway_count + w.tab_pressure
    const rawScore =
      (cpuP * w.cpu +
       memP * w.memory +
       diskP * w.disk_queue +
       dpcP * w.dpc_rate +
       runP * w.runaway_count +
       tabP * w.tab_pressure) / totalWeight

    const score = Math.round(rawScore * 100)
    this.lastScore = score

    return {
      score,
      cpu_pressure: cpuP,
      memory_pressure: memP,
      disk_queue_pressure: diskP,
      dpc_pressure: dpcP,
      runaway_pressure: runP,
      tab_pressure: tabP,
      weights: { ...this.weights },
    }
  }

  getLastScore(): number {
    return this.lastScore
  }

  getWeights(): LoadWeights {
    return { ...this.weights }
  }

  // Called after enough data accumulates (30+ days) — adjust weights
  // based on correlation of each signal with negative feedback outcomes.
  // Currently a stub — weight tuning is Phase 2 after data exists.
  tuneWeights(): void {
    this.logger.info('Weight tuning not yet available — insufficient data')
  }

  // Tray icon color tier
  static getTier(score: number): 'green' | 'amber' | 'red' {
    if (score <= 33) return 'green'
    if (score <= 66) return 'amber'
    return 'red'
  }
}
