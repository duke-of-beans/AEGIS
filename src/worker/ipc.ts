import { ChildProcess } from 'child_process'
import { randomUUID } from 'crypto'
import { getLogger } from '../logger/index.js'
import type {
  WorkerRequest,
  WorkerResponse,
  WorkerHeartbeat,
} from '../config/types.js'

interface PendingRequest {
  method: string
  resolve: (value: Record<string, unknown>) => void
  reject: (error: Error) => void
  timeout: NodeJS.Timeout
}

export interface IpcOptions {
  timeout?: number
}

export class WorkerIpc {
  private process: ChildProcess
  private pendingRequests = new Map<string, PendingRequest>()
  private buffer = ''
  private heartbeatCallback:
    | ((timestamp: string, pid: number) => void)
    | null = null
  private unexpectedExitCallback: ((code: number | null) => void) | null = null
  private logger = getLogger()

  constructor(process: ChildProcess) {
    this.process = process

    if (this.process.stdout === null) {
      throw new Error('Worker process stdout is null')
    }

    this.process.stdout.on('data', (chunk) => {
      this.buffer += String(chunk)
      this.processLines()
    })

    this.process.on('exit', (code) => {
      if (this.unexpectedExitCallback !== null) {
        this.unexpectedExitCallback(code)
      }
      this.rejectAllPending(new Error(`Worker exited with code ${code}`))
    })
  }

  private processLines(): void {
    const lines = this.buffer.split('\n')
    this.buffer = lines[lines.length - 1] ?? ''

    for (let i = 0; i < lines.length - 1; i++) {
      const line = lines[i]
      if (line === undefined || line.trim() === '') continue

      try {
        const data = JSON.parse(line) as
          | WorkerResponse
          | WorkerHeartbeat
          | Record<string, unknown>

        if (
          typeof data === 'object' &&
          data !== null &&
          'method' in data &&
          data.method === 'heartbeat'
        ) {
          const hb = data as WorkerHeartbeat
          const timestamp =
            typeof hb.params?.timestamp === 'string'
              ? hb.params.timestamp
              : ''
          const pid =
            typeof hb.params?.pid === 'number' ? hb.params.pid : 0
          if (this.heartbeatCallback !== null) {
            this.heartbeatCallback(timestamp, pid)
          }
        } else if (
          typeof data === 'object' &&
          data !== null &&
          'id' in data
        ) {
          const response = data as WorkerResponse
          const pending = this.pendingRequests.get(response.id)
          if (pending !== undefined) {
            clearTimeout(pending.timeout)
            this.pendingRequests.delete(response.id)

            if (response.error !== undefined) {
              const error = new Error(response.error.message)
              pending.reject(error)
            } else if (response.result !== undefined) {
              pending.resolve(response.result)
            } else {
              pending.reject(new Error('Invalid response: no result or error'))
            }
          }
        }
      } catch (error) {
        this.logger.warn('Failed to parse worker message', { line, error })
      }
    }
  }

  async call(
    method: string,
    params?: Record<string, unknown>,
    options?: IpcOptions
  ): Promise<Record<string, unknown>> {
    const timeout = options?.timeout ?? 15000
    const id = randomUUID()

    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(id)
        reject(new Error(`Worker call timeout: ${method}`))
      }, timeout)

      this.pendingRequests.set(id, {
        method,
        resolve,
        reject,
        timeout: timeoutHandle,
      })

      const request: WorkerRequest = {
        jsonrpc: '2.0',
        id,
        method,
        ...(params !== undefined ? { params } : {}),
      }

      const stdin = this.process.stdin
      if (stdin === null) {
        clearTimeout(timeoutHandle)
        this.pendingRequests.delete(id)
        reject(new Error('Worker process stdin is null'))
        return
      }

      stdin.write(JSON.stringify(request) + '\n', (error) => {
        if (error !== undefined) {
          clearTimeout(timeoutHandle)
          this.pendingRequests.delete(id)
          reject(error)
        }
      })
    })
  }

  onHeartbeat(callback: (timestamp: string, pid: number) => void): void {
    this.heartbeatCallback = callback
  }

  onUnexpectedExit(callback: (code: number | null) => void): void {
    this.unexpectedExitCallback = callback
  }

  private rejectAllPending(error: Error): void {
    for (const pending of this.pendingRequests.values()) {
      clearTimeout(pending.timeout)
      pending.reject(error)
    }
    this.pendingRequests.clear()
  }

  dispose(): void {
    this.rejectAllPending(new Error('IPC disposed'))
    this.heartbeatCallback = null
    this.unexpectedExitCallback = null
  }
}
