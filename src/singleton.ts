import { writeFileSync, readFileSync, existsSync, unlinkSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'
import { getLogger } from './logger/index.js'

const LOCK_FILE = join(process.env['TEMP'] ?? 'C:\\Windows\\Temp', 'AEGIS.lock')
const SIGNAL_FILE = join(process.env['TEMP'] ?? 'C:\\Windows\\Temp', 'AEGIS.signal')

function isProcessRunning(pid: number): boolean {
  try {
    const result = execSync(`tasklist /FI "PID eq ${pid}"`, {
      encoding: 'utf-8',
      stdio: 'pipe',
    })
    return result.includes(pid.toString())
  } catch {
    return false
  }
}

export function acquireSingleInstance(): boolean {
  const logger = getLogger()
  const currentPid = process.pid.toString()

  if (existsSync(LOCK_FILE)) {
    try {
      const lockContent = readFileSync(LOCK_FILE, 'utf-8').trim()
      const lockPid = parseInt(lockContent, 10)

      if (!isNaN(lockPid) && isProcessRunning(lockPid)) {
        logger.info('Another instance is running', { pid: lockPid })
        return false
      }
      logger.info('Removing stale lock file', { pid: lockPid })
      unlinkSync(LOCK_FILE)
    } catch (error) {
      logger.warn('Error checking lock file', { error })
    }
  }

  try {
    writeFileSync(LOCK_FILE, currentPid)
    logger.info('Acquired single instance lock', { pid: currentPid })
    return true
  } catch (error) {
    logger.error('Failed to create lock file', { error })
    return false
  }
}

export function releaseSingleInstance(): void {
  const logger = getLogger()
  try {
    if (existsSync(LOCK_FILE)) {
      unlinkSync(LOCK_FILE)
      logger.info('Released single instance lock')
    }
  } catch (error) {
    logger.warn('Error releasing lock file', { error })
  }
}

export function watchForSignal(onSignal: () => void): void {
  const logger = getLogger()
  const interval = setInterval(() => {
    if (existsSync(SIGNAL_FILE)) {
      logger.info('Received signal from another instance')
      onSignal()
      try {
        unlinkSync(SIGNAL_FILE)
      } catch {
        // Ignore cleanup errors
      }
    }
  }, 1000)

  process.on('exit', () => clearInterval(interval))
}

export function sendSignalToRunningInstance(): void {
  const logger = getLogger()
  try {
    writeFileSync(SIGNAL_FILE, Date.now().toString())
    logger.info('Sent signal to running instance')
  } catch (error) {
    logger.warn('Failed to send signal', { error })
  }
}
