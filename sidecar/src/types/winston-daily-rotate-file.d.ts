declare module 'winston-daily-rotate-file' {
  import { transport } from 'winston'
  interface DailyRotateFileTransportOptions {
    filename?: string
    datePattern?: string
    maxFiles?: string | number
    level?: string
    format?: unknown
  }
  class DailyRotateFile extends transport {
    constructor(options?: DailyRotateFileTransportOptions)
  }
  export = DailyRotateFile
}
