import { Op } from 'sequelize'
import { SeenIssue } from './model/index.js'

export interface ClaimState {
  alertedAt: Date | null
  releasedAt: Date | null
  alertStreak: number
}

export async function listClaimStates(
  orgSlug: string,
  projectSlug: string,
): Promise<Map<string, ClaimState>> {
  const rows = await SeenIssue.findAll({
    where: { orgSlug, projectSlug },
    attributes: ['issueId', 'alertedAt', 'releasedAt', 'alertStreak'],
  })
  const entries = rows.map((row): [string, ClaimState] => [
    row.issueId,
    { alertedAt: row.alertedAt, releasedAt: row.releasedAt, alertStreak: row.alertStreak },
  ])
  return new Map(entries)
}

export async function recordAlert(
  orgSlug: string,
  projectSlug: string,
  issueId: string,
): Promise<void> {
  const now = new Date()
  const [row, created] = await SeenIssue.findOrCreate({
    where: { orgSlug, projectSlug, issueId },
    defaults: { orgSlug, projectSlug, issueId, alertedAt: now, releasedAt: null, alertStreak: 1 },
  })
  if (created) return

  row.alertedAt = now
  row.releasedAt = null
  row.alertStreak += 1
  await row.save()
}

export async function resetAlertStreak(
  orgSlug: string,
  projectSlug: string,
  issueId: string,
): Promise<void> {
  await SeenIssue.update({ alertStreak: 0 }, { where: { orgSlug, projectSlug, issueId } })
}

export async function markIssueResolved(
  orgSlug: string,
  projectSlug: string,
  issueId: string,
): Promise<void> {
  await SeenIssue.update(
    { releasedAt: new Date(), alertStreak: 0 },
    { where: { orgSlug, projectSlug, issueId } },
  )
}

export async function pruneSeenIssues(before: Date): Promise<number> {
  return SeenIssue.destroy({ where: { alertedAt: { [Op.lt]: before } } })
}
