import type { IngestSource, NormalizedIssue } from '../../shared/types.js'
import { recordDelivery } from '../db/deliveries.js'
import { getWebhookUrl } from '../db/destinations.js'
import { upsertProject } from '../db/projects.js'
import { getRoute } from '../db/routes.js'
import { recordAlert } from '../db/seenIssues.js'
import { logger } from '../logger.js'
import { sendToSlack } from '../slack/client.js'
import { formatIssue } from '../slack/format.js'

export type IngestResult = 'sent' | 'unrouted' | 'failed'

/**
 * The single path every alertable issue takes: route, format, send, log.
 *
 * Whether an issue deserves an alert at all is decided before this, in
 * decide.ts — the caller only brings issues that passed.
 */
export async function handleIssue(
  issue: NormalizedIssue,
  source: IngestSource,
): Promise<IngestResult> {
  await upsertProject(issue.projectSlug, issue.projectName)

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

    // Only now, so a failed send is simply tried again on the next tick.
    await recordAlert(issue.projectSlug, issue.id)

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
    // Nothing to undo: the alert was never recorded, so the next tick will
    // find the issue unalerted and try again.
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
