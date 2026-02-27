import yaml from 'js-yaml'
import { readFileSync } from 'fs'
import { LoadedProfile, profileSchema } from '../config/types.js'

function fillProfileDefaults(data: unknown): LoadedProfile {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Profile must be an object')
  }

  const obj = data as Record<string, unknown>
  const profile = obj.profile as Record<string, unknown> | undefined

  if (typeof profile !== 'object' || profile === null) {
    throw new Error('Profile must have a profile section')
  }

  const filled = {
    ...profile,
    elevated_processes: Array.isArray(profile.elevated_processes)
      ? profile.elevated_processes
      : [],
    throttled_processes: Array.isArray(profile.throttled_processes)
      ? profile.throttled_processes
      : [],
    network_qos: Array.isArray(profile.network_qos)
      ? profile.network_qos
      : [],
    watchdog: Array.isArray(profile.watchdog)
      ? profile.watchdog
      : [],
    memory: {
      trim_background_working_sets: false,
      trim_interval_min: 5,
      low_memory_threshold_mb: 512,
      preflight_trim_on_activate: false,
      ...(typeof profile.memory === 'object' &&
      profile.memory !== null
        ? (profile.memory as Record<string, unknown>)
        : {}),
    },
    system: {
      purge_standby_memory: false,
      standby_purge_interval_min: 10,
      reenforce_priorities: false,
      reenforce_interval_sec: 30,
      pause_services: [],
      disable_power_throttling: false,
      flush_temp_on_activate: false,
      ...(typeof profile.system === 'object' &&
      profile.system !== null
        ? (profile.system as Record<string, unknown>)
        : {}),
    },
  }

  return profileSchema.parse(filled) as LoadedProfile
}

export function loadProfileFromFile(filePath: string): LoadedProfile {
  const content = readFileSync(filePath, 'utf-8')
  const parsed = yaml.load(content)
  return fillProfileDefaults(parsed)
}
