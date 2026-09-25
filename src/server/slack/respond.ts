import { logger } from '../logger.js'

const TIMEOUT_MS = 5_000

/**
 * A response_url is not a webhook: it is a short-lived, single-message callback
 * Slack hands us with the click, so it gets its own small sender rather than
 * sharing sendToSlack's retry ladder. One retry is enough — the click is gone
 * either way, and the worst case is a message that keeps its stale button.
 */
export interface ResponseMessage {
  text: string
  blocks?: unknown[]
  replace_original?: boolean
  response_type?: 'ephemeral' | 'in_channel'
}

export async function postToResponseUrl(url: string, message: ResponseMessage): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(message),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })

      if (res.ok) return

      const body = await res.text().catch(() => '')
      logger.warn({ status: res.status, body: body.slice(0, 200), attempt }, 'response_url failed')
    } catch (err) {
      logger.warn({ err, attempt }, 'response_url request errored')
    }
  }

  logger.error('gave up updating the slack message via response_url')
}
