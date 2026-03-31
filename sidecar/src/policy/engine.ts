// ============================================================
// AEGIS Policy Enforcement Engine — POL-01
// Owns persistent OS-level configuration.
// Checks policy state on every boot, re-applies drifted policies.
// Two policy types: registry (DWORD/STRING) and json_file.
// Never crashes AEGIS — all errors caught, logged, continue.
// ============================================================

import { spawn } from 'child_process'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import * as os from 'os'
import { getLogger } from '../logger/index.js'

// ── Types ────────────────────────────────────────────────────

export type PolicyType = 'DWORD' | 'STRING' | 'json_file' | 'powercfg'

export interface PolicyDef {
  id: string
  description: string
  type: PolicyType
  // registry fields (DWORD/STRING)
  hive?: 'HKLM' | 'HKCU'
  path?: string
  value_name?: string
  expected_value?: number | string | boolean
  // json_file fields
  file_path?: string
  json_key?: string   // dot-notation e.g. "hardware_acceleration_mode.enabled"
  // powercfg fields
  scheme_guid?: string
  // common
  auto_enforce: boolean
  requires_elevation: boolean
}

export interface PolicyResult {
  id: string
  description: string
  type: PolicyType
  current_value: unknown
  expected_value: unknown
  compliant: boolean
  enforced_at: string | null
  drift_detected: boolean
  enforcement_blocked: boolean  // true if requires_elevation and not elevated
  error: string | null
}

// ── Default policies ──────────────────────────────────────────

export const DEFAULT_POLICIES: PolicyDef[] = [
  {
    id: 'defender-realtime-off',
    description: 'Windows Defender real-time monitoring disabled',
    type: 'DWORD',
    hive: 'HKLM',
    path: 'SOFTWARE\\Policies\\Microsoft\\Windows Defender\\Real-Time Protection',
    value_name: 'DisableRealtimeMonitoring',
    expected_value: 1,
    auto_enforce: true,
    requires_elevation: true,
  },
  {
    id: 'defender-antispyware-off',
    description: 'Windows Defender antispyware disabled',
    type: 'DWORD',
    hive: 'HKLM',
    path: 'SOFTWARE\\Policies\\Microsoft\\Windows Defender',
    value_name: 'DisableAntiSpyware',
    expected_value: 1,
    auto_enforce: true,
    requires_elevation: true,
  },
  {
    id: 'defender-antivirus-off',
    description: 'Windows Defender antivirus disabled',
    type: 'DWORD',
    hive: 'HKLM',
    path: 'SOFTWARE\\Policies\\Microsoft\\Windows Defender',
    value_name: 'DisableAntiVirus',
    expected_value: 1,
    auto_enforce: true,
    requires_elevation: true,
  },
  {
    id: 'search-bing-off',
    description: 'Bing search results disabled in Windows Search',
    type: 'DWORD',
    hive: 'HKCU',
    path: 'SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Search',
    value_name: 'BingSearchEnabled',
    expected_value: 0,
    auto_enforce: true,
    requires_elevation: false,
  },
  {
    id: 'search-suggestions-off',
    description: 'Search box web suggestions disabled',
    type: 'DWORD',
    hive: 'HKCU',
    path: 'SOFTWARE\\Policies\\Microsoft\\Windows\\Explorer',
    value_name: 'DisableSearchBoxSuggestions',
    expected_value: 1,
    auto_enforce: true,
    requires_elevation: false,
  },
  {
    id: 'claude-gpu-acceleration-off',
    description: 'Claude Desktop GPU hardware acceleration disabled',
    type: 'json_file',
    file_path: '%APPDATA%\\Claude\\Local State',
    json_key: 'hardware_acceleration_mode.enabled',
    expected_value: false,
    auto_enforce: true,
    requires_elevation: false,
  },
]

// ── Helpers ────────────────────────────────────────────────────

function expandEnvVars(path: string): string {
  return path.replace(/%([^%]+)%/g, (_, key: string) => process.env[key] ?? '')
}

