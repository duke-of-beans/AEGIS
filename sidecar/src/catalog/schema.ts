import Database from 'better-sqlite3'
import { existsSync, mkdirSync } from 'fs'
import { dirname } from 'path'

// ============================================================
// Catalog Types
// ============================================================

export type TrustTier = 1 | 2 | 3 | 4 | 5
// 1 = system_critical, 2 = trusted_system, 3 = trusted_app, 4 = unknown, 5 = suspicious

export type BlastRadiusCategory = 'none' | 'low' | 'medium' | 'high' | 'critical'

export type RiskLabel = 'SAFE' | 'CAUTION' | 'DO_NOT_TOUCH' | 'CRITICAL_SYSTEM'

export type ActionPermission = 'kill' | 'suspend' | 'throttle'

export type UnknownStatus =
  | 'observing'
  | 'identified'
  | 'suspicious'
  | 'user_approved'
  | 'user_blocked'

export type IdentificationSource = 'claude_id' | 'hash_lookup' | 'cert_check' | 'user'

export interface CatalogEntry {
  id: number
  name: string
  publisher: string | null
  description: string | null
  trust_tier: TrustTier
  blast_radius_category: BlastRadiusCategory
  risk_label: RiskLabel
  action_permissions: ActionPermission[]
  notes: string | null
  source: 'seeded' | 'observed' | 'user' | 'claude_id'
  created_at: string
  updated_at: string
}

export interface UnknownEntry {
  id: number
  name: string
  path: string | null
  publisher: string | null
  parent_name: string | null
  network_connections: string[]
  first_seen_at: string
  last_seen_at: string
  observation_count: number
  status: UnknownStatus
  identification_source: IdentificationSource | null
  resolved_catalog_id: number | null
  notes: string | null
}

export interface NewUnknownEntry {
  name: string
  path?: string
  publisher?: string
  parent_name?: string
  network_connections?: string[]
}

export interface SeedEntry {
  name: string
  publisher?: string
  description?: string
  trust_tier: TrustTier
  blast_radius_category: BlastRadiusCategory
  risk_label: RiskLabel
  action_permissions: ActionPermission[]
  notes?: string
}

// ============================================================
// Raw DB row types (what better-sqlite3 returns)
// ============================================================

interface RawCatalogRow {
  id: number
  name: string
  publisher: string | null
  description: string | null
  trust_tier: number
  blast_radius_category: string
  risk_label: string
  action_permissions: string
  notes: string | null
  source: string
  created_at: string
  updated_at: string
}

interface RawUnknownRow {
  id: number
  name: string
  path: string | null
  publisher: string | null
  parent_name: string | null
  network_connections: string
  first_seen_at: string
  last_seen_at: string
  observation_count: number
  status: string
  identification_source: string | null
  resolved_catalog_id: number | null
  notes: string | null
}

// ============================================================
// CatalogDb class
// ============================================================

export class CatalogDb {
  private db: Database.Database

