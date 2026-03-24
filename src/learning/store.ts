// ============================================================
// AEGIS Learning Store
// SQLite sessions.db — every intervention gets a labeled outcome.
// This is the data layer that makes Auto mode trustworthy over time.
// ============================================================

import Database from 'better-sqlite3'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { getLogger } from '../logger/index.js'
import type { ContextName } from '../context/engine.js'
import type { SniperAction } from '../sniper/engine.js'

// ============================================================
// Types
// ============================================================

export type FeedbackSignal = 'positive' | 'neutral' | 'negative'
export type FeedbackIntensity = 'mild' | 'strong'   // strong signals weighted 5x

export interface WorkSession {
  id: string
  context: ContextName
  started_at: string
  ended_at: string | null
  duration_min: number | null
  avg_cognitive_load: number
  peak_cognitive_load: number
  actions_taken: number
  runaways_caught: number
  tabs_suspended: number
  memory_recovered_mb: number
}

export interface ActionOutcome {
  id: string
  session_id: string
  process_name: string
  action: SniperAction
  context: ContextName
  zscore_at_action: number
  cpu_before: number
  memory_before: number
  cpu_after: number | null       // measured 60s post-action
  memory_after: number | null
  implicit_approved: boolean     // no undo within 60s
  explicit_feedback: FeedbackSignal | null
  feedback_intensity: FeedbackIntensity | null
  feedback_at: string | null
  responsiveness_delta: number | null  // DPC rate change
  created_at: string
}

export interface CognitiveLoadSample {
  session_id: string
  load_score: number    // 0-100
  cpu_pressure: number
  memory_pressure: number
  disk_queue: number
  dpc_rate: number
  runaway_count: number
  tab_pressure: number
  sampled_at: string
}

export interface ConfidenceState {
  total_decisions: number
  approvals: number
  rejections: number
  strong_rejections: number
  confidence_score: number          // 0.0 – 1.0
  auto_mode_unlocked: boolean       // true when confidence >= CONFIDENCE_THRESHOLD
  decisions_until_auto: number | null
}

// Confidence milestones
const CONFIDENCE_THRESHOLD = 0.75
const MIN_DECISIONS_FOR_AUTO = 30

// ============================================================
// LearningStore
// ============================================================

export class LearningStore {
  private db: Database.Database
  private logger = getLogger()
  private currentSessionId: string | null = null
  private loadSampleBuffer: CognitiveLoadSample[] = []
  private flushInterval: ReturnType<typeof setInterval> | null = null