function getNestedValue(obj: Record<string, unknown>, dotKey: string): unknown {
  const keys = dotKey.split('.')
  let cur: unknown = obj
  for (const k of keys) {
    if (cur === null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[k]
  }
  return cur
}

function setNestedValue(obj: Record<string, unknown>, dotKey: string, value: unknown): void {
  const keys = dotKey.split('.')
  let cur: Record<string, unknown> = obj
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i]
    if (cur[k] === null || typeof cur[k] !== 'object') cur[k] = {}
    cur = cur[k] as Record<string, unknown>
  }
  cur[keys[keys.length - 1]] = value
}

function runPowerShell(cmd: string): Promise<string> {
  return new Promise((resolve) => {
    const ps = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', cmd], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    let out = ''
    ps.stdout?.on('data', (d: Buffer) => { out += d.toString() })
    ps.on('close', () => resolve(out.trim()))
    ps.on('error', () => resolve(''))
    setTimeout(() => { ps.kill(); resolve(out.trim()) }, 5000)
  })
}

// ── PolicyEngine ───────────────────────────────────────────────

export class PolicyEngine {
  private policies: PolicyDef[]
  private lastAudit: PolicyResult[] | null = null
  private logger = getLogger()

  constructor(customPolicies?: PolicyDef[]) {
    this.policies = customPolicies ?? DEFAULT_POLICIES
  }

  // Read current value for a single policy
  private async readValue(policy: PolicyDef): Promise<unknown> {
    try {
      if (policy.type === 'DWORD' || policy.type === 'STRING') {
        const hive = policy.hive === 'HKLM' ? 'HKLM:' : 'HKCU:'
        const regPath = `${hive}\\${policy.path}`
        const cmd = `(Get-ItemProperty -Path '${regPath}' -Name '${policy.value_name}' -ErrorAction SilentlyContinue).'${policy.value_name}'`
        const raw = await runPowerShell(cmd)
        if (!raw || raw === '') return undefined
        return policy.type === 'DWORD' ? parseInt(raw, 10) : raw
      }

      if (policy.type === 'json_file' && policy.file_path && policy.json_key) {
        const filePath = expandEnvVars(policy.file_path)
        if (!existsSync(filePath)) return undefined
        const content = readFileSync(filePath, 'utf-8')
        const parsed = JSON.parse(content) as Record<string, unknown>
        return getNestedValue(parsed, policy.json_key)
      }

      if (policy.type === 'powercfg' && policy.scheme_guid) {
        const raw = await runPowerShell(`(powercfg /getactivescheme) -match '${policy.scheme_guid}'`)
        return raw ? true : false
      }
    } catch (e: any) {
      this.logger.warn('PolicyEngine: readValue failed', { id: policy.id, err: e.message })
    }
    return undefined
  }

  // Write value for a single policy
  private async writeValue(policy: PolicyDef): Promise<boolean> {
    try {
      if (policy.type === 'DWORD' || policy.type === 'STRING') {
        const hive = policy.hive === 'HKLM' ? 'HKLM:' : 'HKCU:'
        const regPath = `${hive}\\${policy.path}`
        const valType = policy.type === 'DWORD' ? 'DWord' : 'String'
        const cmd = `
          $p = '${regPath}'
          if (-not (Test-Path $p)) { New-Item -Path $p -Force | Out-Null }
          Set-ItemProperty -Path $p -Name '${policy.value_name}' -Value ${policy.expected_value} -Type ${valType} -Force
          Write-Output 'OK'
        `
        const result = await runPowerShell(cmd)
        return result.includes('OK')
      }

      if (policy.type === 'json_file' && policy.file_path && policy.json_key) {
        const filePath = expandEnvVars(policy.file_path)
        let parsed: Record<string, unknown> = {}
        if (existsSync(filePath)) {
          try { parsed = JSON.parse(readFileSync(filePath, 'utf-8')) as Record<string, unknown> }
          catch { parsed = {} }
        } else {
          const dir = dirname(filePath)
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
        }
        setNestedValue(parsed, policy.json_key, policy.expected_value)
        // No-BOM UTF-8 write
        const json = JSON.stringify(parsed)
        writeFileSync(filePath, json, { encoding: 'utf8' })
        return true
      }

      if (policy.type === 'powercfg' && policy.scheme_guid) {
        const result = await runPowerShell(`powercfg /setactive ${policy.scheme_guid}; Write-Output 'OK'`)
        return result.includes('OK')
      }
    } catch (e: any) {
      this.logger.warn('PolicyEngine: writeValue failed', { id: policy.id, err: e.message })
    }
    return false
  }

