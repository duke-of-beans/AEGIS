import { getLogger } from '../logger/index.js'
import type { WorkerIpc } from '../worker/ipc.js'
import type {
  DriveStats,
  PhysicalDiskHealth,
  NetworkAdapterStats,
  GpuStats,
  SystemExtended,
  ProcessTreeEntry,
  SystemSnapshot,
} from '../config/types.js'

/**
 * MonitorCollector — polls extended hardware/system metrics on slower cadences.
 * Each metric is independently try/caught — one WMI failure never blocks others.
 * Cadences: disk/network/gpu = 10s, system_extended = 5s, process_tree = 30s.
 */
export class MonitorCollector {
  private ipc!: WorkerIpc
  private logger = getLogger()
  private isRunning = false

  private diskTimer: NodeJS.Timeout | null = null
  private networkTimer: NodeJS.Timeout | null = null
  private gpuTimer: NodeJS.Timeout | null = null
  private extendedTimer: NodeJS.Timeout | null = null
  private treeTimer: NodeJS.Timeout | null = null

  private latestDiskStats: { drives: DriveStats[]; physical_disks: PhysicalDiskHealth[] } | undefined
  private latestNetworkStats: { adapters: NetworkAdapterStats[] } | undefined
  private latestGpuStats: GpuStats | undefined
  private latestSystemExtended: SystemExtended | undefined
  private latestProcessTree: ProcessTreeEntry[] | undefined

  constructor(ipc: WorkerIpc | null) {
    if (ipc !== null) this.ipc = ipc
  }

  start(): void {
    if (this.isRunning) return
    if (this.ipc === null || (this.ipc as unknown) === undefined) {
      return // worker unavailable — skip all hardware polling
    }
    this.isRunning = true
    this.logger.info('MonitorCollector started')

    // Kick off first polls immediately, then schedule repeating timers
    void this.pollDisk()
    void this.pollNetwork()
    void this.pollGpu()
    void this.pollSystemExtended()
    void this.pollProcessTree()

    this.diskTimer     = setInterval(() => { void this.pollDisk() }, 10_000)
    this.networkTimer  = setInterval(() => { void this.pollNetwork() }, 10_000)
    this.gpuTimer      = setInterval(() => { void this.pollGpu() }, 10_000)
    this.extendedTimer = setInterval(() => { void this.pollSystemExtended() }, 5_000)
    this.treeTimer     = setInterval(() => { void this.pollProcessTree() }, 30_000)
  }

  stop(): void {
    if (!this.isRunning) return
    this.isRunning = false

    if (this.diskTimer !== null)     { clearInterval(this.diskTimer);     this.diskTimer = null }
    if (this.networkTimer !== null)  { clearInterval(this.networkTimer);  this.networkTimer = null }
    if (this.gpuTimer !== null)      { clearInterval(this.gpuTimer);      this.gpuTimer = null }
    if (this.extendedTimer !== null) { clearInterval(this.extendedTimer); this.extendedTimer = null }
    if (this.treeTimer !== null)     { clearInterval(this.treeTimer);     this.treeTimer = null }

    this.logger.info('MonitorCollector stopped')
  }

  getLatestExtended(): Partial<SystemSnapshot> {
    const result: Partial<SystemSnapshot> = {}
    if (this.latestDiskStats !== undefined)    result.disk_stats = this.latestDiskStats
    if (this.latestNetworkStats !== undefined) result.network_stats = this.latestNetworkStats
    if (this.latestGpuStats !== undefined)     result.gpu_stats = this.latestGpuStats
    if (this.latestSystemExtended !== undefined) result.system_extended = this.latestSystemExtended
    if (this.latestProcessTree !== undefined)  result.process_tree = this.latestProcessTree
    return result
  }

  private async pollDisk(): Promise<void> {
    if (this.ipc === null) return
    try {
      const r = await this.ipc.call('get_disk_stats', {})
      const drives: DriveStats[] = []
      if (Array.isArray(r['drives'])) {
        for (const d of r['drives'] as Record<string, unknown>[]) {
          drives.push({
            letter:          String(d['letter'] ?? ''),
            label:           String(d['label'] ?? ''),
            size_gb:         Number(d['size_gb'] ?? 0),
            free_gb:         Number(d['free_gb'] ?? 0),
            read_bytes_sec:  Number(d['read_bytes_sec'] ?? 0),
            write_bytes_sec: Number(d['write_bytes_sec'] ?? 0),
            queue_depth:     Number(d['queue_depth'] ?? 0),
          })
        }
      }
      const physicalDisks: PhysicalDiskHealth[] = []
      if (Array.isArray(r['physical_disks'])) {
        for (const pd of r['physical_disks'] as Record<string, unknown>[]) {
          const hs = String(pd['health_status'] ?? 'Unknown')
          const mt = String(pd['media_type'] ?? 'Unspecified')
          physicalDisks.push({
            device_id:          String(pd['device_id'] ?? ''),
            friendly_name:      String(pd['friendly_name'] ?? ''),
            media_type:         (mt === 'SSD' || mt === 'HDD') ? mt : 'Unspecified',
            operational_status: String(pd['operational_status'] ?? ''),
            health_status:      (['Healthy','Warning','Unhealthy'].includes(hs) ? hs : 'Unknown') as PhysicalDiskHealth['health_status'],
            size_gb:            Number(pd['size_gb'] ?? 0),
          })
        }
      }
      this.latestDiskStats = { drives, physical_disks: physicalDisks }
    } catch (error) {
      this.logger.debug('MonitorCollector: disk poll failed', { error })
    }
  }

