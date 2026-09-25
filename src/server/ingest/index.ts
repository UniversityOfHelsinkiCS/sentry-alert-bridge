import type { IngestSource, NormalizedIssue } from '../../shared/types.js'
import { recordDelivery } from '../db/deliveries.js'
import { getWebhookUrl } from '../db/destinations.js'
import { upsertProject } from '../db/projects.js'
import { getRoute } from '../db/routes.js'
import { claimIssue, releaseIssue } from '../db/seenIssues.js'
import { logger } from '../logger.js'
import { sendToSlack } from '../slack/client.js'
import { formatIssue } from '../slack/format.js'

export type IngestResult = 'sent' | 'unrouted' | 'duplicate' | 'failed'

/** The single path every polled issue takes: route, dedup, format, send, log. */
export async function handleIssue(
  issue: NormalizedIssue,
  source: IngestSource,
): Promise<IngestResult> {
  await upsertProject(issue.projectSlug, issue.projectName)

  if (!(await claimIssue(issue.projectSlug, issue.id))) {
    logger.debug({ issueId: issue.id, source }, 'issue already seen, skipping')
    return 'duplicate'
  }

  const route = await getRoute(issue.projectSlug)
  if (!route || !route.enabled) {
    await recordDelivery({
      source,
      projectSlug: issue.projectSlug,
      issueTitle: issue.title,
      issueUrl: issue.url,
      outcome: 'unrouted',
      detail: route ? 'route is disabled' : 'no destination set for this project',
    })
    return 'unrouted'
  }

  const webhookUrl = await getWebhookUrl(route.destinationId)
  if (!webhookUrl) {
    await recordDelivery({
      source,
      projectSlug: issue.projectSlug,
      issueTitle: issue.title,
      issueUrl: issue.url,
      destinationId: route.destinationId,
      outcome: 'failed',
      detail: 'destination no longer exists',
    })
    return 'failed'
  }

  try {
    await sendToSlack(webhookUrl, formatIssue(issue, { resolvable: true }))
    await recordDelivery({
      source,
      projectSlug: issue.projectSlug,
      issueTitle: issue.title,
      issueUrl: issue.url,
      destinationId: route.destinationId,
      outcome: 'sent',
    })
    return 'sent'
  } catch (err) {
    // Give up the claim so a transient Slack failure gets another chance on the
    // next poll instead of being silently dropped.
    await releaseIssue(issue.projectSlug, issue.id)

    const detail = err instanceof Error ? err.message : 'unknown slack error'
    logger.error({ err, projectSlug: issue.projectSlug }, 'slack delivery failed')
    await recordDelivery({
      source,
      projectSlug: issue.projectSlug,
      issueTitle: issue.title,
      issueUrl: issue.url,
      destinationId: route.destinationId,
      outcome: 'failed',
      detail,
    })
    return 'failed'
  }
}
