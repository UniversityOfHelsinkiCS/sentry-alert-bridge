import { SeenIssue } from './models.js'

export interface ClaimState {
  /** When this app last alerted on the issue; null means never. */
  alertedAt: Date | null
  /** Set when the issue was resolved from Slack, cleared by the next alert. */
  releasedAt: Date | null
}

/**
 * What this app knows about every issue it has alerted on in a project. The
 * poller reads the whole project at once rather than a row per issue: there are
 * at most a couple of dozen issues in a tick, and one query is cheaper than
 * twenty-five.
 */
export async function listClaimStates(projectSlug: string): Promise<Map<string, ClaimState>> {
  const rows = await SeenIssue.findAll({
    where: { projectSlug },
    attributes: ['issueId', 'alertedAt', 'releasedAt'],
  })
  return new Map(
    rows.map((row) => [row.issueId, { alertedAt: row.alertedAt, releasedAt: row.releasedAt }]),
  )
}

/**
 * Records that an alert went out. Written only after a successful send, so a
 * failed one simply gets another go on the next tick — that is the whole retry
 * mechanism, and it needs no separate bookkeeping.
 *
 * Clearing releasedAt closes the resolve → regress cycle: the issue is claimed
 * again and the cooldown applies to it normally from here.
 */
export async function recordAlert(projectSlug: string, issueId: string): Promise<void> {
  const now = new Date()
  const [row, created] = await SeenIssue.findOrCreate({
    where: { projectSlug, issueId },
    defaults: { projectSlug, issueId, alertedAt: now, releasedAt: null },
  })
  if (created) return

  row.alertedAt = now
  row.releasedAt = null
  await row.save()
}

/**
 * Marks an issue resolved from Slack. The row stays so a regression can skip
 * the cooldown and alert straight away.
 */
export async function markIssueResolved(projectSlug: string, issueId: string): Promise<void> {
  await SeenIssue.update({ releasedAt: new Date() }, { where: { projectSlug, issueId } })
}
