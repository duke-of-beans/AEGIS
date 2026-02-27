import { startup, shutdown } from './tray/lifecycle.js'

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err)
  process.exit(1)
})

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason)
  process.exit(1)
})

process.on('SIGTERM', (): void => {
  void (async (): Promise<void> => {
    await shutdown()
    process.exit(0)
  })()
})

process.on('SIGINT', (): void => {
  void (async (): Promise<void> => {
    await shutdown()
    process.exit(0)
  })()
})

startup().catch((error) => {
  console.error('Fatal startup error:', error)
  process.exit(1)
})
