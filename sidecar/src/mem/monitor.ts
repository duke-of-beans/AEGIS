// ============================================================
// AEGIS Memory Intelligence — MEM-01
// Page file usage, commit charge, RAM composition,
// working set detection, and leak trend analysis.
// ============================================================

import { spawn } from 'child_process'
import { getLogger } from '../logger/index.js'

export interface MemSnapshot {
  physical_total_mb: number
  physical_used_mb: number
  physical_free_mb: number
  physical_pct: number
  page_file_total_mb: number
  page_file_used_mb: number
  page_file_pct: number
  commit_total_mb: number
  commit_limit_mb: number
  commit_pct: number
  cached_mb: number
  nonpaged_pool_mb: number
  paged_pool_mb: number
  top_consumers: MemConsumer[]
  timestamp: number
}

export interface MemConsumer {
  name: string
  pid: number
  working_set_mb: number
  private_bytes_mb: number
  trend: 'growing' | 'stable' | 'shrinking' | 'unknown'
}

export interface LeakCandidate {
  name: string
  pid: number
  growth_rate_mb_per_min: number
  samples: number
  first_seen_mb: number
  current_mb: number
  confidence: 'low' | 'medium' | 'high'
}

// ── Leak tracking ─────────────────────────────────────────────
interface MemSample { mb: number; ts: number }
const leakTracker = new Map<string, MemSample[]>()
const MAX_LEAK_SAMPLES = 30
const LEAK_WINDOW_MS = 10 * 60 * 1000  // 10 minutes
const LEAK_GROWTH_THRESHOLD_MB_MIN = 5  // flag if growing > 5MB/min

function runPS(cmd: string): Promise<string> {
  return new Promise((resolve) => {
    const ps = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', cmd], {
      stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
    })
    let out = ''
    ps.stdout?.on('data', (d: Buffer) => { out += d.toString() })
    ps.on('close', () => resolve(out.trim()))
    ps.on('error', () => resolve(''))
    setTimeout(() => { ps.kill(); resolve(out.trim()) }, 6000)
  })
}

