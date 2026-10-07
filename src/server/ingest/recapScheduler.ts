import { config } from '../config.js'
import { recordDelivery } from '../db/deliveries.js'
import { getWebhookUrl } from '../db/destinations.js'
import { listOrgTimezones } from '../db/orgs.js'
import { clearRecapQueue, listRecapQueue } from '../db/recapQueue.js'
import { getRoute, listRecapRoutes, stampRecapRun, type Route } from '../db/routes.js'
import { recordAlert } from '../db/seenIssues.js'
import { logger } from '../logger.js'
import { sendToSlack } from '../slack/client.js'
import { formatRecap } from '../slack/format.js'
import { recapDueAt } from './recap.js'

const TICK_MS = 60_000

let timer: NodeJS.Timeout | null = null
let running = false

export interface RecapResult {
  issues: number
  sent: boolean
}

function timeZoneFor(timezones: Map<string, string | null>, orgSlug: string): string {
  return timezones.get(orgSlug) ?? config.TZ
}

async function runRecap(route: Route, timeZone: string, at: Date): Promise<RecapResult> {
  const queued = await listRecapQueue(route.orgSlug, route.projectSlug)

  if (queued.length === 0) {
    await stampRecapRun(route.orgSlug, route.projectSlug, at)
    return { issues: 0, sent: false }
  }

  const webhookUrl = await getWebhookUrl(route.destinationId)

  if (!webhookUrl) {
    await stampRecapRun(route.orgSlug, route.projectSlug, at)
    await recordDelivery({
      source: 'recap',
      orgSlug: route.orgSlug,
      projectSlug: route.projectSlug,
      destinationId: route.destinationId,
      outcome: 'failed',
      detail: 'destination no longer exists',
    })
    return { issues: queued.length, sent: false }
  }

  const message = formatRecap({
    projectLabel: route.projectSlug,
    issues: queued.map((entry) => ({
      issueTitle: entry.issueTitle,
      issueUrl: entry.issueUrl,
      level: entry.level,
      eventCount: entry.eventCount,
      occurrences: entry.occurrences,
    })),
    since: route.lastRecapAt,
    timeZone,
  })

  try {
    await sendToSlack(webhookUrl, message)
  } catch (err) {
    await stampRecapRun(route.orgSlug, route.projectSlug, at)
    logger.error(
      { err, orgSlug: route.orgSlug, projectSlug: route.projectSlug },
      'recap delivery failed',
    )
    await recordDelivery({
      source: 'recap',
      orgSlug: route.orgSlug,
      projectSlug: route.projectSlug,
      destinationId: route.destinationId,
      outcome: 'failed',
      detail: err instanceof Error ? err.message : 'slack delivery failed',
    })
    return { issues: queued.length, sent: false }
  }

  for (const entry of queued) {
    await recordAlert(route.orgSlug, route.projectSlug, entry.issueId)
  }

  await clearRecapQueue(
    route.orgSlug,
    route.projectSlug,
    queued.map((entry) => entry.issueId),
  )
  await stampRecapRun(route.orgSlug, route.projectSlug, at)

  await recordDelivery({
    source: 'recap',
    orgSlug: route.orgSlug,
    projectSlug: route.projectSlug,
    destinationId: route.destinationId,
    outcome: 'sent',
    detail: `${queued.length} ${queued.length === 1 ? 'issue' : 'issues'} in one recap`,
  })

  logger.info(
    { orgSlug: route.orgSlug, projectSlug: route.projectSlug, issues: queued.length },
    'recap sent',
  )
  return { issues: queued.length, sent: true }
}

export async function recapOnce(now: Date = new Date()): Promise<number> {
  const [routes, timezones] = await Promise.all([listRecapRoutes(), listOrgTimezones()])
  let sent = 0

  for (const route of routes) {
    const timeZone = timeZoneFor(timezones, route.orgSlug)
    const due = recapDueAt({
      times: route.recapTimes,
      timeZone,
      lastRecapAt: route.lastRecapAt,
      now,
    })

    if (!due) continue

    try {
      const result = await runRecap(route, timeZone, due)
      if (result.sent) sent++
    } catch (err) {
      logger.error(
        { err, orgSlug: route.orgSlug, projectSlug: route.projectSlug },
        'recap run threw',
      )
    }
  }

  return sent
}

async function tick(): Promise<void> {
  if (running) {
    logger.warn('previous recap tick still running, skipping this one')
    return
  }
  running = true
  try {
    await recapOnce()
  } catch (err) {
    logger.error({ err }, 'recap tick threw')
  } finally {
    running = false
  }
}

export function startRecapScheduler(): void {
  if (timer) return
  logger.info({ timeZone: config.TZ }, 'starting recap scheduler')
  timer = setInterval(() => void tick(), TICK_MS)
  timer.unref()
}

export function stopRecapScheduler(): void {
  if (!timer) return
  clearInterval(timer)
  timer = null
  logger.info('stopped recap scheduler')
}

export async function runRecapNow(orgSlug: string, projectSlug: string): Promise<RecapResult> {
  const [route, timezones] = await Promise.all([getRoute(orgSlug, projectSlug), listOrgTimezones()])

  if (!route) throw new Error('this project is not routed anywhere yet')

  return runRecap(route, timeZoneFor(timezones, orgSlug), new Date())
}