  constructor(dbPath: string) {
    const dir = dirname(dbPath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('foreign_keys = ON')
    this.initSchema()
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS process_catalog (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        publisher TEXT,
        description TEXT,
        trust_tier INTEGER NOT NULL,
        blast_radius_category TEXT NOT NULL,
        risk_label TEXT NOT NULL,
        action_permissions TEXT NOT NULL,
        notes TEXT,
        source TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS unknown_processes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        path TEXT,
        publisher TEXT,
        parent_name TEXT,
        network_connections TEXT NOT NULL DEFAULT '[]',
        first_seen_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        observation_count INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'observing',
        identification_source TEXT,
        resolved_catalog_id INTEGER REFERENCES process_catalog(id),
        notes TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_catalog_name ON process_catalog(name);
      CREATE INDEX IF NOT EXISTS idx_unknown_name ON unknown_processes(name);
      CREATE INDEX IF NOT EXISTS idx_unknown_status ON unknown_processes(status);
    `)
  }

  private parseCatalogRow(row: RawCatalogRow): CatalogEntry {
    return {
      ...row,
      trust_tier: row.trust_tier as TrustTier,
      blast_radius_category: row.blast_radius_category as BlastRadiusCategory,
      risk_label: row.risk_label as RiskLabel,
      action_permissions: JSON.parse(row.action_permissions) as ActionPermission[],
      source: row.source as CatalogEntry['source'],
    }
  }

  private parseUnknownRow(row: RawUnknownRow): UnknownEntry {
    return {
      ...row,
      network_connections: JSON.parse(row.network_connections) as string[],
      status: row.status as UnknownStatus,
      identification_source: row.identification_source as IdentificationSource | null,
    }
  }

  getProcess(name: string): CatalogEntry | null {
    const row = this.db
      .prepare('SELECT * FROM process_catalog WHERE name = ?')
      .get(name.toLowerCase().replace(/\.exe$/i, '')) as RawCatalogRow | undefined
    return row ? this.parseCatalogRow(row) : null
  }

  isKnown(name: string): boolean {
    const normalized = name.toLowerCase().replace(/\.exe$/i, '')
    const row = this.db
      .prepare('SELECT id FROM process_catalog WHERE name = ?')
      .get(normalized)
    return row !== undefined
  }

  canActOn(name: string, action: ActionPermission): boolean {
    const normalized = name.toLowerCase().replace(/\.exe$/i, '')
    // First check if it's unknown/suspicious — gate blocks all unknown
    const unknown = this.db
      .prepare("SELECT status FROM unknown_processes WHERE name = ?")
      .get(normalized) as { status: string } | undefined
    if (unknown !== undefined) return false

    const row = this.db
      .prepare('SELECT action_permissions FROM process_catalog WHERE name = ?')
      .get(normalized) as { action_permissions: string } | undefined
    if (row === undefined) return false
    const perms = JSON.parse(row.action_permissions) as ActionPermission[]
    return perms.includes(action)
  }

  addUnknown(entry: NewUnknownEntry): void {
    const now = new Date().toISOString()
    const normalized = entry.name.toLowerCase().replace(/\.exe$/i, '')
    this.db
      .prepare(`
        INSERT OR IGNORE INTO unknown_processes
          (name, path, publisher, parent_name, network_connections,
           first_seen_at, last_seen_at, observation_count, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'observing')
      `)
      .run(
        normalized,
        entry.path ?? null,
        entry.publisher ?? null,
        entry.parent_name ?? null,
        JSON.stringify(entry.network_connections ?? []),
        now,
        now
      )
  }

  updateUnknown(name: string, updates: Partial<Omit<UnknownEntry, 'id' | 'name'>>): void {
    const normalized = name.toLowerCase().replace(/\.exe$/i, '')
    const now = new Date().toISOString()
    if (updates.observation_count !== undefined) {
      this.db
        .prepare('UPDATE unknown_processes SET observation_count = ?, last_seen_at = ? WHERE name = ?')
        .run(updates.observation_count, now, normalized)
    }
    if (updates.status !== undefined) {
      this.db
        .prepare('UPDATE unknown_processes SET status = ? WHERE name = ?')
        .run(updates.status, normalized)
    }
    if (updates.network_connections !== undefined) {
      this.db
        .prepare('UPDATE unknown_processes SET network_connections = ? WHERE name = ?')
        .run(JSON.stringify(updates.network_connections), normalized)
    }
    if (updates.notes !== undefined) {
      this.db
        .prepare('UPDATE unknown_processes SET notes = ? WHERE name = ?')
        .run(updates.notes, normalized)
    }
    if (updates.identification_source !== undefined) {
      this.db
        .prepare('UPDATE unknown_processes SET identification_source = ? WHERE name = ?')
        .run(updates.identification_source, normalized)
    }
    if (updates.resolved_catalog_id !== undefined) {
      this.db
        .prepare('UPDATE unknown_processes SET resolved_catalog_id = ? WHERE name = ?')
        .run(updates.resolved_catalog_id, normalized)
    }
  }

  resolveUnknown(
    name: string,
    entry: { trust_tier: number; risk_label: string; action_permissions: string[]; notes?: string; source: string }
  ): void {
    const normalized = name.toLowerCase().replace(/\.exe$/i, '')
    const now = new Date().toISOString()
    // Insert into catalog
    this.db.prepare(`
      INSERT OR REPLACE INTO process_catalog
        (name, trust_tier, blast_radius_category, risk_label, action_permissions, notes, source, created_at, updated_at)
      VALUES (?, ?, 'low', ?, ?, ?, ?, ?, ?)
    `).run(
      normalized,
      entry.trust_tier,
      entry.risk_label,
      JSON.stringify(entry.action_permissions),
      entry.notes ?? null,
      entry.source,
      now,
      now
    )
    // Get the new catalog id
    const catalogRow = this.db.prepare('SELECT id FROM process_catalog WHERE name = ?').get(normalized) as { id: number } | undefined
    if (catalogRow) {
      this.db.prepare(`
        UPDATE unknown_processes
        SET status = 'identified', resolved_catalog_id = ?, identification_source = ?
        WHERE name = ?
      `).run(catalogRow.id, entry.source, normalized)
    }
  }

  getSuspicious(): UnknownEntry[] {
    const rows = this.db
      .prepare("SELECT * FROM unknown_processes WHERE status = 'suspicious'")
      .all() as RawUnknownRow[]
    return rows.map((r) => this.parseUnknownRow(r))
  }

  getUnresolved(): UnknownEntry[] {
    const rows = this.db
      .prepare("SELECT * FROM unknown_processes WHERE status = 'observing'")
      .all() as RawUnknownRow[]
    return rows.map((r) => this.parseUnknownRow(r))
  }

  getStats(): { total: number; unknown: number; suspicious: number } {
    const total = (this.db.prepare('SELECT COUNT(*) as c FROM process_catalog').get() as { c: number }).c
    const unknown = (this.db.prepare("SELECT COUNT(*) as c FROM unknown_processes WHERE status = 'observing'").get() as { c: number }).c
    const suspicious = (this.db.prepare("SELECT COUNT(*) as c FROM unknown_processes WHERE status = 'suspicious'").get() as { c: number }).c
    return { total, unknown, suspicious }
  }

  isEmpty(): boolean {
    const row = this.db.prepare('SELECT COUNT(*) as c FROM process_catalog').get() as { c: number }
    return row.c === 0
  }

  seedFromArray(entries: SeedEntry[]): void {
    const now = new Date().toISOString()
    const insert = this.db.prepare(`
      INSERT OR IGNORE INTO process_catalog
        (name, publisher, description, trust_tier, blast_radius_category,
         risk_label, action_permissions, notes, source, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'seeded', ?, ?)
    `)
    const insertMany = this.db.transaction((rows: SeedEntry[]) => {
      for (const e of rows) {
        insert.run(
          e.name.toLowerCase().replace(/\.exe$/i, ''),
          e.publisher ?? null,
          e.description ?? null,
          e.trust_tier,
          e.blast_radius_category,
          e.risk_label,
          JSON.stringify(e.action_permissions),
          e.notes ?? null,
          now,
          now
        )
      }
    })
    insertMany(entries)
  }

  close(): void {
    this.db.close()
  }
}
