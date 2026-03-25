import { join, dirname } from 'path'
import { readFileSync, appendFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { getLogger } from '../logger/index.js'
import { CatalogDb } from './schema.js'
import type { CatalogEntry, UnknownEntry, ActionPermission, SeedEntry, NewUnknownEntry } from './schema.js'

export type { CatalogEntry, UnknownEntry }

// RFC1918 private ranges — external IPs are those outside these
const PRIVATE_IP_PATTERNS = [
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^127\./,
  /^::1$/,
  /^localhost$/i,
]

function isExternalIp(ip: string): boolean {
  return !PRIVATE_IP_PATTERNS.some((p) => p.test(ip))
}

function isSuspiciousPath(path: string | null): boolean {
  if (path === null) return false
  const lower = path.toLowerCase()
  return (
    lower.includes('appdata') ||
    lower.includes('\\temp\\') ||
    lower.includes('/temp/') ||
    lower.includes('\\downloads\\') ||
    lower.includes('/downloads/')
  )
}

export interface ProcessObservation {
  name: string
  path?: string
  publisher?: string
  parentName?: string
  networkConns?: string[]
}

export interface IdentificationRequest {
  name: string
  path: string | null
  publisher: string | null
  parentName: string | null
  networkConns: string[]
}

let globalCatalog: CatalogManager | null = null

export class CatalogManager {
  private db: CatalogDb
  private appDataPath: string
  private logger = getLogger()
  private identificationListeners: Array<(req: IdentificationRequest) => void> = []

  constructor(appDataPath: string) {
    this.appDataPath = appDataPath
    const dbPath = join(appDataPath, 'AEGIS', 'catalog.db')
    this.db = new CatalogDb(dbPath)
    this.logger.info('CatalogManager initialized', { dbPath })
  }

  seedIfEmpty(): void {
    if (!this.db.isEmpty()) return
    try {
      const __filename = fileURLToPath(import.meta.url)
      const __dirname = dirname(__filename)
      const seedPath = join(__dirname, 'seed.json')
      const raw = readFileSync(seedPath, 'utf-8')
      const entries = JSON.parse(raw) as SeedEntry[]
      this.db.seedFromArray(entries)
      const stats = this.db.getStats()
      this.logger.info('Catalog seeded', { total: stats.total })
    } catch (error) {
      this.logger.error('Failed to seed catalog', { error })
    }
  }

  lookup(name: string): CatalogEntry | 'unknown' | 'suspicious' {
    const normalized = name.toLowerCase().replace(/\.exe$/i, '')
    const suspicious = this.getSuspicious().find((u) => u.name === normalized)
    if (suspicious) return 'suspicious'
    const entry = this.db.getProcess(normalized)
    if (entry) return entry
    return 'unknown'
  }

  recordObservation(proc: ProcessObservation): void {
    const normalized = proc.name.toLowerCase().replace(/\.exe$/i, '')

    // Already in catalog — nothing to do
    if (this.db.isKnown(normalized)) return

    // Check if already in unknown table
    const existing = this.getUnresolved().find((u) => u.name === normalized)
      ?? this.getSuspicious().find((u) => u.name === normalized)

    if (!existing) {
      const entry: NewUnknownEntry = { name: normalized }
      if (proc.path !== undefined) entry.path = proc.path
      if (proc.publisher !== undefined) entry.publisher = proc.publisher
      if (proc.parentName !== undefined) entry.parent_name = proc.parentName
      if (proc.networkConns !== undefined) entry.network_connections = proc.networkConns
      this.db.addUnknown(entry)
      this.logger.info('New unknown process observed', { name: normalized })
      return
    }

    // Update existing unknown
    const newCount = existing.observation_count + 1
    const updatedConns = Array.from(
      new Set([...existing.network_connections, ...(proc.networkConns ?? [])])
    )
    this.db.updateUnknown(normalized, {
      observation_count: newCount,
      network_connections: updatedConns,
    })

    // Suspicious heuristic — all four must be true
    if (
      existing.status === 'observing' &&
      newCount > 3 &&
      !proc.publisher &&
      isSuspiciousPath(proc.path ?? null) &&
      updatedConns.some(isExternalIp)
    ) {
      this.db.updateUnknown(normalized, { status: 'suspicious' })
      this.logger.warn('Process flagged suspicious', { name: normalized, path: proc.path })
    }
  }

  canActOn(name: string, action: ActionPermission): boolean {
    return this.db.canActOn(name, action)
  }

  isKnown(name: string): boolean {
    return this.db.isKnown(name)
  }

  requestIdentification(name: string): void {
    const normalized = name.toLowerCase().replace(/\.exe$/i, '')
    const unknown = this.getUnresolved().find((u) => u.name === normalized)
      ?? this.getSuspicious().find((u) => u.name === normalized)

    const req: IdentificationRequest = {
      name: normalized,
      path: unknown?.path ?? null,
      publisher: unknown?.publisher ?? null,
      parentName: unknown?.parent_name ?? null,
      networkConns: unknown?.network_connections ?? [],
    }

    // Notify listeners (MCP etc)
    for (const listener of this.identificationListeners) {
      try { listener(req) } catch (_) { /* */ }
    }

    // Persist to pending_identifications.json as fallback
    try {
      const pendingPath = join(this.appDataPath, 'AEGIS', 'pending_identifications.json')
      const entry = JSON.stringify({ ...req, requested_at: new Date().toISOString() })
      appendFileSync(pendingPath, entry + '\n', 'utf-8')
    } catch (error) {
      this.logger.warn('Failed to write pending identification', { error })
    }

    this.logger.info('Identification requested', { name: normalized })
  }

  resolveProcess(
    name: string,
    resolution: {
      trust_tier: number
      risk_label: string
      action_permissions: string[]
      notes?: string
      source: string
    }
  ): void {
    this.db.resolveUnknown(name, resolution)
    this.logger.info('Process resolved', { name, source: resolution.source })
  }

  onIdentificationRequest(listener: (req: IdentificationRequest) => void): void {
    this.identificationListeners.push(listener)
  }

  getSuspicious(): UnknownEntry[] {
    return this.db.getSuspicious()
  }

  getUnresolved(): UnknownEntry[] {
    return this.db.getUnresolved()
  }

  getStats(): { total: number; unknown: number; suspicious: number } {
    return this.db.getStats()
  }

  close(): void {
    this.db.close()
  }
}

export function initCatalog(appDataPath: string): CatalogManager {
  if (globalCatalog !== null) return globalCatalog
  globalCatalog = new CatalogManager(appDataPath)
  return globalCatalog
}

export function getCatalog(): CatalogManager {
  if (globalCatalog === null) throw new Error('CatalogManager not initialized')
  return globalCatalog
}
