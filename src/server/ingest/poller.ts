import { pruneDeliveries, recordDelivery } from '../db/deliveries.js'
import { upsertProject } from '../db/projects.js'
import { listEnabledRoutes } from '../db/routes.js'
import { listClaimStates, pruneSeenIssues } from '../db/seenIssues.js'
import { getSettings, touchLastPoll } from '../db/settings.js'
import { decideAlert } from './decide.js'
import { logger } from '../logger.js'
import {
  listNewIssues,
  listOrgProjects,
  normalizeApiIssue,
  SentryApiError,
} from '../sentry/api.js'
import { handleIssue } from './index.js'

const PER_PROJECT_DELAY_MS = 200

let timer: NodeJS.Timeout | null = null
let running = false

export interface PollSummary {
  projects: number
  polled: number
  sent: number
  unrouted: number
  skipped: number
  failed: number
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const DAY_MS = 86_400_000

async function prune(retentionDays: number): Promise<void> {
  const before = new Date(Date.now() - retentionDays * DAY_MS)
  try {
    const [deliveries, seenIssues] = await Promise.all([
      pruneDeliveries(before),
      pruneSeenIssues(before),
    ])
    if (deliveries > 0 || seenIssues > 0) {
      logger.info({ deliveries, seenIssues, before }, 'pruned history')
    }
  } catch (err) {
    logger.warn({ err }, 'prune failed')
  }
}

export async function pollOnce(): Promise<PollSummary> {
  const summary: PollSummary = {
    projects: 0,
    polled: 0,
    sent: 0,
    unrouted: 0,
    skipped: 0,
    failed: 0,
  }

  const settings = await getSettings()
  const names = new Map<string, string | null>()
  try {
    const projects = await listOrgProjects()
    summary.projects = projects.length
    for (const project of projects) {
      names.set(project.slug, project.name)
      await upsertProject(project.slug, project.name)
    }
  } catch (err) {
    logger.error({ err }, 'failed to list sentry projects')
    await recordDelivery({
      source: 'polling',
      outcome: 'failed',
      detail: `could not list projects: ${err instanceof Error ? err.message : 'unknown error'}`,
    })
    if (err instanceof SentryApiError && err.isRateLimited) {
      await touchLastPoll()
      return summary
    }
  }

  for (const route of await listEnabledRoutes()) {
    try {
      const issues = await listNewIssues(route.projectSlug)
      summary.polled++

      const states = await listClaimStates(route.projectSlug)

      for (const issue of issues) {
        const decision = decideAlert({
          lastSeen: issue.lastSeen,
          alertsFrom: route.alertsFrom,
          state: states.get(issue.id),
          cooldownMs:
            (route.cooldownMinutes ?? settings.alertCooldownMinutes) * 60_000,
        })

        if (decision !== 'alert') {
          summary.skipped++
          logger.debug(
            { projectSlug: route.projectSlug, issueId: issue.id, decision },
            'issue not alertable',
          )
          continue
        }

        const result = await handleIssue(
          normalizeApiIssue(issue, route.projectSlug, names.get(route.projectSlug) ?? null),
          'polling',
        )
        if (result === 'sent') summary.sent++
        else if (result === 'unrouted') summary.unrouted++
        else summary.failed++
      }
    } catch (err) {
      summary.failed++
      logger.error({ err, projectSlug: route.projectSlug }, 'poll failed for project')
      await recordDelivery({
        source: 'polling',
        projectSlug: route.projectSlug,
        outcome: 'failed',
        detail: err instanceof Error ? err.message : 'unknown sentry api error',
      })
      if (err instanceof SentryApiError && err.isRateLimited) break
    }

    await delay(PER_PROJECT_DELAY_MS)
  }

  await touchLastPoll()
  await prune(settings.retentionDays)
  logger.info(summary, 'poll tick finished')
  return summary
}

async function tick(): Promise<void> {
  if (running) {
    logger.warn('previous poll tick still running, skipping this one')
    return
  }
  running = true
  try {
    await pollOnce()
  } catch (err) {
    logger.error({ err }, 'poll tick threw')
  } finally {
    running = false
  }
}

export function isPollerRunning(): boolean {
  return timer !== null
}

function schedule(intervalMs: number): void {
  timer = setInterval(() => void tick(), intervalMs)
  timer.unref()
}

export async function startPoller(): Promise<void> {
  if (timer) return
  const { pollIntervalMinutes } = await getSettings()
  logger.info({ intervalMinutes: pollIntervalMinutes }, 'starting sentry poller')
  schedule(pollIntervalMinutes * 60_000)
  void tick()
}

export function restartPoller(intervalMinutes: number): void {
  stopPoller()
  logger.info({ intervalMinutes }, 'restarting sentry poller')
  schedule(intervalMinutes * 60_000)
}

export function stopPoller(): void {
  if (!timer) return
  clearInterval(timer)
  timer = null
  logger.info('stopped sentry poller')
}

export async function pollNow(): Promise<PollSummary> {
  if (running) throw new Error('a poll is already running')
  running = true
  try {
    return await pollOnce()
  } finally {
    running = false
  }
}
