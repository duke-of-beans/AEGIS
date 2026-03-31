// ============================================================
// AEGIS Cognitive Load Score
// One number. Zero to one hundred.
// Computed from weighted stress signals.
// ============================================================

import { getLogger } from '../logger/index.js'
import type { LearningStore } from './store.js'

export interface LoadWeights {
  cpu: number
  memory: number
  disk_queue: number
  dpc_rate: number
  runaway_count: number
  tab_pressure: number
}

export interface LoadBreakdown {
  score: number
  cpu_pressure: number
  memory_pressure: number
  disk_queue_pressure: number
  dpc_pressure: number
  runaway_pressure: number
  tab_pressure: number
  weights: LoadWeights
}

// Minimal snapshot shape used by compute() — avoids importing deleted types.ts
interface SystemSnapshotMinimal {
  cpu_percent?: number
  memory_mb_used?: number
  memory_mb_available?: number
  disk_stats?: { drives: Array<{ queue_depth?: number }> }
  system_extended?: { dpc_rate?: number }
  browser_tabs?: { active?: number }
}

const DEFAULT_WEIGHTS: LoadWeights = {
  cpu: 1.0, memory: 1.0, disk_queue: 1.0,
  dpc_rate: 1.0, runaway_count: 1.0, tab_pressure: 1.0,
}

const NORM = {
  cpu: 100, memory: 95, disk_queue: 8,
  dpc_rate: 10000, runaway_count: 5, tab_pressure: 20,
}

export class CognitiveLoadEngine {
  private weights: LoadWeights
  private store: LearningStore | null
  private lastScore = 0
  private logger = getLogger()

  constructor(store?: LearningStore) {
    this.store = store ?? null
    this.weights = { ...DEFAULT_WEIGHTS }
  }

  update(cpuPercent: number, memPercent: number, context: string): void {
    const contextLoad = (context === 'idle' || context === 'unknown') ? 0 : 20
    const raw = (cpuPercent * 0.5) + (memPercent * 0.3) + contextLoad
    this.lastScore = Math.round(Math.min(100, Math.max(0, raw)))
  }

  getScore(): number {
    return this.lastScore
  }

  computeLoad(): { score: number; tier: 'green' | 'amber' | 'red'; cpu_pressure: number; memory_pressure: number; disk_queue_pressure: number; dpc_pressure: number } {
    const score = this.lastScore
    return {
      score,
      tier: CognitiveLoadEngine.getTier(score),
      cpu_pressure: 0,
      memory_pressure: 0,
      disk_queue_pressure: 0,
      dpc_pressure: 0,
    }
  }

  compute(snapshot: SystemSnapshotMinimal, activeWatches: number): LoadBreakdown {
    const cpuP = Math.min(1, (snapshot.cpu_percent ?? 0) / NORM.cpu)
    const memUsed = snapshot.memory_mb_used ?? 0
    const memAvail = snapshot.memory_mb_available ?? 0
    const memTotal = memUsed + memAvail
    const memP = memTotal > 0 ? Math.min(1, memUsed / memTotal / (NORM.memory / 100)) : 0
    const dq = snapshot.disk_stats?.drives.reduce((max: number, d: { queue_depth?: number }) => Math.max(max, d.queue_depth ?? 0), 0) ?? 0
    const diskP = Math.min(1, dq / NORM.disk_queue)
    const dpc = snapshot.system_extended?.dpc_rate ?? 0
    const dpcP = Math.min(1, dpc / NORM.dpc_rate)
    const runP = Math.min(1, activeWatches / NORM.runaway_count)
    const tabs = snapshot.browser_tabs?.active ?? 0
    const tabP = Math.min(1, tabs / NORM.tab_pressure)
    const w = this.weights
    const totalWeight = w.cpu + w.memory + w.disk_queue + w.dpc_rate + w.runaway_count + w.tab_pressure
    const rawScore = (cpuP * w.cpu + memP * w.memory + diskP * w.disk_queue + dpcP * w.dpc_rate + runP * w.runaway_count + tabP * w.tab_pressure) / totalWeight
    const score = Math.round(rawScore * 100)
    this.lastScore = score
    return { score, cpu_pressure: cpuP, memory_pressure: memP, disk_queue_pressure: diskP, dpc_pressure: dpcP, runaway_pressure: runP, tab_pressure: tabP, weights: { ...this.weights } }
  }

  getLastScore(): number { return this.lastScore }
  getWeights(): LoadWeights { return { ...this.weights } }
  tuneWeights(): void { this.logger.info('Weight tuning not yet available') }
  static getTier(score: number): 'green' | 'amber' | 'red' {
    if (score < 40) return 'green'
    if (score < 70) return 'amber'
    return 'red'
  }
}