export async function getMemSnapshot(processes?: Array<{name: string; pid: number; memory_mb: number}>): Promise<MemSnapshot | null> {
  const logger = getLogger()
  try {
    // Get OS-level memory stats via WMI
    const cmd = `
      $os = Get-WmiObject Win32_OperatingSystem
      $cs = Get-WmiObject Win32_ComputerSystem
      $pf = Get-WmiObject Win32_PageFileUsage | Select-Object -First 1
      $pm = Get-WmiObject Win32_PerfFormattedData_PerfOS_Memory
      [PSCustomObject]@{
        TotalVisibleMB = [math]::Round($os.TotalVisibleMemorySize / 1024)
        FreePhysicalMB = [math]::Round($os.FreePhysicalMemory / 1024)
        TotalVirtualMB = [math]::Round($os.TotalVirtualMemorySize / 1024)
        FreeVirtualMB  = [math]::Round($os.FreeVirtualMemory / 1024)
        PFTotalMB      = if ($pf) { [math]::Round($pf.AllocatedBaseSize) } else { 0 }
        PFUsedMB       = if ($pf) { [math]::Round($pf.CurrentUsage) } else { 0 }
        CacheMB        = if ($pm) { [math]::Round($pm.CacheBytes / 1MB) } else { 0 }
        NonpagedMB     = if ($pm) { [math]::Round($pm.PoolNonpagedBytes / 1MB) } else { 0 }
        PagedMB        = if ($pm) { [math]::Round($pm.PoolPagedBytes / 1MB) } else { 0 }
        CommitTotalMB  = if ($pm) { [math]::Round($pm.CommittedBytes / 1MB) } else { 0 }
        CommitLimitMB  = if ($pm) { [math]::Round($pm.CommitLimit / 1MB) } else { 0 }
      } | ConvertTo-Json -Compress
    `
    const raw = await runPS(cmd)
    if (!raw) return null
    const d = JSON.parse(raw) as Record<string, number>

    const physTotal = d.TotalVisibleMB ?? 0
    const physFree  = d.FreePhysicalMB ?? 0
    const physUsed  = physTotal - physFree
    const physPct   = physTotal > 0 ? (physUsed / physTotal) * 100 : 0
    const pfTotal   = d.PFTotalMB ?? 0
    const pfUsed    = d.PFUsedMB ?? 0
    const pfPct     = pfTotal > 0 ? (pfUsed / pfTotal) * 100 : 0
    const commitTotal = d.CommitTotalMB ?? 0
    const commitLimit = d.CommitLimitMB ?? 0
    const commitPct   = commitLimit > 0 ? (commitTotal / commitLimit) * 100 : 0

    // Top consumers from the process list passed in from main.ts
    const consumers: MemConsumer[] = []
    if (processes && processes.length > 0) {
      const now = Date.now()
      const sorted = [...processes].sort((a, b) => b.memory_mb - a.memory_mb).slice(0, 15)
      for (const proc of sorted) {
        const key = `${proc.name}:${proc.pid}`
        const history = leakTracker.get(key) ?? []
        history.push({ mb: proc.memory_mb, ts: now })
        // Keep only last MAX_LEAK_SAMPLES samples within window
        const pruned = history.filter(s => now - s.ts < LEAK_WINDOW_MS).slice(-MAX_LEAK_SAMPLES)
        leakTracker.set(key, pruned)
        let trend: MemConsumer['trend'] = 'unknown'
        if (pruned.length >= 3) {
          const oldest = pruned[0], newest = pruned[pruned.length - 1]
          const delta = newest.mb - oldest.mb
          const pct = oldest.mb > 0 ? Math.abs(delta) / oldest.mb : 0
          if (pct > 0.05) trend = delta > 0 ? 'growing' : 'shrinking'
          else trend = 'stable'
        }
        consumers.push({ name: proc.name, pid: proc.pid, working_set_mb: proc.memory_mb, private_bytes_mb: proc.memory_mb, trend })
      }
    }

    return {
      physical_total_mb: physTotal, physical_used_mb: physUsed,
      physical_free_mb: physFree, physical_pct: Math.round(physPct * 10) / 10,
      page_file_total_mb: pfTotal, page_file_used_mb: pfUsed, page_file_pct: Math.round(pfPct * 10) / 10,
      commit_total_mb: commitTotal, commit_limit_mb: commitLimit, commit_pct: Math.round(commitPct * 10) / 10,
      cached_mb: d.CacheMB ?? 0, nonpaged_pool_mb: d.NonpagedMB ?? 0, paged_pool_mb: d.PagedMB ?? 0,
      top_consumers: consumers, timestamp: Date.now(),
    }
  } catch (e: any) {
    logger.warn('MemSnapshot failed', { err: e.message })
    return null
  }
}

export function getLeakCandidates(): LeakCandidate[] {
  const candidates: LeakCandidate[] = []
  const now = Date.now()
  for (const [key, samples] of leakTracker) {
    if (samples.length < 5) continue
    const recent = samples.filter(s => now - s.ts < LEAK_WINDOW_MS)
    if (recent.length < 5) continue
    const oldest = recent[0], newest = recent[recent.length - 1]
    const deltaMs = newest.ts - oldest.ts
    if (deltaMs < 60_000) continue  // need at least 1 minute of data
    const deltaMb = newest.mb - oldest.mb
    const ratePerMin = (deltaMb / deltaMs) * 60_000
    if (ratePerMin < LEAK_GROWTH_THRESHOLD_MB_MIN) continue
    const [name, pidStr] = key.split(':')
    const pid = parseInt(pidStr, 10)
    const confidence: LeakCandidate['confidence'] = recent.length >= 15 ? 'high' : recent.length >= 8 ? 'medium' : 'low'
    candidates.push({
      name, pid, growth_rate_mb_per_min: Math.round(ratePerMin * 10) / 10,
      samples: recent.length, first_seen_mb: oldest.mb, current_mb: newest.mb, confidence
    })
  }
  return candidates.sort((a, b) => b.growth_rate_mb_per_min - a.growth_rate_mb_per_min)
}

export function trimLeakTracker(): void {
  const now = Date.now()
  for (const [key, samples] of leakTracker) {
    const pruned = samples.filter(s => now - s.ts < LEAK_WINDOW_MS)
    if (pruned.length === 0) leakTracker.delete(key)
    else leakTracker.set(key, pruned)
  }
}
