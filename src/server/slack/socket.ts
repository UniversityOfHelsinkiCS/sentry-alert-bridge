import { SocketModeClient } from '@slack/socket-mode'
import { config } from '../config.js'
import { logger } from '../logger.js'
import { parseInteraction } from './interactions.js'
import { handleResolveClick } from './resolve.js'

/**
 * Socket Mode rather than a request URL: clicks arrive over a connection the
 * app opens outwards, so nothing here has to be reachable from the internet and
 * there is no signature to verify — the connection itself is authenticated.
 *
 * Mirrors startPoller/stopPoller so index.ts treats both the same way.
 */
let client: SocketModeClient | null = null

interface InteractiveEvent {
  body?: unknown
  ack?: () => Promise<void>
}

export function startSlackSocket(): void {
  if (!config.SLACK_APP_TOKEN) {
    logger.info('SLACK_APP_TOKEN is not set; the Resolve button in Slack is disabled')
    return
  }
  if (client) return

  client = new SocketModeClient({ appToken: config.SLACK_APP_TOKEN, logger: undefined })

  client.on('interactive', ({ body, ack }: InteractiveEvent) => {
    // Slack drops the interaction if it is not acknowledged within three
    // seconds, so the acknowledgement never waits on Sentry or the database.
    void ack?.().catch((err: unknown) => logger.error({ err }, 'slack ack failed'))

    const click = parseInteraction(body)
    if (!click) return

    // Detached on purpose, but never unhandled: a rejection escaping here would
    // take the process down.
    void handleResolveClick(click).catch((err: unknown) => {
      logger.error({ err }, 'slack resolve handler failed')
    })
  })

  client.on('disconnected', (err: unknown) => {
    logger.warn({ err }, 'slack socket disconnected')
  })

  client
    .start()
    .then(() => logger.info('slack socket mode connected'))
    .catch((err: unknown) => {
      logger.error({ err }, 'failed to start slack socket mode')
      client = null
    })
}

export async function stopSlackSocket(): Promise<void> {
  if (!client) return
  const stopping = client
  client = null
  await stopping.disconnect().catch((err: unknown) => {
    logger.warn({ err }, 'slack socket did not shut down cleanly')
  })
}