  constructor(dbPath: string) {
    const dir = dbPath.substring(0, dbPath.lastIndexOf('\\') !== -1 ? dbPath.lastIndexOf('\\') : dbPath.lastIndexOf('/'))
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.initSchema()
    this.logger.info('LearningStore initialized', { dbPath })
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS work_sessions (
        id TEXT PRIMARY KEY,
        context TEXT NOT NULL,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        duration_min REAL,
        avg_cognitive_load REAL NOT NULL DEFAULT 0,
        peak_cognitive_load REAL NOT NULL DEFAULT 0,
        actions_taken INTEGER NOT NULL DEFAULT 0,
        runaways_caught INTEGER NOT NULL DEFAULT 0,
        tabs_suspended INTEGER NOT NULL DEFAULT 0,
        memory_recovered_mb REAL NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS action_outcomes (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES work_sessions(id),
        process_name TEXT NOT NULL,
        action TEXT NOT NULL,
        context TEXT NOT NULL,
        zscore_at_action REAL NOT NULL,
        cpu_before REAL NOT NULL,
        memory_before REAL NOT NULL,
        cpu_after REAL,
        memory_after REAL,
        implicit_approved INTEGER NOT NULL DEFAULT 0,
        explicit_feedback TEXT,
        feedback_intensity TEXT,
        feedback_at TEXT,
        responsiveness_delta REAL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS cognitive_load_samples (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL REFERENCES work_sessions(id),
        load_score REAL NOT NULL,
        cpu_pressure REAL NOT NULL,
        memory_pressure REAL NOT NULL,
        disk_queue REAL NOT NULL,
        dpc_rate REAL NOT NULL,
        runaway_count INTEGER NOT NULL,
        tab_pressure REAL NOT NULL,
        sampled_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS confidence_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        total_decisions INTEGER NOT NULL DEFAULT 0,
        approvals INTEGER NOT NULL DEFAULT 0,
        rejections INTEGER NOT NULL DEFAULT 0,
        strong_rejections INTEGER NOT NULL DEFAULT 0,
        confidence_score REAL NOT NULL DEFAULT 0,
        auto_mode_unlocked INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
      );

      INSERT OR IGNORE INTO confidence_state
        (id, total_decisions, approvals, rejections, strong_rejections,
         confidence_score, auto_mode_unlocked, updated_at)
        VALUES (1, 0, 0, 0, 0, 0.0, 0, datetime('now'));

      CREATE INDEX IF NOT EXISTS idx_outcomes_session ON action_outcomes(session_id);
      CREATE INDEX IF NOT EXISTS idx_load_session ON cognitive_load_samples(session_id);
      CREATE INDEX IF NOT EXISTS idx_outcomes_process ON action_outcomes(process_name, context);
    `)
  }

  // ── Session management ─────────────────────────────────

  startSession(context: ContextName): string {
    const id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    this.db.prepare(`
      INSERT INTO work_sessions (id, context, started_at)
      VALUES (?, ?, datetime('now'))
    `).run(id, context)
    this.currentSessionId = id
    this.logger.info('Session started', { id, context })
    return id
  }

  endSession(id: string): void {
    this.flushLoadSamples()
    const stats = this.db.prepare(`
      SELECT
        COUNT(*) as actions_taken,
        AVG(load_score) as avg_load,
        MAX(load_score) as peak_load
      FROM cognitive_load_samples
      WHERE session_id = ?
    `).get(id) as { actions_taken: number; avg_load: number | null; peak_load: number | null }

    this.db.prepare(`
      UPDATE work_sessions SET
        ended_at = datetime('now'),
        duration_min = ROUND((julianday('now') - julianday(started_at)) * 1440, 1),
        avg_cognitive_load = ?,
        peak_cognitive_load = ?,
        actions_taken = (SELECT COUNT(*) FROM action_outcomes WHERE session_id = ?)
      WHERE id = ?
    `).run(
      stats.avg_load ?? 0,
      stats.peak_load ?? 0,
      id, id
    )
    if (this.currentSessionId === id) this.currentSessionId = null
    this.logger.info('Session ended', { id })
  }

  getCurrentSessionId(): string | null {
    return this.currentSessionId
  }

  // ── Action outcome tracking ────────────────────────────

  recordAction(params: {
    processName: string
    action: SniperAction
    context: ContextName
    zscoreAtAction: number
    cpuBefore: number
    memoryBefore: number
  }): string {
    const sessionId = this.currentSessionId ?? this.ensureSession(params.context)
    const id = `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    this.db.prepare(`
      INSERT INTO action_outcomes
        (id, session_id, process_name, action, context, zscore_at_action,
         cpu_before, memory_before, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(id, sessionId, params.processName, params.action, params.context,
           params.zscoreAtAction, params.cpuBefore, params.memoryBefore)
    this.logger.info('Action recorded', { id, action: params.action, process: params.processName })
    return id
  }

  // Called ~60s after action with measured outcome
  updateActionOutcome(id: string, cpuAfter: number, memoryAfter: number, responsivenessDelta: number | null): void {
    const implicitApproved = 1  // if we're calling this, no undo was triggered
    this.db.prepare(`
      UPDATE action_outcomes SET
        cpu_after = ?, memory_after = ?,
        implicit_approved = ?,
        responsiveness_delta = ?
      WHERE id = ?
    `).run(cpuAfter, memoryAfter, implicitApproved, responsivenessDelta, id)
    this.updateConfidence('positive', 'mild')
  }

  // Called when user taps thumbs up/sideways/down tray notification
  recordExplicitFeedback(
    actionId: string,
    signal: FeedbackSignal,
    intensity: FeedbackIntensity
  ): void {
    this.db.prepare(`
      UPDATE action_outcomes SET
        explicit_feedback = ?,
        feedback_intensity = ?,
        feedback_at = datetime('now')
      WHERE id = ?
    `).run(signal, intensity, actionId)
    this.updateConfidence(signal, intensity)
    this.logger.info('Explicit feedback recorded', { actionId, signal, intensity })
  }

  // ── Cognitive load samples ─────────────────────────────

  recordLoadSample(sample: Omit<CognitiveLoadSample, 'session_id'>): void {
    const sessionId = this.currentSessionId
    if (sessionId === null) return
    this.loadSampleBuffer.push({ ...sample, session_id: sessionId })
    if (this.loadSampleBuffer.length >= 30) this.flushLoadSamples()
  }

  private flushLoadSamples(): void {
    if (this.loadSampleBuffer.length === 0) return
    const insert = this.db.prepare(`
      INSERT INTO cognitive_load_samples
        (session_id, load_score, cpu_pressure, memory_pressure, disk_queue,
         dpc_rate, runaway_count, tab_pressure, sampled_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const batch = this.db.transaction((samples: CognitiveLoadSample[]) => {
      for (const s of samples) {
        insert.run(s.session_id, s.load_score, s.cpu_pressure, s.memory_pressure,
                   s.disk_queue, s.dpc_rate, s.runaway_count, s.tab_pressure, s.sampled_at)
      }
    })
    batch(this.loadSampleBuffer)
    this.loadSampleBuffer = []
  }

  // ── Confidence state ───────────────────────────────────

  getConfidenceState(): ConfidenceState {
    const row = this.db.prepare('SELECT * FROM confidence_state WHERE id = 1')
      .get() as ConfidenceRow
    const decisionsUntilAuto = row.auto_mode_unlocked
      ? null
      : Math.max(0, MIN_DECISIONS_FOR_AUTO - row.total_decisions)
    return {
      total_decisions: row.total_decisions,
      approvals: row.approvals,
      rejections: row.rejections,
      strong_rejections: row.strong_rejections,
      confidence_score: row.confidence_score,
      auto_mode_unlocked: row.auto_mode_unlocked === 1,
      decisions_until_auto: decisionsUntilAuto,
    }
  }

  private updateConfidence(signal: FeedbackSignal, intensity: FeedbackIntensity): void {
    const row = this.db.prepare('SELECT * FROM confidence_state WHERE id = 1')
      .get() as ConfidenceRow

    const weight = intensity === 'strong' ? 5 : 1
    let approvals = row.approvals
    let rejections = row.rejections
    let strongRejections = row.strong_rejections

    if (signal === 'positive') {
      approvals += weight
    } else if (signal === 'negative') {
      rejections += weight
      if (intensity === 'strong') strongRejections += 1
    }
    // neutral = no change to approval/rejection counts

    const total = row.total_decisions + 1
    // Score: (approvals - rejections*2) / total, clamped 0-1
    // Strong rejections count double in the penalty
    const rawScore = (approvals - (rejections + strongRejections)) / Math.max(total, 1)
    const score = Math.max(0, Math.min(1, rawScore))
    const unlocked = total >= MIN_DECISIONS_FOR_AUTO && score >= CONFIDENCE_THRESHOLD ? 1 : 0

    this.db.prepare(`
      UPDATE confidence_state SET
        total_decisions = ?, approvals = ?, rejections = ?,
        strong_rejections = ?, confidence_score = ?,
        auto_mode_unlocked = ?, updated_at = datetime('now')
      WHERE id = 1
    `).run(total, approvals, rejections, strongRejections, score, unlocked)

    if (unlocked && !row.auto_mode_unlocked) {
      this.logger.info('Auto mode unlocked!', { score, total })
    }
  }

  // ── Queries ────────────────────────────────────────────

  getRecentSessions(limit = 10): WorkSession[] {
    return this.db.prepare(`
      SELECT * FROM work_sessions
      WHERE ended_at IS NOT NULL
      ORDER BY started_at DESC LIMIT ?
    `).all(limit) as WorkSession[]
  }

  getBestSession(): WorkSession | null {
    return this.db.prepare(`
      SELECT * FROM work_sessions
      WHERE ended_at IS NOT NULL AND avg_cognitive_load > 0
      ORDER BY avg_cognitive_load ASC LIMIT 1
    `).get() as WorkSession | null
  }

  getActionSuccessRate(processName: string): number {
    const row = this.db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN implicit_approved = 1 THEN 1 ELSE 0 END) as approved
      FROM action_outcomes
      WHERE process_name = ?
    `).get(processName) as { total: number; approved: number }
    if (row.total === 0) return 0
    return row.approved / row.total
  }

  // ── Lifecycle ──────────────────────────────────────────

  start(): void {
    this.flushInterval = setInterval(() => this.flushLoadSamples(), 30_000)
  }

  stop(): void {
    if (this.flushInterval !== null) {
      clearInterval(this.flushInterval)
      this.flushInterval = null
    }
    if (this.currentSessionId !== null) {
      this.endSession(this.currentSessionId)
    }
    this.flushLoadSamples()
    this.db.close()
  }

  private ensureSession(context: ContextName): string {
    return this.startSession(context)
  }
}

interface ConfidenceRow {
  id: number
  total_decisions: number
  approvals: number
  rejections: number
  strong_rejections: number
  confidence_score: number
  auto_mode_unlocked: number
  updated_at: string
}

// Singleton
let globalStore: LearningStore | null = null

export function initLearningStore(appDataPath: string): LearningStore {
  if (globalStore !== null) return globalStore
  const dbPath = join(appDataPath, 'AEGIS', 'sessions.db')
  globalStore = new LearningStore(dbPath)
  return globalStore
}

export function getLearningStore(): LearningStore {
  if (globalStore === null) throw new Error('LearningStore not initialized')
  return globalStore
}
