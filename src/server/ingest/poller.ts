import { pruneDeliveries, recordDelivery } from '../db/deliveries.js'
import { listPollableOrgs } from '../db/orgs.js'
import { upsertProject } from '../db/projects.js'
import { listEnabledRoutes, type Route } from '../db/routes.js'
import { pruneRecapQueue, queueRecapIssue } from '../db/recapQueue.js'
import { listClaimStates, pruneSeenIssues } from '../db/seenIssues.js'
import { getSettings, touchLastPoll } from '../db/settings.js'
import { decideAlert } from './decide.js'
import { compilePatterns, matchRecap } from './recap.js'
import { logger } from '../logger.js'
import { topFrame } from '../sentry/frame.js'
import {
  getLatestEvent,
  listNewIssues,
  listOrgProjects,
  normalizeApiIssue,
  SentryApiError,
  type SentryOrg,
} from '../sentry/api.js'
import type { ApiIssue } from '../sentry/types.js'
import { handleIssue, type IngestResult } from './index.js'

const PER_PROJECT_DELAY_MS = 200

let timer: NodeJS.Timeout | null = null
let running = false

export interface PollSummary {
  orgs: number
  projects: number
  polled: number
  sent: number
  unrouted: number
  skipped: number
  recapped: number
  failed: number
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const DAY_MS = 86_400_000

async function prune(retentionDays: number): Promise<void> {
  const before = new Date(Date.now() - retentionDays * DAY_MS)
  try {
    const [deliveries, seenIssues, recapQueue] = await Promise.all([
      pruneDeliveries(before),
      pruneSeenIssues(before),
      pruneRecapQueue(before),
    ])
    if (deliveries > 0 || seenIssues > 0 || recapQueue > 0) {
      logger.info({ deliveries, seenIssues, recapQueue, before }, 'pruned history')
    }
  } catch (err) {
    logger.warn({ err }, 'prune failed')
  }
}

/**
 * Mirrors the org's projects into our own table and returns their display
 * names. A plain failure still lets the routed projects be polled from what we
 * already know; being rate limited does not, so it is reported separately.
 */
async function syncProjectNames(
  org: SentryOrg,
  summary: PollSummary,
): Promise<{ names: Map<string, string | null>; rateLimited: boolean }> {
  const names = new Map<string, string | null>()

  try {
    const projects = await listOrgProjects(org)
    summary.projects += projects.length
    for (const project of projects) {
      names.set(project.slug, project.name)
      await upsertProject(org.slug, project.slug, project.name)
    }
  } catch (err) {
    logger.error({ err, orgSlug: org.slug }, 'failed to list sentry projects')
    await recordDelivery({
      source: 'polling',
      orgSlug: org.slug,
      outcome: 'failed',
      detail: `could not list projects: ${err instanceof Error ? err.message : 'unknown error'}`,
    })
    return { names, rateLimited: err instanceof SentryApiError && err.isRateLimited }
  }

  return { names, rateLimited: false }
}

/** Best effort: no stack frame is a worse alert, never a missing one. */
async function frameFor(org: SentryOrg, issueId: string): Promise<string | null> {
  try {
    return topFrame(await getLatestEvent(org, issueId))
  } catch (err) {
    logger.debug(
      { err, orgSlug: org.slug, issueId },
      'could not read the latest event for a stack frame',
    )
    return null
  }
}

function countResult(summary: PollSummary, result: IngestResult): void {
  if (result === 'sent') summary.sent++
  else if (result === 'unrouted') summary.unrouted++
  else summary.failed++
}

interface AlertContext {
  org: SentryOrg
  route: Route
  projectName: string | null
  defaultCooldownMinutes: number
  summary: PollSummary
}

/** Sends an alert for each issue the cooldown and the route's start date allow. */
async function alertOnIssues(issues: ApiIssue[], ctx: AlertContext): Promise<void> {
  const { org, route, summary } = ctx
  const states = await listClaimStates(org.slug, route.projectSlug)
  const recapPatterns = compilePatterns(route.recapPatterns)

  for (const issue of issues) {
    const decision = decideAlert({
      lastSeen: issue.lastSeen,
      alertsFrom: route.alertsFrom,
      state: states.get(issue.id),
      cooldownMs: (route.cooldownMinutes ?? ctx.defaultCooldownMinutes) * 60_000,
    })

    if (decision !== 'alert') {
      summary.skipped++
      logger.debug(
        { orgSlug: org.slug, projectSlug: route.projectSlug, issueId: issue.id, decision },
        'issue not alertable',
      )
      continue
    }

    const matched = matchRecap(
      { title: issue.title, culprit: issue.culprit },
      recapPatterns,
    )

    if (matched !== null) {
      const queued = normalizeApiIssue(org, issue, route.projectSlug, ctx.projectName, null)
      const accepted = await queueRecapIssue({
        orgSlug: org.slug,
        projectSlug: route.projectSlug,
        issueId: queued.id,
        issueTitle: queued.title,
        issueUrl: queued.url ?? '',
        culprit: queued.culprit ?? null,
        level: queued.level ?? null,
        shortId: queued.shortId ?? null,
        eventCount: queued.count ?? null,
        matchedPattern: matched,
      })

      if (accepted) summary.recapped++
      else {
        summary.skipped++
        logger.warn(
          { orgSlug: org.slug, projectSlug: route.projectSlug, issueId: queued.id },
          'recap queue is full, dropping issue',
        )
      }
      continue
    }

    const normalized = normalizeApiIssue(
      org,
      issue,
      route.projectSlug,
      ctx.projectName,
      await frameFor(org, issue.id),
    )

    countResult(summary, await handleIssue(normalized, 'polling'))
  }
}

async function pollOrg(
  org: SentryOrg,
  defaultCooldownMinutes: number,
  summary: PollSummary,
): Promise<void> {
  const { names, rateLimited } = await syncProjectNames(org, summary)
  if (rateLimited) return

  for (const route of await listEnabledRoutes(org.slug)) {
    try {
      const issues = await listNewIssues(org, route.projectSlug)
      summary.polled++

      await alertOnIssues(issues, {
        org,
        route,
        projectName: names.get(route.projectSlug) ?? null,
        defaultCooldownMinutes,
        summary,
      })
    } catch (err) {
      summary.failed++
      logger.error({ err, orgSlug: org.slug, projectSlug: route.projectSlug }, 'poll failed for project')
      await recordDelivery({
        source: 'polling',
        orgSlug: org.slug,
        projectSlug: route.projectSlug,
        outcome: 'failed',
        detail: err instanceof Error ? err.message : 'unknown sentry api error',
      })
      if (err instanceof SentryApiError && err.isRateLimited) return
    }

    await delay(PER_PROJECT_DELAY_MS)
  }
}

export async function pollOnce(): Promise<PollSummary> {
  const summary: PollSummary = {
    orgs: 0,
    projects: 0,
    polled: 0,
    sent: 0,
    unrouted: 0,
    skipped: 0,
    recapped: 0,
    failed: 0,
  }

  const settings = await getSettings()
  const orgs = await listPollableOrgs()
  summary.orgs = orgs.length

  for (const org of orgs) {
    await pollOrg(org, settings.alertCooldownMinutes, summary)
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
