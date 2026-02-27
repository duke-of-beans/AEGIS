import { createLogger, format, transports } from 'winston'
import type { Logger } from 'winston'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const DailyRotateFile = require('winston-daily-rotate-file') as new (opts: Record<string, unknown>) => InstanceType<typeof transports.File>

let loggerInstance: Logger | null = null

export function initLogger(level: string, logDir: string): void {
  if (loggerInstance !== null) {
    return
  }

  loggerInstance = createLogger({
    level,
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
      new DailyRotateFile({
        filename: `${logDir}/aegis-%DATE%.log`,
        datePattern: 'YYYY-MM-DD',
        maxFiles: '30d',
        level,
        format: format.combine(format.timestamp(), format.json()),
      }),
    ],
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
