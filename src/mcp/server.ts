import express from 'express'
import { getLogger } from '../logger/index.js'
import { StatusServer } from '../status/server.js'
import { ProfileManager } from '../profiles/manager.js'
import { ProfileTimer } from '../profiles/timer.js'
import type { Server as HttpServer } from 'http'
import type { WorkerRequest, WorkerResponse } from '../config/types.js'

export class McpServer {
  private statusServer: StatusServer
  private profileManager: ProfileManager
  private timer: ProfileTimer
  private httpServer: HttpServer | null = null
  private logger = getLogger()

  constructor(
    statusServer: StatusServer,
    profileManager: ProfileManager,
    timer: ProfileTimer
  ) {
    this.statusServer = statusServer
    this.profileManager = profileManager
    this.timer = timer
  }

  startStdio(): void {
    let inputBuffer = ''

    process.stdin.setEncoding('utf-8')
    process.stdin.on('data', (chunk): void => {
      void (async (): Promise<void> => {
        inputBuffer += String(chunk)
        const lines = inputBuffer.split('\n')
        inputBuffer = lines.pop() ?? ''

        for (const line of lines) {
          if (line.trim() === '') continue

          try {
            const request = JSON.parse(line) as WorkerRequest
            const response = await this.handleMcpRequest(request)
            process.stdout.write(JSON.stringify(response) + '\n')
          } catch (error) {
            this.logger.error('MCP stdio error', { error })
          }
        }
      })()
    })

    this.logger.info('MCP stdio mode started')
  }

  async startHttp(port: number): Promise<void> {
    const app = express()
    app.use(express.json())

    app.post('/mcp', (req, res): void => {
      void (async (): Promise<void> => {
        try {
          const request = req.body as WorkerRequest
          const response = await this.handleMcpRequest(request)
          res.json(response)
        } catch (error) {
          this.logger.error('MCP HTTP error', { error })
          res.status(500).json({ error: 'Internal server error' })
        }
      })()
    })

    return new Promise((resolve) => {
      this.httpServer = app.listen(port, () => {
        this.logger.info('MCP HTTP server started', { port })
        resolve()
      })
    })
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.httpServer === null) {
        resolve()
        return
      }

      this.httpServer.close(() => {
        this.logger.info('MCP server stopped')
        this.httpServer = null
        resolve()
      })
    })
  }

  private async handleMcpRequest(request: WorkerRequest): Promise<WorkerResponse> {
    try {
      if (request.method === 'initialize') {
        return {
          jsonrpc: '2.0',
          id: request.id,
          result: {
            capabilities: {
              tools: true,
            },
            server_info: {
              name: 'AEGIS',
              version: '2.0.0',
            },
          },
        }
      }

      if (request.method === 'tools/list') {
        return {
          jsonrpc: '2.0',
          id: request.id,
          result: {
            tools: [
              {
                name: 'aegis_status',
                description: 'Get current AEGIS status',
                input_schema: {
                  type: 'object',
                  properties: {},
                },
              },
              {
                name: 'aegis_list_profiles',
                description: 'List available profiles',
                input_schema: {
                  type: 'object',
                  properties: {},
                },
              },
              {
                name: 'aegis_switch_profile',
                description: 'Switch to a profile',
                input_schema: {
                  type: 'object',
                  properties: {
                    profile_name: { type: 'string' },
                  },
                  required: ['profile_name'],
                },
              },
              {
                name: 'aegis_set_timer',
                description: 'Set a profile timer',
                input_schema: {
                  type: 'object',
                  properties: {
                    target_profile: { type: 'string' },
                    return_profile: { type: 'string' },
                    duration_min: { type: 'number' },
                  },
                  required: ['target_profile', 'return_profile', 'duration_min'],
                },
              },
              {
                name: 'aegis_cancel_timer',
                description: 'Cancel active timer',
                input_schema: {
                  type: 'object',
                  properties: {},
                },
              },
            ],
          },
        }
      }

      if (request.method === 'tools/call') {
        const params = request.params as Record<string, unknown> | undefined
        const toolName = params?.name

        if (toolName === 'aegis_status') {
          const snapshot = this.statusServer['snapshot']
          return {
            jsonrpc: '2.0',
            id: request.id,
            result: (snapshot as Record<string, unknown> | null) ?? {},
          }
        }

        if (toolName === 'aegis_list_profiles') {
          const profiles = this.profileManager['registry']
            ?.getAllProfiles()
            ?.map((p) => ({
              name: p.name,
              display_name: p.display_name,
              color: p.color,
            })) ?? []
          return {
            jsonrpc: '2.0',
            id: request.id,
            result: { profiles },
          }
        }

        if (toolName === 'aegis_switch_profile') {
          const profileName = params?.profile_name
          if (typeof profileName === 'string') {
            await this.profileManager.switchProfile(profileName)
            return {
              jsonrpc: '2.0',
              id: request.id,
              result: { success: true },
            }
          }
        }

        if (toolName === 'aegis_set_timer') {
          const targetProfile = params?.target_profile
          const returnProfile = params?.return_profile
          const durationMin = params?.duration_min
          if (
            typeof targetProfile === 'string' &&
            typeof returnProfile === 'string' &&
            typeof durationMin === 'number'
          ) {
            this.timer.start(targetProfile, returnProfile, durationMin)
            return {
              jsonrpc: '2.0',
              id: request.id,
              result: { success: true },
            }
          }
        }

        if (toolName === 'aegis_cancel_timer') {
          this.timer.cancel()
          return {
            jsonrpc: '2.0',
            id: request.id,
            result: { success: true },
          }
        }
      }

      return {
        jsonrpc: '2.0',
        id: request.id,
        error: { code: -32601, message: 'Method not found' },
      }
    } catch (error) {
      this.logger.error('MCP request error', { method: request.method, error })
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: { code: -32603, message: 'Internal error' },
      }
    }
  }
}
