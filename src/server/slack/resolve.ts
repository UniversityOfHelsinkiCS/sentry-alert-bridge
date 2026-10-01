import { recordDelivery } from '../db/deliveries.js'
import { getOrg, listPollableOrgs } from '../db/orgs.js'
import { markIssueResolved } from '../db/seenIssues.js'
import { logger } from '../logger.js'
import { SentryApiError, resolveIssue, type SentryOrg } from '../sentry/api.js'
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

async function orgForClick(click: ResolveClick): Promise<SentryOrg | null> {
  if (click.orgSlug !== null) return getOrg(click.orgSlug)
  const orgs = await listPollableOrgs()
  return orgs.length === 1 ? (orgs[0] ?? null) : null
}

export async function handleResolveClick(click: ResolveClick): Promise<void> {
  const { projectSlug, issueId, userId, responseUrl, blocks } = click

  const org = await orgForClick(click)
  if (!org) {
    await postToResponseUrl(responseUrl, {
      response_type: 'ephemeral',
      replace_original: false,
      text:
        click.orgSlug === null
          ? '⚠️ This alert predates multi-org support, so the bridge cannot tell which Sentry organisation it came from. Resolve it in Sentry directly.'
          : `⚠️ Sentry organisation ${click.orgSlug} is no longer configured in the bridge.`,
    })
    return
  }

  try {
    await resolveIssue(org, issueId)
  } catch (err) {
    logger.error({ err, orgSlug: org.slug, projectSlug, issueId }, 'sentry resolve failed')

    await postToResponseUrl(responseUrl, {
      response_type: 'ephemeral',
      replace_original: false,
      text: `⚠️ Could not resolve in Sentry: ${reasonFor(err)}`,
    })

    await recordDelivery({
      source: 'resolve',
      orgSlug: org.slug,
      projectSlug,
      outcome: 'failed',
      detail: `resolve of issue ${issueId} failed: ${reasonFor(err)}`,
    })
    return
  }

  await markIssueResolved(org.slug, projectSlug, issueId)

  await postToResponseUrl(responseUrl, {
    text: 'Issue resolved in Sentry',
    blocks: markResolved(blocks, userId),
    replace_original: true,
  })

  await recordDelivery({
    source: 'resolve',
    orgSlug: org.slug,
    projectSlug,
    outcome: 'sent',
    detail: `issue ${issueId} resolved from Slack by ${userId}`,
  })

  logger.info({ orgSlug: org.slug, projectSlug, issueId, userId }, 'issue resolved from slack')
}
