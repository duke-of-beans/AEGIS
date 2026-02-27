import { spawn, ChildProcess } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { getLogger } from '../logger/index.js'
import { WorkerIpc } from './ipc.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

export type WorkerStatus = 'starting' | 'running' | 'restarting' | 'failed' | 'stopped'

export class WorkerManager {
  private status: WorkerStatus = 'stopped'
  private ipcInstance: WorkerIpc | null = null
  private process: ChildProcess | null = null
  private restartCount = 0
  private maxRestarts = 10
  private restartDelay = 5000
  private heartbeatTimeout: NodeJS.Timeout | null = null
  private heartbeatInterval = 45000
  private statusChangeCallback: ((status: WorkerStatus) => void) | null = null
  private logger = getLogger()

  get ipc(): WorkerIpc | null {
    return this.ipcInstance
  }

  async start(): Promise<void> {
    if (this.status !== 'stopped') {
      this.logger.warn('Worker already started or starting', { status: this.status })
      return
    }

    this.setStatus('starting')

    const workerPath = join(__dirname, '../../scripts/aegis-worker.ps1')

    this.process = spawn('pwsh.exe', [
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      workerPath,
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })

    this.ipcInstance = new WorkerIpc(this.process)

    this.ipcInstance.onHeartbeat(() => {
      this.resetHeartbeatTimeout()
    })

    this.ipcInstance.onUnexpectedExit((code) => {
      this.logger.warn('Worker process exited unexpectedly', { code })
      this.ipcInstance = null
      this.process = null
      if (this.status !== 'stopped') {
        void this.restart()
      }
    })

    try {
      await this.ipcInstance.call('version', {}, { timeout: 10000 })
      this.setStatus('running')
      this.resetHeartbeatTimeout()
      this.logger.info('Worker started successfully')
    } catch (error) {
      this.logger.error('Worker version handshake failed', { error })
      this.kill()
      this.setStatus('failed')
      throw error
    }
  }

  async stop(): Promise<void> {
    if (this.status === 'stopped') {
      return
    }

    this.setStatus('stopped')

    if (this.heartbeatTimeout !== null) {
      clearTimeout(this.heartbeatTimeout)
      this.heartbeatTimeout = null
    }

    if (this.ipcInstance !== null) {
      try {
        await this.ipcInstance.call('shutdown', {}, { timeout: 3000 })
      } catch {
        this.logger.warn('Worker shutdown call failed, killing process')
      }
      this.ipcInstance.dispose()
      this.ipcInstance = null
    }

    this.kill()
    this.logger.info('Worker stopped')
  }

  async restart(): Promise<void> {
    this.logger.info('Restarting worker', { attempt: this.restartCount + 1 })

    if (this.restartCount >= this.maxRestarts) {
      this.setStatus('failed')
      this.logger.error('Worker exceeded max restarts')
      return
    }

    this.restartCount += 1
    await new Promise((resolve) => setTimeout(resolve, this.restartDelay))

    try {
      this.kill()
      await this.start()
      this.restartCount = 0
    } catch (error) {
      this.logger.error('Worker restart failed', { error })
      this.setStatus('failed')
    }
  }

  onStatusChange(callback: (status: WorkerStatus) => void): void {
    this.statusChangeCallback = callback
  }

  getRestartCount(): number {
    return this.restartCount
  }

  private resetHeartbeatTimeout(): void {
    if (this.heartbeatTimeout !== null) {
      clearTimeout(this.heartbeatTimeout)
    }

    this.heartbeatTimeout = setTimeout(() => {
      this.logger.warn('Worker heartbeat timeout')
      if (this.status === 'running') {
        void this.restart()
      }
    }, this.heartbeatInterval)
  }

  private kill(): void {
    if (this.process !== null && !this.process.killed) {
      this.process.kill()
      this.process = null
    }
  }

  private setStatus(newStatus: WorkerStatus): void {
    if (this.status === newStatus) {
      return
    }
    this.status = newStatus
    this.logger.debug('Worker status changed', { status: newStatus })
    if (this.statusChangeCallback !== null) {
      this.statusChangeCallback(newStatus)
    }
  }

  getStatus(): WorkerStatus {
    return this.status
  }
}
