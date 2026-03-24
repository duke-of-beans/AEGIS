import { z } from 'zod'

// ============================================================
// CPU/IO/Memory Priorities
// ============================================================

export type CpuPriority = 'high' | 'above_normal' | 'normal' | 'below_normal' | 'idle'
export type IoPriority = 'high' | 'normal' | 'low' | 'background'
export type MemoryPriority = 'high' | 'above_normal' | 'normal' | 'below_normal' | 'idle'

// ============================================================
// Process Management Types
// ============================================================

export interface ProcessEntry {
  name: string
  cpu_priority: CpuPriority
  io_priority: IoPriority
  memory_priority: MemoryPriority
  cpu_affinity: string | null
  disable_power_throttling: boolean
}

export interface QosEntry {
  app: string
  priority: 'critical' | 'high' | 'normal' | 'background'
  dscp: number
}

export interface WatchdogEntry {
  process: string
  restart_on_crash: boolean
  restart_delay_sec: number
  max_restarts: number
  backoff: 'fixed' | 'exponential'
  pre_restart_script: string | null
  post_restart_script: string | null
}

export interface MemoryConfig {
  trim_background_working_sets: boolean
  trim_interval_min: number
  low_memory_threshold_mb: number
  preflight_trim_on_activate: boolean
}

export interface SystemConfig {
  purge_standby_memory: boolean
  standby_purge_interval_min: number
  reenforce_priorities: boolean
  reenforce_interval_sec: number
  pause_services: string[]
  disable_power_throttling: boolean
  flush_temp_on_activate: boolean
}

// ============================================================
// Auto-Detection Types
// ============================================================

export interface AutoDetectTrigger {
  process: string
}

export interface AutoDetectConfig {
  enabled: boolean
  mode: 'suggest' | 'auto'
  debounce_sec: number
  cooldown_min: number
  anti_flap_max_switches: number
  anti_flap_window_min: number
}

// ============================================================
// Profile YAML Structure
// ============================================================

export interface BrowserSuspensionOverride {
  enabled?: boolean
  inactivity_threshold_min?: number
  memory_pressure_threshold_mb?: number
  cdp_port?: number
}

export interface LoadedProfile {
  name: string
  display_name: string
  description: string
  icon: string
  color: string
  power_plan: string
  auto_detect?: {
    triggers: AutoDetectTrigger[]
    require_all: boolean
    mode: 'suggest' | 'auto'
  } | undefined
  on_activate?: { script: string | null } | undefined
  on_deactivate?: { script: string | null } | undefined
  elevated_processes: ProcessEntry[]
  throttled_processes: ProcessEntry[]
  network_qos: QosEntry[]
  watchdog: WatchdogEntry[]
  memory: MemoryConfig
  system: SystemConfig
  browser_suspension?: BrowserSuspensionOverride | undefined
}

// ============================================================
// Global Config (aegis-config.yaml)
// ============================================================

export interface StatusWindowConfig {
  enabled: boolean
  port: number
  auto_open_on_launch: boolean
  prefetch_on_tray_hover: boolean
}

export interface McpServerConfig {
  enabled: boolean
  port: number
}

export interface KernlConfig {
  enabled: boolean
  port: number
  host: string
  reconnect_interval_sec: number
  reconnect_max_sec: number
  silent_failures: boolean
}

export interface WorkerConfig {
  transport: 'stdio' | 'named_pipe'
  heartbeat_interval_sec: number
  heartbeat_timeout_sec: number
  max_restarts: number
  restart_delay_sec: number
}

export interface LoggingConfig {
  level: string
  log_dir: string
  rotate: string
  max_files: number
}

export interface NotificationsConfig {
  profile_switch: boolean
  timer_expired: boolean
  watchdog_restart: boolean
  worker_crash: boolean
  kernl_state_change: boolean
}

export interface StartupConfig {
  task_name: string
}

// ============================================================
// Browser Manager Types (AEGIS-BRAVE-01)
// ============================================================

export interface TabSuspensionConfig {
  enabled: boolean
  cdp_port: number
  inactivity_threshold_min: number
  max_suspended_tabs: number
  whitelist: string[]
  memory_pressure_threshold_mb: number
  poll_interval_sec: number
}