  private valuesMatch(current: unknown, expected: unknown): boolean {
    if (current === undefined || current === null) return false
    // Numeric comparison (registry DWORD)
    if (typeof expected === 'number') return Number(current) === expected
    // Boolean comparison (json_file)
    if (typeof expected === 'boolean') {
      if (typeof current === 'boolean') return current === expected
      if (typeof current === 'number') return (current !== 0) === expected
      if (typeof current === 'string') return (current.toLowerCase() === 'true') === expected
      return false
    }
    return String(current) === String(expected)
  }

  async checkAll(): Promise<PolicyResult[]> {
    const results: PolicyResult[] = []
    for (const policy of this.policies) {
      try {
        const current = await this.readValue(policy)
        const compliant = this.valuesMatch(current, policy.expected_value)
        results.push({
          id: policy.id,
          description: policy.description,
          type: policy.type,
          current_value: current,
          expected_value: policy.expected_value,
          compliant,
          enforced_at: null,
          drift_detected: !compliant,
          enforcement_blocked: false,
          error: null,
        })
      } catch (e: any) {
        results.push({
          id: policy.id, description: policy.description, type: policy.type,
          current_value: null, expected_value: policy.expected_value,
          compliant: false, enforced_at: null, drift_detected: false,
          enforcement_blocked: false, error: e.message,
        })
      }
    }
    return results
  }

  async enforceAll(checkResults: PolicyResult[]): Promise<PolicyResult[]> {
    const updated = [...checkResults]
    for (let i = 0; i < updated.length; i++) {
      const result = updated[i]
      const policy = this.policies.find(p => p.id === result.id)
      if (!policy || result.compliant || !policy.auto_enforce) continue

      if (policy.requires_elevation) {
        // Attempt — will silently fail if not elevated, that's ok
        const success = await this.writeValue(policy)
        if (success) {
          updated[i] = { ...result, compliant: true, drift_detected: true, enforced_at: new Date().toISOString() }
          this.logger.info(`[POLICY] ${result.id}: drifted → re-enforced`)
        } else {
          updated[i] = { ...result, enforcement_blocked: true }
          this.logger.warn(`[POLICY] ${result.id}: drift detected, elevation required or enforcement failed`)
        }
      } else {
        const success = await this.writeValue(policy)
        if (success) {
          updated[i] = { ...result, compliant: true, drift_detected: true, enforced_at: new Date().toISOString() }
          this.logger.info(`[POLICY] ${result.id}: drifted → re-enforced`)
        } else {
          updated[i] = { ...result, error: 'Enforcement failed' }
          this.logger.warn(`[POLICY] ${result.id}: enforcement failed`)
        }
      }
    }
    return updated
  }

  async auditAndEnforce(): Promise<PolicyResult[]> {
    const checked = await this.checkAll()
    const enforced = await this.enforceAll(checked)
    this.lastAudit = enforced
    const drifted = enforced.filter(r => r.drift_detected)
    if (drifted.length > 0) {
      this.logger.info(`[POLICY] Audit complete: ${drifted.length} policies drifted, ${enforced.filter(r => r.compliant).length} compliant`)
    } else {
      this.logger.info(`[POLICY] Audit complete: all ${enforced.length} policies compliant`)
    }
    return enforced
  }

  getLastAudit(): PolicyResult[] | null { return this.lastAudit }
}

let globalPolicy: PolicyEngine | null = null
export function initPolicyEngine(): PolicyEngine {
  if (globalPolicy !== null) return globalPolicy
  globalPolicy = new PolicyEngine()
  return globalPolicy
}
export function getPolicyEngine(): PolicyEngine {
  if (globalPolicy === null) throw new Error('PolicyEngine not initialized')
  return globalPolicy
}
