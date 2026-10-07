import { Op } from 'sequelize'
import { RecapQueueItem } from './model/index.js'

export const MAX_RECAP_QUEUE_PER_PROJECT = 500

export interface RecapQueueEntry {
  issueId: string
  issueTitle: string
  issueUrl: string
  culprit: string | null
  level: string | null
  shortId: string | null
  eventCount: number | null
  matchedPattern: string
  firstQueuedAt: Date
  lastQueuedAt: Date
  occurrences: number
}

export interface QueueRecapIssue {
  orgSlug: string
  projectSlug: string
  issueId: string
  issueTitle: string
  issueUrl: string
  culprit: string | null
  level: string | null
  shortId: string | null
  eventCount: number | null
  matchedPattern: string
}

const toEntry = (row: RecapQueueItem): RecapQueueEntry => ({
  issueId: row.issueId,
  issueTitle: row.issueTitle,
  issueUrl: row.issueUrl,
  culprit: row.culprit,
  level: row.level,
  shortId: row.shortId,
  eventCount: row.eventCount,
  matchedPattern: row.matchedPattern,
  firstQueuedAt: row.firstQueuedAt,
  lastQueuedAt: row.lastQueuedAt,
  occurrences: row.occurrences,
})

export async function queueRecapIssue(item: QueueRecapIssue): Promise<boolean> {
  const now = new Date()
  const existing = await RecapQueueItem.findOne({
    where: { orgSlug: item.orgSlug, projectSlug: item.projectSlug, issueId: item.issueId },
  })

  if (existing) {
    await existing.update({
      issueTitle: item.issueTitle,
      issueUrl: item.issueUrl,
      culprit: item.culprit,
      level: item.level,
      shortId: item.shortId,
      eventCount: item.eventCount,
      matchedPattern: item.matchedPattern,
      lastQueuedAt: now,
      occurrences: existing.occurrences + 1,
    })
    return true
  }

  const queued = await countRecapQueue(item.orgSlug, item.projectSlug)
  if (queued >= MAX_RECAP_QUEUE_PER_PROJECT) return false

  await RecapQueueItem.create({ ...item, firstQueuedAt: now, lastQueuedAt: now, occurrences: 1 })
  return true
}

export async function listRecapQueue(
  orgSlug: string,
  projectSlug: string,
): Promise<RecapQueueEntry[]> {
  const rows = await RecapQueueItem.findAll({
    where: { orgSlug, projectSlug },
    order: [['lastQueuedAt', 'DESC']],
  })
  return rows.map(toEntry)
}

export async function countRecapQueue(orgSlug: string, projectSlug: string): Promise<number> {
  return RecapQueueItem.count({ where: { orgSlug, projectSlug } })
}

export async function countRecapQueueByProject(orgSlug: string): Promise<Map<string, number>> {
  const rows = await RecapQueueItem.findAll({
    where: { orgSlug },
    attributes: ['projectSlug'],
  })

  const counts = new Map<string, number>()
  for (const row of rows) {
    counts.set(row.projectSlug, (counts.get(row.projectSlug) ?? 0) + 1)
  }
  return counts
}

export async function clearRecapQueue(
  orgSlug: string,
  projectSlug: string,
  issueIds: string[],
): Promise<number> {
  if (issueIds.length === 0) return 0
  return RecapQueueItem.destroy({ where: { orgSlug, projectSlug, issueId: { [Op.in]: issueIds } } })
}

export async function pruneRecapQueue(before: Date): Promise<number> {
  return RecapQueueItem.destroy({ where: { lastQueuedAt: { [Op.lt]: before } } })
}
