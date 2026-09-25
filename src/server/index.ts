import { config } from './config.js'
import { closeDatabase, connectToDatabase } from './db/connection.js'
import { startPoller, stopPoller } from './ingest/poller.js'
import { logger } from './logger.js'
import { createApp } from './server.js'

async function main(): Promise<void> {
  await connectToDatabase()

  startPoller()

  const server = createApp().listen(config.PORT, () => {
    logger.info(
      { port: config.PORT, env: config.NODE_ENV, release: config.RELEASE_VERSION ?? 'dev' },
      'sentry-alert-bridge listening',
    )
  })

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'shutting down')
    stopPoller()
    server.close(() => {
      void closeDatabase().then(() => process.exit(0))
    })
    // Do not hang forever on a stuck connection.
    setTimeout(() => process.exit(1), 10_000).unref()
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

main().catch((err) => {
  logger.fatal({ err }, 'failed to start')
  process.exit(1)
})
