import { recordDelivery } from '../db/deliveries.js'
import { markIssueResolved } from '../db/seenIssues.js'
import { logger } from '../logger.js'
import { SentryApiError, resolveIssue } from '../sentry/api.js'
import { markResolved } from './format.js'
import type { ResolveClick } from './interactions.js'
import { postToResponseUrl } from './respond.js'

function reasonFor(err: unknown): string {
  if (err instanceof SentryApiError) {
    if (err.isRateLimited) return 'Sentry is rate limiting the bridge; try again in a minute.'
    if (err.status === 403) return "the bridge's Sentry token is missing the event:write scope."
    if (err.status === 404) return 'Sentry does not know that issue any more.'
    return err.message
  }
  return err instanceof Error ? err.message : 'unknown error'
}

/**
 * Sentry first, then the database. The other order would drop the dedup row and
 * then fail to resolve, and the next poll would re-alert an issue that is still
 * open — a duplicate for no reason.
 */
export async function handleResolveClick(click: ResolveClick): Promise<void> {
  const { projectSlug, issueId, userId, responseUrl, blocks } = click

  try {
    await resolveIssue(issueId)
  } catch (err) {
    logger.error({ err, projectSlug, issueId }, 'sentry resolve failed')

    // The message keeps its button, so retrying is one click. Replacing it here
    // would take that away and leave no way back.
    await postToResponseUrl(responseUrl, {
      response_type: 'ephemeral',
      replace_original: false,
      text: `⚠️ Could not resolve in Sentry: ${reasonFor(err)}`,
    })

    await recordDelivery({
      source: 'resolve',
      projectSlug,
      outcome: 'failed',
      detail: `resolve of issue ${issueId} failed: ${reasonFor(err)}`,
    })
    return
  }

  // Letting go of the claim is the whole point: it is what allows a later
  // regression of this issue to alert again instead of being deduplicated.
  await markIssueResolved(projectSlug, issueId)

  await postToResponseUrl(responseUrl, {
    text: 'Issue resolved in Sentry',
    blocks: markResolved(blocks, userId),
    replace_original: true,
  })

  await recordDelivery({
    source: 'resolve',
    projectSlug,
    outcome: 'sent',
    detail: `issue ${issueId} resolved from Slack by ${userId}`,
  })

  logger.info({ projectSlug, issueId, userId }, 'issue resolved from slack')
}
