// logger/index.ts — CommonJS-compatible logger for AEGIS sidecar
// Writes JSON structured logs to stderr (Rust reads it) + optional file
import { createLogger, format, transports } from 'winston'
import type { Logger } from 'winston'
import * as fs from 'fs'
import * as path from 'path'

let loggerInstance: Logger | null = null

export function initLogger(level: string, logDir: string): void {
  if (loggerInstance !== null) return

  // Ensure log directory exists
  try { fs.mkdirSync(logDir, { recursive: true }) } catch (_) {}

  const transportList: any[] = [
    new transports.File({
      filename: path.join(logDir, 'sidecar.log'),
      level,
      maxsize: 5 * 1024 * 1024, // 5 MB
      maxFiles: 3,
      tailable: true,
      format: format.combine(format.timestamp(), format.json()),
    }),
  ]

  loggerInstance = createLogger({
    level,
    format: format.combine(
      format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      format.errors({ stack: true }),
      format.splat(),
      format.json()
    ),
    defaultMeta: { service: 'aegis' },
    transports: transportList,
  })
}

export function getLogger(): Logger {
  if (loggerInstance === null) {
    loggerInstance = createLogger({
      level: 'info',
      format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.errors({ stack: true }),
        format.splat(),
        format.json()
      ),
      defaultMeta: { service: 'aegis' },
      transports: [
        new transports.Console({
          format: format.combine(
            format.colorize(),
            format.printf(({ timestamp, level: lvl, message, ...rest }) => {
              const meta = Object.keys(rest).length > 0 ? JSON.stringify(rest) : ''
              return `${String(timestamp)} [${String(lvl)}] ${String(message)} ${meta}`.trim()
            })
          ),
        }),
      ],
    })
  }
  return loggerInstance
}

export { Logger }
