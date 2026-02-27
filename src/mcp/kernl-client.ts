import { getLogger } from '../logger/index.js'
import { KernlConfig } from '../config/types.js'

export class KernlClient {
  private config: KernlConfig
  private status: 'connected' | 'offline' = 'offline'
  private reconnectInterval: NodeJS.Timeout | null = null
  private currentBackoff = 1000
  private tagChangeCallback: ((tag: string) => void) | null = null
  private logger = getLogger()

  constructor(config: KernlConfig) {
    this.config = config
  }

  start(): void {
    if (!this.config.enabled) {
      this.logger.debug('KERNL client disabled')
      return
    }

    this.logger.info('KERNL client starting', {
      host: this.config.host,
      port: this.config.port,
    })

    this.attemptConnect()
  }

  stop(): void {
    if (this.reconnectInterval !== null) {
      clearTimeout(this.reconnectInterval)
      this.reconnectInterval = null
    }
    this.status = 'offline'
    this.logger.info('KERNL client stopped')
  }

  getStatus(): 'connected' | 'offline' {
    return this.status
  }

  onTagChange(callback: (tag: string) => void): void {
    this.tagChangeCallback = callback
  }

  private attemptConnect(): void {
    const url = `http://${this.config.host}:${this.config.port}/status`

    fetch(url, { signal: AbortSignal.timeout(5000) })
      .then((response) => {
        if (response.ok) {
          this.status = 'connected'
          this.currentBackoff = this.config.reconnect_interval_sec * 1000
          this.logger.debug('KERNL connected')

          this.startPolling()
        } else {
          throw new Error(`HTTP ${response.status}`)
        }
      })
      .catch((error: unknown) => {
        if (!this.config.silent_failures) {
          this.logger.warn('KERNL connection failed', { error })
        }

        this.status = 'offline'
        this.scheduleReconnect()
      })
  }

  private startPolling(): void {
    const pollInterval = setInterval(() => {
      void (async (): Promise<void> => {
      try {
        const url = `http://${this.config.host}:${this.config.port}/status`
        const response = await fetch(url, {
          signal: AbortSignal.timeout(5000),
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const data = (await response.json()) as Record<string, unknown> | null
        const tag = data?.['tag']

        if (typeof tag === 'string' && this.tagChangeCallback !== null) {
          this.tagChangeCallback(tag)
        }
      } catch (error) {
        if (!this.config.silent_failures) {
          this.logger.warn('KERNL poll failed', { error })
        }

        clearInterval(pollInterval)
        this.status = 'offline'
        this.scheduleReconnect()
      }
      })()
    }, 30000)
  }

  private scheduleReconnect(): void {
    if (this.reconnectInterval !== null) {
      clearTimeout(this.reconnectInterval)
    }

    const delay = Math.min(
      this.currentBackoff,
      this.config.reconnect_max_sec * 1000
    )

    this.reconnectInterval = setTimeout(() => {
      this.currentBackoff = Math.min(
        this.currentBackoff * 2,
        this.config.reconnect_max_sec * 1000
      )
      this.attemptConnect()
    }, delay)
  }
}
