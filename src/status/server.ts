import express from 'express'
import { getLogger } from '../logger/index.js'
import type { SystemSnapshot } from '../config/types.js'
import type { Server } from 'http'

export class StatusServer {
  private app = express()
  private server: Server | null = null
  private port: number
  private snapshot: SystemSnapshot | null = null
  private switchCallback:
    | ((profileName: string) => Promise<void>)
    | null = null
  private timerSetCallback:
    | ((profile: string, durationMin: number) => Promise<void>)
    | null = null
  private timerCancelCallback: (() => Promise<void>) | null = null
  private logger = getLogger()

  constructor(port: number) {
    this.port = port
    this.setupRoutes()
  }

  private setupRoutes(): void {
    this.app.use(express.json())

    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', 'localhost')
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      res.header('Access-Control-Allow-Headers', 'Content-Type')
      next()
    })

    this.app.get('/status', (_req, res) => {
      if (this.snapshot === null) {
        res.status(503).json({ error: 'Status not available' })
        return
      }
      res.json(this.snapshot)
    })

    this.app.get('/profiles', (req, res) => {
      res.json([])
    })

    this.app.post('/switch', (req, res): void => {
      void (async (): Promise<void> => {
        const body = req.body as Record<string, unknown> | undefined
        const profile = body?.profile
        if (typeof profile !== 'string') {
          res.status(400).json({ error: 'Missing profile name' })
          return
        }

        try {
          if (this.switchCallback !== null) {
            await this.switchCallback(profile)
          }
          res.json({ success: true })
        } catch (error) {
          this.logger.error('Switch profile failed', { profile, error })
          res.status(500).json({ error: 'Switch failed' })
        }
      })()
    })

    this.app.post('/timer/set', (req, res): void => {
      void (async (): Promise<void> => {
        const body = req.body as Record<string, unknown> | undefined
        const profile = body?.profile
        const durationMin = body?.duration_min

        if (typeof profile !== 'string' || typeof durationMin !== 'number') {
          res.status(400).json({ error: 'Missing profile or duration_min' })
          return
        }

        try {
          if (this.timerSetCallback !== null) {
            await this.timerSetCallback(profile, durationMin)
          }
          res.json({ success: true })
        } catch (error) {
          this.logger.error('Timer set failed', { profile, durationMin, error })
          res.status(500).json({ error: 'Timer set failed' })
        }
      })()
    })

    this.app.post('/timer/cancel', (_req, res): void => {
      void (async (): Promise<void> => {
        try {
          if (this.timerCancelCallback !== null) {
            await this.timerCancelCallback()
          }
          res.json({ success: true })
        } catch (error) {
          this.logger.error('Timer cancel failed', { error })
          res.status(500).json({ error: 'Timer cancel failed' })
        }
      })()
    })

    this.app.get('/health', (_req, res) => {
      res.json({ alive: true, version: '2.0.0' })
    })
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port, () => {
        this.logger.info('Status server started', { port: this.port })
        resolve()
      })

      this.server?.on('error', (error) => {
        this.logger.error('Status server error', { error })
        reject(error)
      })
    })
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server === null) {
        resolve()
        return
      }

      this.server.close(() => {
        this.logger.info('Status server stopped')
        this.server = null
        resolve()
      })
    })
  }

  updateSnapshot(snapshot: SystemSnapshot): void {
    this.snapshot = snapshot
  }

  onSwitch(callback: (profileName: string) => Promise<void>): void {
    this.switchCallback = callback
  }

  onTimerSet(
    callback: (profile: string, durationMin: number) => Promise<void>
  ): void {
    this.timerSetCallback = callback
  }

  onTimerCancel(callback: () => Promise<void>): void {
    this.timerCancelCallback = callback
  }
}
