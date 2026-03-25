// ============================================================
// AEGIS Baseline Engine
// Builds per-process behavioral fingerprints over time.
// Deviation detection uses personal baselines, not absolute thresholds.
// "node.exe is 3.2x above its personal baseline for this context" — not "node.exe is at 40%"
// ============================================================

import Database from 'better-sqlite3'
import { existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { getLogger } from '../logger/index.js'
import type { ContextName } from '../context/engine.js'

// ============================================================
// Types
// ============================================================

export interface ProcessSample {
  name: string
  cpu_percent: number
  memory_mb: number
  handle_count: number
  io_read_bytes_sec: number
  io_write_bytes_sec: number
  context: ContextName
  timestamp: number  // epoch ms
}

export interface ProcessBaseline {
  name: string
  context: ContextName
  cpu_mean: number
  cpu_stddev: number
  memory_mean: number
  memory_stddev: number
  handle_mean: number
  sample_count: number
  last_updated: string
}

export interface DeviationReport {
  name: string
  context: ContextName
  cpu_ratio: number      // current / mean — e.g. 3.2x
  memory_ratio: number
  handle_ratio: number
  cpu_zscore: number     // (current - mean) / stddev
  memory_zscore: number
  max_zscore: number     // worst axis
  sample_count: number   // how many samples baseline is based on
  baseline_reliable: boolean  // false if sample_count < MIN_SAMPLES
}

// Minimum samples before we trust the baseline enough to act on it
const MIN_SAMPLES = 20

// Z-score threshold for flagging deviation (2 stddevs above mean)
export const DEVIATION_ZSCORE_THRESHOLD = 2.0

// ============================================================
// BaselineEngine
// ============================================================

export class BaselineEngine {
  private db: Database.Database
  private logger = getLogger()
  private sampleBuffer: ProcessSample[] = []
  private flushIntervalId: ReturnType<typeof setInterval> | null = null

  constructor(dbPath: string) {
    const dir = dirname(dbPath)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.initSchema()
    this.logger.info('BaselineEngine initialized', { dbPath })
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS process_samples (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        context TEXT NOT NULL,
        cpu_percent REAL NOT NULL,
        memory_mb REAL NOT NULL,
        handle_count REAL NOT NULL,
        io_read_bytes_sec REAL NOT NULL,
        io_write_bytes_sec REAL NOT NULL,
        sampled_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS process_baselines (
        name TEXT NOT NULL,
        context TEXT NOT NULL,
        cpu_mean REAL NOT NULL DEFAULT 0,
        cpu_stddev REAL NOT NULL DEFAULT 0,
        cpu_m2 REAL NOT NULL DEFAULT 0,
        memory_mean REAL NOT NULL DEFAULT 0,
        memory_stddev REAL NOT NULL DEFAULT 0,
        memory_m2 REAL NOT NULL DEFAULT 0,
        handle_mean REAL NOT NULL DEFAULT 0,
        handle_stddev REAL NOT NULL DEFAULT 0,
        handle_m2 REAL NOT NULL DEFAULT 0,
        sample_count INTEGER NOT NULL DEFAULT 0,
        last_updated TEXT NOT NULL,
        PRIMARY KEY (name, context)
      );

      CREATE INDEX IF NOT EXISTS idx_samples_name_ctx
        ON process_samples(name, context, sampled_at);
    `)
  }

  start(): void {
    // Flush sample buffer to DB every 30s
    this.flushIntervalId = setInterval(() => this.flush(), 30_000)
  }

  stop(): void {
    if (this.flushIntervalId !== null) {
      clearInterval(this.flushIntervalId)
      this.flushIntervalId = null
    }
    this.flush()
    this.db.close()
  }

  // Record a process observation — buffered for batch insert
  record(sample: ProcessSample): void {
    this.sampleBuffer.push(sample)
    // Update Welford online variance incrementally
    this.updateBaseline(sample)
    // Flush buffer if it gets large
    if (this.sampleBuffer.length >= 100) this.flush()
  }

  // Compute deviation report for a process vs its baseline
  getDeviation(
    name: string,
    context: ContextName,
    currentCpu: number,
    currentMemory: number,
    currentHandles: number
  ): DeviationReport | null {
    const normalized = name.toLowerCase().replace(/\.exe$/i, '')
    const row = this.db
      .prepare('SELECT * FROM process_baselines WHERE name = ? AND context = ?')
      .get(normalized, context) as BaselineRow | undefined

    if (row === undefined) return null

    const cpuRatio = row.cpu_mean > 0 ? currentCpu / row.cpu_mean : 1
    const memRatio = row.memory_mean > 0 ? currentMemory / row.memory_mean : 1
    const handleRatio = row.handle_mean > 0 ? currentHandles / row.handle_mean : 1

    const cpuZ = row.cpu_stddev > 0 ? (currentCpu - row.cpu_mean) / row.cpu_stddev : 0
    const memZ = row.memory_stddev > 0 ? (currentMemory - row.memory_mean) / row.memory_stddev : 0

    return {
      name: normalized,
      context,
      cpu_ratio: cpuRatio,
      memory_ratio: memRatio,
      handle_ratio: handleRatio,
      cpu_zscore: cpuZ,
      memory_zscore: memZ,
      max_zscore: Math.max(cpuZ, memZ),
      sample_count: row.sample_count,
      baseline_reliable: row.sample_count >= MIN_SAMPLES,
    }
  }

  getBaseline(name: string, context: ContextName): ProcessBaseline | null {
    const normalized = name.toLowerCase().replace(/\.exe$/i, '')
    const row = this.db
      .prepare('SELECT * FROM process_baselines WHERE name = ? AND context = ?')
      .get(normalized, context) as BaselineRow | undefined
    if (!row) return null
    return {
      name: normalized,
      context,
      cpu_mean: row.cpu_mean,
      cpu_stddev: row.cpu_stddev,
      memory_mean: row.memory_mean,
      memory_stddev: row.memory_stddev,
      handle_mean: row.handle_mean,
      sample_count: row.sample_count,
      last_updated: row.last_updated,
    }
  }

  // ── Private ──────────────────────────────────────────────

  private updateBaseline(sample: ProcessSample): void {
    const normalized = sample.name.toLowerCase().replace(/\.exe$/i, '')
    const now = new Date().toISOString()

    const existing = this.db
      .prepare('SELECT * FROM process_baselines WHERE name = ? AND context = ?')
      .get(normalized, sample.context) as BaselineRow | undefined

    if (existing === undefined) {
      this.db.prepare(`
        INSERT INTO process_baselines
          (name, context, cpu_mean, cpu_stddev, cpu_m2,
           memory_mean, memory_stddev, memory_m2,
           handle_mean, handle_stddev, handle_m2,
           sample_count, last_updated)
        VALUES (?, ?, ?, 0, 0, ?, 0, 0, ?, 0, 0, 1, ?)
      `).run(normalized, sample.context, sample.cpu_percent, sample.memory_mb, sample.handle_count, now)
      return
    }

    // Welford online algorithm for running mean + variance
    const n = existing.sample_count + 1
    const cpuDelta = sample.cpu_percent - existing.cpu_mean
    const cpuMean = existing.cpu_mean + cpuDelta / n
    const cpuM2 = existing.cpu_m2 + cpuDelta * (sample.cpu_percent - cpuMean)

    const memDelta = sample.memory_mb - existing.memory_mean
    const memMean = existing.memory_mean + memDelta / n
    const memM2 = existing.memory_m2 + memDelta * (sample.memory_mb - memMean)

    const hDelta = sample.handle_count - existing.handle_mean
    const hMean = existing.handle_mean + hDelta / n
    const hM2 = existing.handle_m2 + hDelta * (sample.handle_count - hMean)

    this.db.prepare(`
      UPDATE process_baselines SET
        cpu_mean = ?, cpu_stddev = ?, cpu_m2 = ?,
        memory_mean = ?, memory_stddev = ?, memory_m2 = ?,
        handle_mean = ?, handle_stddev = ?, handle_m2 = ?,
        sample_count = ?, last_updated = ?
      WHERE name = ? AND context = ?
    `).run(
      cpuMean, n > 1 ? Math.sqrt(cpuM2 / (n - 1)) : 0, cpuM2,
      memMean, n > 1 ? Math.sqrt(memM2 / (n - 1)) : 0, memM2,
      hMean,   n > 1 ? Math.sqrt(hM2   / (n - 1)) : 0, hM2,
      n, now,
      normalized, sample.context
    )
  }

  private flush(): void {
    if (this.sampleBuffer.length === 0) return
    const insert = this.db.prepare(`
      INSERT INTO process_samples
        (name, context, cpu_percent, memory_mb, handle_count,
         io_read_bytes_sec, io_write_bytes_sec, sampled_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const now = new Date().toISOString()
    const batch = this.db.transaction((samples: ProcessSample[]) => {
      for (const s of samples) {
        insert.run(
          s.name.toLowerCase().replace(/\.exe$/i, ''),
          s.context,
          s.cpu_percent,
          s.memory_mb,
          s.handle_count,
          s.io_read_bytes_sec,
          s.io_write_bytes_sec,
          now
        )
      }
    })
    batch(this.sampleBuffer)
    this.sampleBuffer = []
  }
}

// Raw DB row type
interface BaselineRow {
  name: string
  context: string
  cpu_mean: number
  cpu_stddev: number
  cpu_m2: number
  memory_mean: number
  memory_stddev: number
  memory_m2: number
  handle_mean: number
  handle_stddev: number
  handle_m2: number
  sample_count: number
  last_updated: string
}

// Singleton factory
let globalBaseline: BaselineEngine | null = null

export function initBaseline(appDataPath: string): BaselineEngine {
  if (globalBaseline !== null) return globalBaseline
  const dbPath = join(appDataPath, 'AEGIS', 'baselines.db')
  globalBaseline = new BaselineEngine(dbPath)
  return globalBaseline
}

export function getBaseline(): BaselineEngine {
  if (globalBaseline === null) throw new Error('BaselineEngine not initialized')
  return globalBaseline
}
