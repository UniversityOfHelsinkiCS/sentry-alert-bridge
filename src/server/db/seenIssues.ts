import { Op } from 'sequelize'
import { SeenIssue } from './model/index.js'

export interface ClaimState {
  alertedAt: Date | null
  releasedAt: Date | null
}

export async function listClaimStates(projectSlug: string): Promise<Map<string, ClaimState>> {
  const rows = await SeenIssue.findAll({
    where: { projectSlug },
    attributes: ['issueId', 'alertedAt', 'releasedAt'],
  })
  return new Map(
    rows.map((row) => [row.issueId, { alertedAt: row.alertedAt, releasedAt: row.releasedAt }]),
  )
}

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

export async function markIssueResolved(projectSlug: string, issueId: string): Promise<void> {
  await SeenIssue.update({ releasedAt: new Date() }, { where: { projectSlug, issueId } })
}

export async function pruneSeenIssues(before: Date): Promise<number> {
  return SeenIssue.destroy({ where: { alertedAt: { [Op.lt]: before } } })
}
