import { config } from '../config.js'
import { recordDelivery } from '../db/deliveries.js'
import { upsertProject } from '../db/projects.js'
import { listEnabledRoutes } from '../db/routes.js'
import { touchLastPoll } from '../db/settings.js'
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
  duplicates: number
  failed: number
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * One poll tick. Issues first seen within two intervals are candidates — the
 * overlap means a slow or skipped tick loses nothing, and seen_issues absorbs
 * the repeats. It is also what stops a backlog flood on first enable.
 */
export async function pollOnce(): Promise<PollSummary> {
  const summary: PollSummary = {
    projects: 0,
    polled: 0,
    sent: 0,
    unrouted: 0,
    duplicates: 0,
    failed: 0,
  }

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

  const cutoff = Date.now() - 2 * config.pollIntervalMs

  // Only projects someone has actually routed are worth an API call.
  for (const route of await listEnabledRoutes()) {
    try {
      const issues = await listNewIssues(route.projectSlug)
      summary.polled++

      for (const issue of issues) {
        const firstSeen = issue.firstSeen ? Date.parse(issue.firstSeen) : Number.NaN
        if (Number.isNaN(firstSeen) || firstSeen < cutoff) continue

        const result = await handleIssue(
          normalizeApiIssue(issue, route.projectSlug, names.get(route.projectSlug) ?? null),
          'polling',
        )
        if (result === 'sent') summary.sent++
        else if (result === 'unrouted') summary.unrouted++
        else if (result === 'duplicate') summary.duplicates++
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
      // A rate limit applies to the whole instance; back off until next tick.
      if (err instanceof SentryApiError && err.isRateLimited) break
    }

    await delay(PER_PROJECT_DELAY_MS)
  }

  await touchLastPoll()
  logger.info(summary, 'poll tick finished')
  return summary
}

/** Ticks never overlap: a slow tick simply means the next one is skipped. */
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

export function startPoller(): void {
  if (timer) return
  logger.info({ intervalMinutes: config.POLL_INTERVAL_MINUTES }, 'starting sentry poller')
  timer = setInterval(() => void tick(), config.pollIntervalMs)
  timer.unref()
  void tick()
}

export function stopPoller(): void {
  if (!timer) return
  clearInterval(timer)
  timer = null
  logger.info('stopped sentry poller')
}

/** Runs a tick on demand, for the "Poll now" button. */
export async function pollNow(): Promise<PollSummary> {
  if (running) throw new Error('a poll is already running')
  running = true
  try {
    return await pollOnce()
  } finally {
    running = false
  }
}