  private async pollNetwork(): Promise<void> {
    try {
      const r = await this.ipc.call('get_network_stats', {})
      const adapters: NetworkAdapterStats[] = []
      if (Array.isArray(r['adapters'])) {
        for (const a of r['adapters'] as Record<string, unknown>[]) {
          adapters.push({
            name:             String(a['name'] ?? ''),
            bytes_sent_sec:   Number(a['bytes_sent_sec'] ?? 0),
            bytes_recv_sec:   Number(a['bytes_recv_sec'] ?? 0),
            packets_sent_sec: Number(a['packets_sent_sec'] ?? 0),
            packets_recv_sec: Number(a['packets_recv_sec'] ?? 0),
            status:           String(a['status'] ?? 'Unknown'),
            link_speed_mbps:  Number(a['link_speed_mbps'] ?? 0),
          })
        }
      }
      this.latestNetworkStats = { adapters }
    } catch (error) {
      this.logger.debug('MonitorCollector: network poll failed', { error })
    }
  }

  private async pollGpu(): Promise<void> {
    try {
      const r = await this.ipc.call('get_gpu_stats', {})
      const source = String(r['source'] ?? 'none')
      const available = Boolean(r['available'] ?? false)
      const gpus: GpuStats['gpus'] = []
      if (Array.isArray(r['gpus'])) {
        for (const g of r['gpus'] as Record<string, unknown>[]) {
          const entry: GpuStats['gpus'][number] = {
            gpu_util_percent: Number(g['gpu_util_percent'] ?? 0),
            mem_util_percent: Number(g['mem_util_percent'] ?? 0),
            vram_used_mb:     Number(g['vram_used_mb'] ?? 0),
            vram_total_mb:    Number(g['vram_total_mb'] ?? 0),
            temp_celsius:     Number(g['temp_celsius'] ?? 0),
            power_watts:      Number(g['power_watts'] ?? 0),
          }
          if (typeof g['name'] === 'string') entry.name = g['name']
          gpus.push(entry)
        }
      }
      this.latestGpuStats = {
        available,
        source: (['nvidia-smi','wmi','none'].includes(source) ? source : 'none') as GpuStats['source'],
        gpus,
      }
    } catch (error) {
      this.logger.debug('MonitorCollector: GPU poll failed', { error })
    }
  }

  private async pollSystemExtended(): Promise<void> {
    try {
      const r = await this.ipc.call('get_system_extended', {})
      this.latestSystemExtended = {
        dpc_rate:        Number(r['dpc_rate'] ?? 0),
        interrupt_rate:  Number(r['interrupt_rate'] ?? 0),
        page_faults_sec: Number(r['page_faults_sec'] ?? 0),
        page_reads_sec:  Number(r['page_reads_sec'] ?? 0),
        uptime_sec:      Number(r['uptime_sec'] ?? 0),
      }
    } catch (error) {
      this.logger.debug('MonitorCollector: system_extended poll failed', { error })
    }
  }

  private async pollProcessTree(): Promise<void> {
    try {
      const r = await this.ipc.call('get_process_tree', {})
      const entries: ProcessTreeEntry[] = []
      if (Array.isArray(r['processes'])) {
        for (const p of r['processes'] as Record<string, unknown>[]) {
          entries.push({
            pid:           Number(p['pid'] ?? 0),
            parent_pid:    Number(p['parent_pid'] ?? 0),
            name:          String(p['name'] ?? ''),
            memory_mb:     Number(p['memory_mb'] ?? 0),
            cpu_user_ms:   Number(p['cpu_user_ms'] ?? 0),
            cpu_kernel_ms: Number(p['cpu_kernel_ms'] ?? 0),
            handle_count:  Number(p['handle_count'] ?? 0),
            thread_count:  Number(p['thread_count'] ?? 0),
            path:          typeof p['path'] === 'string' ? p['path'] : null,
          })
        }
      }
      this.latestProcessTree = entries
    } catch (error) {
      this.logger.debug('MonitorCollector: process_tree poll failed', { error })
    }
  }
}
