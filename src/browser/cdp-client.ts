import { getLogger } from '../logger/index.js'
import WebSocket from 'ws'

const CDP_TIMEOUT_MS = 5000

export interface CdpTarget {
  id: string
  url: string
  title: string
  type: string
  webSocketDebuggerUrl: string | undefined
}

export class CdpClient {
  private port: number
  private logger = getLogger()
  private connected = false

  constructor(port: number) {
    this.port = port
  }

  async connect(): Promise<void> {
    // Validate the endpoint is reachable
    try {
      const targets = await this.getTargets()
      this.connected = targets !== undefined
      this.logger.info('CDP client connected', { port: this.port })
    } catch (error) {
      this.connected = false
      this.logger.warn('CDP connect failed', { port: this.port, error })
    }
  }

  async getTargets(): Promise<CdpTarget[]> {
    try {
      const response = await this.fetchWithTimeout(
        `http://localhost:${this.port}/json/list`
      )
      if (!response.ok) {
        this.logger.warn('CDP getTargets HTTP error', { status: response.status })
        return []
      }
      const raw = (await response.json()) as Array<Record<string, unknown>>
      return raw
        .filter((t) => t['type'] === 'page')
        .map((t) => ({
          id: String(t['id'] ?? ''),
          url: String(t['url'] ?? ''),
          title: String(t['title'] ?? ''),
          type: String(t['type'] ?? ''),
          webSocketDebuggerUrl:
            typeof t['webSocketDebuggerUrl'] === 'string'
              ? t['webSocketDebuggerUrl']
              : undefined,
        }))
    } catch (error) {
      this.logger.warn('CDP getTargets failed', { error })
      return []
    }
  }

  async navigateTab(targetId: string, url: string): Promise<void> {
    // Need the debugger URL for this target — fetch target list to find it
    let debuggerUrl: string | undefined
    try {
      const targets = await this.getTargets()
      const target = targets.find((t) => t.id === targetId)
      debuggerUrl = target?.webSocketDebuggerUrl
    } catch {
      this.logger.warn('CDP navigateTab: could not resolve debugger URL', {
        targetId,
      })
      return
    }

    if (debuggerUrl === undefined) {
      this.logger.warn('CDP navigateTab: no debugger URL for target', {
        targetId,
      })
      return
    }

    return new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        this.logger.warn('CDP navigateTab timed out', { targetId, url })
        ws.terminate()
        resolve()
      }, CDP_TIMEOUT_MS)

      let resolved = false
      const ws = new WebSocket(debuggerUrl as string)

      ws.on('open', () => {
        const msg = JSON.stringify({
          method: 'Page.navigate',
          params: { url },
          id: 1,
        })
        ws.send(msg)
      })

      ws.on('message', (data: WebSocket.RawData) => {
        try {
          const parsed = JSON.parse(data.toString()) as { id?: number }
          if (parsed.id === 1 && !resolved) {
            resolved = true
            clearTimeout(timeout)
            ws.close()
            resolve()
          }
        } catch {
          // ignore parse errors
        }
      })

      ws.on('error', (err) => {
        if (!resolved) {
          resolved = true
          clearTimeout(timeout)
          this.logger.warn('CDP WebSocket error during navigate', {
            targetId,
            error: err,
          })
          resolve()
        }
      })

      ws.on('close', () => {
        if (!resolved) {
          resolved = true
          clearTimeout(timeout)
          resolve()
        }
      })
    })
  }

  async activateTab(targetId: string): Promise<void> {
    try {
      await this.fetchWithTimeout(
        `http://localhost:${this.port}/json/activate/${targetId}`
      )
    } catch (error) {
      this.logger.warn('CDP activateTab failed', { targetId, error })
    }
  }

  isConnected(): boolean {
    return this.connected
  }

  disconnect(): void {
    this.connected = false
  }

  private fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), CDP_TIMEOUT_MS)
    return fetch(url, { signal: controller.signal }).finally(() =>
      clearTimeout(timer)
    )
  }
}