export interface BrowserManagerConfig {
  enabled: boolean
  browser: 'brave' | 'chrome' | 'chromium'
  tab_suspension: TabSuspensionConfig
}

export interface TabState {
  id: string
  url: string
  title: string
  suspended: boolean
  original_url: string | null
  last_active_ms: number
  suspended_at_ms: number | null
}

export interface AegisConfig {
  version: string
  default_profile: string
  profile_order: string[]
  profiles_dir: string
  status_window: StatusWindowConfig
  mcp_server: McpServerConfig
  kernl: KernlConfig
  auto_detect: AutoDetectConfig
  worker: WorkerConfig
  logging: LoggingConfig
  notifications: NotificationsConfig
  startup: StartupConfig
  browser_manager: BrowserManagerConfig
}

// ============================================================
// Runtime State Types
// ============================================================

export interface TimerState {
  active: boolean
  target_profile: string | null
  return_profile: string | null
  started_at: string | null
  duration_min: number | null
  expires_at: string | null
}

export interface ProfileHistoryEntry {
  profile: string
  switched_at: string
}

export interface AutoDetectState {
  last_detection_time: string | null
  last_suggested_profile: string | null
  paused: boolean
  pause_reason: string | null
  cooldown_until: string | null
  anti_flap_switches: number
}

export interface WorkerState {
  status: 'online' | 'restarting' | 'failed' | 'offline'
  pid: number | null
  restart_count: number
  last_restart_time: string | null
  last_heartbeat_time: string | null
}

export interface RuntimeState {
  version: string
  active_profile: string
  previous_profile: string | null
  profile_history: ProfileHistoryEntry[]
  timer: TimerState
  auto_detect: AutoDetectState
  worker: WorkerState
}

// ============================================================
// System Stats (Status Window Response)
// ============================================================

export interface ProcessStats {
  name: string
  pid: number
  cpu_percent: number
  memory_mb: number
  priority: string
  status: string
}

export interface BrowserTabEntry {
  id: string
  title: string
  suspended: boolean
  suspended_ago_min: number | null
}

export interface BrowserTabsSnapshot {
  enabled: boolean
  connected: boolean
  total: number
  active: number
  suspended: number
  memory_recovered_mb: number
  tabs: BrowserTabEntry[]
}

// ============================================================
// Extended Monitor Types (AEGIS-MONITOR-01)
// ============================================================

export interface DriveStats {
  letter: string
  label: string
  size_gb: number
  free_gb: number
  read_bytes_sec: number
  write_bytes_sec: number
  queue_depth: number
}

export interface PhysicalDiskHealth {
  device_id: string
  friendly_name: string
  media_type: 'SSD' | 'HDD' | 'Unspecified'
  operational_status: string
  health_status: 'Healthy' | 'Warning' | 'Unhealthy' | 'Unknown'
  size_gb: number
}

export interface NetworkAdapterStats {
  name: string
  bytes_sent_sec: number
  bytes_recv_sec: number
  packets_sent_sec: number
  packets_recv_sec: number
  status: string
  link_speed_mbps: number
}

export interface GpuStats {
  available: boolean
  source: 'nvidia-smi' | 'wmi' | 'none'
  gpus: Array<{
    gpu_util_percent: number
    mem_util_percent: number
    vram_used_mb: number
    vram_total_mb: number
    temp_celsius: number
    power_watts: number
    name?: string
  }>
}

export interface SystemExtended {
  dpc_rate: number
  interrupt_rate: number
  page_faults_sec: number
  page_reads_sec: number
  uptime_sec: number
}

export interface ProcessTreeEntry {
  pid: number
  parent_pid: number
  name: string
  memory_mb: number
  cpu_user_ms: number
  cpu_kernel_ms: number
  handle_count: number
  thread_count: number
  path: string | null
}

export interface SystemSnapshot {
  timestamp: string
  version: string
  active_profile: string
  active_profile_color: string
  cpu_percent: number
  memory_percent: number
  memory_mb_used: number
  memory_mb_available: number
  power_plan: { guid: string; name: string }
  processes: ProcessStats[]
  timer: TimerState
  worker_status: 'online' | 'restarting' | 'failed'
  browser_tabs?: BrowserTabsSnapshot
  isElevated?: boolean
  unresolved_count?: number
  suspicious_count?: number
  disk_stats?: { drives: DriveStats[]; physical_disks: PhysicalDiskHealth[] }
  network_stats?: { adapters: NetworkAdapterStats[] }
  gpu_stats?: GpuStats
  system_extended?: SystemExtended
  process_tree?: ProcessTreeEntry[]
}

