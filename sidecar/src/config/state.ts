import { readFileSync, writeFileSync } from 'fs'
import { RuntimeState, runtimeStateSchema } from './types.js'
import { getLogger } from '../logger/index.js'

let currentState: RuntimeState | null = null
let stateFilePath: string | null = null
let autoSaveInterval: NodeJS.Timeout | null = null

const PACKAGE_VERSION = '2.0.0'

function getDefaultState(): RuntimeState {
  return {
    version: PACKAGE_VERSION,
    active_profile: '',
    previous_profile: null,
    profile_history: [],
    timer: {
      active: false,
      target_profile: null,
      return_profile: null,
      started_at: null,
      duration_min: null,
      expires_at: null,
    },
    auto_detect: {
      last_detection_time: null,
      last_suggested_profile: null,
      paused: false,
      pause_reason: null,
      cooldown_until: null,
      anti_flap_switches: 0,
    },
    worker: {
      status: 'offline' as const,
      pid: null,
      restart_count: 0,
      last_restart_time: null,
      last_heartbeat_time: null,
    },
  }
}

export function loadState(filePath: string): RuntimeState {
  const logger = getLogger()
  try {
    const content = readFileSync(filePath, 'utf-8')
    const parsed = JSON.parse(content) as unknown
    const validated = runtimeStateSchema.parse(parsed)
    currentState = validated
    stateFilePath = filePath
    return validated
  } catch (error) {
    logger.warn('Failed to load state file, using defaults', { error })
    const defaultState = getDefaultState()
    currentState = defaultState
    stateFilePath = filePath
    return defaultState
  }
}

export function saveState(filePath: string, state: RuntimeState): void {
  const logger = getLogger()
  try {
    const validated = runtimeStateSchema.parse(state)
    writeFileSync(filePath, JSON.stringify(validated, null, 2))
  } catch (error) {
    logger.error('Failed to save state', { error })
    throw error
  }
}

export function getState(): RuntimeState {
  if (currentState === null) {
    return getDefaultState()
  }
  return currentState
}

export function updateState(patch: Partial<RuntimeState>): void {
  const current = getState()
  currentState = { ...current, ...patch }
}

export function startAutoSave(
  filePath: string,
  intervalMs: number = 30000
): void {
  stateFilePath = filePath
  if (autoSaveInterval !== null) {
    clearInterval(autoSaveInterval)
  }
  autoSaveInterval = setInterval(() => {
    if (currentState !== null && stateFilePath !== null) {
      saveState(stateFilePath, currentState)
    }
  }, intervalMs)
}

export function stopAutoSave(): void {
  if (autoSaveInterval !== null) {
    clearInterval(autoSaveInterval)
    autoSaveInterval = null
  }
  if (currentState !== null && stateFilePath !== null) {
    saveState(stateFilePath, currentState)
  }
}
