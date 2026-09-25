import { logger } from '../logger.js'
import type { SlackMessage } from './format.js'

const TIMEOUT_MS = 5_000
const BACKOFF_MS = [250, 1_000]

export class SlackSendError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message)
    this.name = 'SlackSendError'
  }

  /** A hook that Slack no longer recognises — deleting or recreating it is the fix. */
  get isRevoked(): boolean {
    return this.status === 404 || this.status === 410
  }
}

function retryable(status: number): boolean {
  return status === 429 || status >= 500
}

export async function sendToSlack(webhookUrl: string, message: SlackMessage): Promise<void> {
  let lastError: SlackSendError | null = null

  for (let attempt = 0; attempt <= BACKOFF_MS.length; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, BACKOFF_MS[attempt - 1]))
    }

    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(message),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })

      if (res.ok) return

      const body = await res.text().catch(() => '')
      const error = new SlackSendError(
        `Slack responded ${res.status}${body ? `: ${body.slice(0, 200)}` : ''}`,
        res.status,
      )

      if (!retryable(res.status)) throw error
      lastError = error
      logger.warn({ status: res.status, attempt }, 'slack send failed, retrying')
    } catch (err) {
      if (err instanceof SlackSendError) throw err
      lastError = new SlackSendError(
        err instanceof Error ? err.message : 'slack request failed',
        null,
      )
      logger.warn({ err, attempt }, 'slack request errored, retrying')
    }
  }

  throw lastError ?? new SlackSendError('slack send failed', null)
}