// ============================================================
// Worker IPC Types
// ============================================================

export interface WorkerRequest {
  jsonrpc: '2.0'
  id: string
  method: string
  params?: Record<string, unknown>
}

export interface WorkerResponse {
  jsonrpc: '2.0'
  id: string
  result?: Record<string, unknown>
  error?: { code: number; message: string }
}

export interface WorkerHeartbeat {
  jsonrpc: '2.0'
  method: 'heartbeat'
  params: { timestamp: string; pid: number }
}

// ============================================================
// Zod Validation Schemas
// ============================================================

const cpuPrioritySchema = z.enum([
  'high',
  'above_normal',
  'normal',
  'below_normal',
  'idle',
])
const ioPrioritySchema = z.enum(['high', 'normal', 'low', 'background'])
const memoryPrioritySchema = z.enum([
  'high',
  'above_normal',
  'normal',
  'below_normal',
  'idle',
])

const processEntrySchema: z.ZodType<ProcessEntry> = z.object({
  name: z.string(),
  cpu_priority: cpuPrioritySchema,
  io_priority: ioPrioritySchema,
  memory_priority: memoryPrioritySchema,
  cpu_affinity: z.string().nullable(),
  disable_power_throttling: z.boolean(),
})

const qosEntrySchema: z.ZodType<QosEntry> = z.object({
  app: z.string(),
  priority: z.enum(['critical', 'high', 'normal', 'background']),
  dscp: z.number(),
})

const watchdogEntrySchema: z.ZodType<WatchdogEntry> = z.object({
  process: z.string(),
  restart_on_crash: z.boolean(),
  restart_delay_sec: z.number(),
  max_restarts: z.number(),
  backoff: z.enum(['fixed', 'exponential']),
  pre_restart_script: z.string().nullable(),
  post_restart_script: z.string().nullable(),
})

const memoryConfigSchema: z.ZodType<MemoryConfig> = z.object({
  trim_background_working_sets: z.boolean(),
  trim_interval_min: z.number(),
  low_memory_threshold_mb: z.number(),
  preflight_trim_on_activate: z.boolean(),
})

const systemConfigSchema: z.ZodType<SystemConfig> = z.object({
  purge_standby_memory: z.boolean(),
  standby_purge_interval_min: z.number(),
  reenforce_priorities: z.boolean(),
  reenforce_interval_sec: z.number(),
  pause_services: z.array(z.string()),
  disable_power_throttling: z.boolean(),
  flush_temp_on_activate: z.boolean(),
})

// Note: not annotated as ZodType<LoadedProfile> because .default() makes
// array inputs optional in the input type while remaining required in output.
// The parse result is cast to LoadedProfile at the call site.
export const profileSchema = z.object({
  name: z.string(),
  display_name: z.string(),
  description: z.string(),
  icon: z.string(),
  color: z.string(),
  power_plan: z.string(),
  auto_detect: z
    .object({
      triggers: z.array(z.object({ process: z.string() })),
      require_all: z.boolean(),
      mode: z.enum(['suggest', 'auto']),
    })
    .optional(),
  on_activate: z
    .object({ script: z.string().nullable() })
    .optional(),
  on_deactivate: z
    .object({ script: z.string().nullable() })
    .optional(),
  elevated_processes: z.array(processEntrySchema).default([]),
  throttled_processes: z.array(processEntrySchema).default([]),
  network_qos: z.array(qosEntrySchema).default([]),
  watchdog: z.array(watchdogEntrySchema).default([]),
  memory: memoryConfigSchema,
  system: systemConfigSchema,
  browser_suspension: z
    .object({
      enabled: z.boolean().optional(),
      inactivity_threshold_min: z.number().optional(),
      memory_pressure_threshold_mb: z.number().optional(),
      cdp_port: z.number().optional(),
    })
    .optional(),
})

const statusWindowConfigSchema: z.ZodType<StatusWindowConfig> = z.object({
  enabled: z.boolean(),
  port: z.number(),
  auto_open_on_launch: z.boolean(),
  prefetch_on_tray_hover: z.boolean(),
})

const mcpServerConfigSchema: z.ZodType<McpServerConfig> = z.object({
  enabled: z.boolean(),
  port: z.number(),
})

const kernlConfigSchema: z.ZodType<KernlConfig> = z.object({
  enabled: z.boolean(),
  port: z.number(),
  host: z.string(),
  reconnect_interval_sec: z.number(),
  reconnect_max_sec: z.number(),
  silent_failures: z.boolean(),
})

const autoDetectConfigSchema: z.ZodType<AutoDetectConfig> = z.object({
  enabled: z.boolean(),
  mode: z.enum(['suggest', 'auto']),
  debounce_sec: z.number(),
  cooldown_min: z.number(),
  anti_flap_max_switches: z.number(),
  anti_flap_window_min: z.number(),
})

const workerConfigSchema: z.ZodType<WorkerConfig> = z.object({
  transport: z.enum(['stdio', 'named_pipe']),
  heartbeat_interval_sec: z.number(),
  heartbeat_timeout_sec: z.number(),
  max_restarts: z.number(),
  restart_delay_sec: z.number(),
})

const loggingConfigSchema: z.ZodType<LoggingConfig> = z.object({
  level: z.string(),
  log_dir: z.string(),
  rotate: z.string(),
  max_files: z.number(),
})

const notificationsConfigSchema: z.ZodType<NotificationsConfig> = z.object({
  profile_switch: z.boolean(),
  timer_expired: z.boolean(),
  watchdog_restart: z.boolean(),
  worker_crash: z.boolean(),
  kernl_state_change: z.boolean(),
})

const startupConfigSchema: z.ZodType<StartupConfig> = z.object({
  task_name: z.string(),
})

const tabSuspensionConfigSchema: z.ZodType<TabSuspensionConfig> = z.object({
  enabled: z.boolean(),
  cdp_port: z.number(),
  inactivity_threshold_min: z.number(),
  max_suspended_tabs: z.number(),
  whitelist: z.array(z.string()),
  memory_pressure_threshold_mb: z.number(),
  poll_interval_sec: z.number(),
})

export const browserManagerConfigSchema: z.ZodType<BrowserManagerConfig> = z.object({
  enabled: z.boolean(),
  browser: z.enum(['brave', 'chrome', 'chromium']),
  tab_suspension: tabSuspensionConfigSchema,
})

export const aegisConfigSchema: z.ZodType<AegisConfig> = z.object({
  version: z.string(),
  default_profile: z.string(),
  profile_order: z.array(z.string()),
  profiles_dir: z.string(),
  status_window: statusWindowConfigSchema,
  mcp_server: mcpServerConfigSchema,
  kernl: kernlConfigSchema,
  auto_detect: autoDetectConfigSchema,
  worker: workerConfigSchema,
  logging: loggingConfigSchema,
  notifications: notificationsConfigSchema,
  startup: startupConfigSchema,
  browser_manager: browserManagerConfigSchema,
})

export const runtimeStateSchema: z.ZodType<RuntimeState> = z.object({
  version: z.string(),
  active_profile: z.string(),
  previous_profile: z.string().nullable(),
  profile_history: z.array(
    z.object({ profile: z.string(), switched_at: z.string() })
  ),
  timer: z.object({
    active: z.boolean(),
    target_profile: z.string().nullable(),
    return_profile: z.string().nullable(),
    started_at: z.string().nullable(),
    duration_min: z.number().nullable(),
    expires_at: z.string().nullable(),
  }),
  auto_detect: z.object({
    last_detection_time: z.string().nullable(),
    last_suggested_profile: z.string().nullable(),
    paused: z.boolean(),
    pause_reason: z.string().nullable(),
    cooldown_until: z.string().nullable(),
    anti_flap_switches: z.number(),
  }),
  worker: z.object({
    status: z.enum(['online', 'restarting', 'failed', 'offline']),
    pid: z.number().nullable(),
    restart_count: z.number(),
    last_restart_time: z.string().nullable(),
    last_heartbeat_time: z.string().nullable(),
  }),
})
