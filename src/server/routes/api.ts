import { Router } from 'express'
import { z } from 'zod'
import type { ProjectIssuesDto, SettingsDto } from '../../shared/types.js'
import { requireAuth } from '../auth/middleware.js'
import { config } from '../config.js'
import { countRoutesUsing, listDeliveries, recordDelivery } from '../db/deliveries.js'
import {
  createDestination,
  deleteDestination,
  getDestinationLabel,
  getWebhookUrl,
  listDestinations,
} from '../db/destinations.js'
import { listProjects, upsertProject } from '../db/projects.js'
import { deleteRoute, getRoute, upsertRoute } from '../db/routes.js'
import { listClaimStates } from '../db/seenIssues.js'
import { getSettings } from '../db/settings.js'
import { decideAlert } from '../ingest/decide.js'
import { pollNow } from '../ingest/poller.js'
import { listNewIssues, normalizeApiIssue } from '../sentry/api.js'
import { sendToSlack } from '../slack/client.js'
import { formatIssue, testIssue } from '../slack/format.js'

export const apiRouter: Router = Router()

apiRouter.use(requireAuth)

const slugSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9][a-z0-9._-]*$/i, 'not a valid project slug')

apiRouter.get('/projects', async (_req, res) => {
  res.json(await listProjects())
})

/**
 * What the poller would do with this project right now, issue by issue. It
 * calls Sentry with the same query the poller uses and applies the same window,
 * so "why did nothing alert?" has an answer that does not involve reading logs.
 */
apiRouter.get('/projects/:slug/issues', async (req, res) => {
  const parsed = slugSchema.safeParse(req.params.slug)
  if (!parsed.success) {
    res.status(400).json({ error: 'not a valid project slug' })
    return
  }
  const projectSlug = parsed.data

  const route = await getRoute(projectSlug)
  if (!route) {
    res.status(404).json({ error: 'project is not routed, so it is never polled' })
    return
  }

  const [issues, states] = await Promise.all([
    listNewIssues(projectSlug),
    listClaimStates(projectSlug),
  ])

  const body: ProjectIssuesDto = {
    projectSlug,
    alertsFrom: route.alertsFrom.toISOString(),
    cooldownMinutes: config.ALERT_COOLDOWN_MINUTES,
    issues: issues.map((issue) => {
      const normalized = normalizeApiIssue(issue, projectSlug, null)
      const state = states.get(issue.id)

      return {
        id: issue.id,
        title: normalized.title,
        shortId: normalized.shortId ?? null,
        level: normalized.level ?? null,
        url: normalized.url ?? null,
        firstSeen: issue.firstSeen ?? null,
        lastSeen: issue.lastSeen ?? null,
        alertedAt: state?.alertedAt?.toISOString() ?? null,
        // The poller's own rule, not a second copy of it.
        verdict: decideAlert({
          lastSeen: issue.lastSeen,
          alertsFrom: route.alertsFrom,
          state,
        }),
      }
    }),
  }

  res.json(body)
})

apiRouter.post('/projects', async (req, res) => {
  const parsed = z.object({ slug: slugSchema, name: z.string().max(200).optional() }).safeParse(
    req.body,
  )
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'invalid project' })
    return
  }
  await upsertProject(parsed.data.slug, parsed.data.name ?? null)
  res.status(201).json(await listProjects())
})

apiRouter.put('/routes/:slug', async (req, res) => {
  const slug = slugSchema.safeParse(req.params.slug)
  const body = z
    .object({ destinationId: z.number().int().positive(), enabled: z.boolean().default(true) })
    .safeParse(req.body)

  if (!slug.success || !body.success) {
    res.status(400).json({ error: 'invalid route' })
    return
  }

  // The project row must exist first: routes.project_slug references it.
  await upsertProject(slug.data)
  await upsertRoute(slug.data, body.data.destinationId, body.data.enabled)
  res.json(await listProjects())
})

apiRouter.delete('/routes/:slug', async (req, res) => {
  const slug = slugSchema.safeParse(req.params.slug)
  if (!slug.success) {
    res.status(400).json({ error: 'invalid project slug' })
    return
  }
  await deleteRoute(slug.data)
  res.json(await listProjects())
})

apiRouter.get('/destinations', async (_req, res) => {
  res.json(await listDestinations())
})

apiRouter.post('/destinations', async (req, res) => {
  const parsed = z
    .object({
      label: z.string().min(1).max(100),
      webhookUrl: z
        .string()
        .url()
        .startsWith('https://hooks.slack.com/', 'must be a Slack incoming webhook URL'),
    })
    .safeParse(req.body)

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'invalid destination' })
    return
  }

  res.status(201).json(await createDestination(parsed.data.label, parsed.data.webhookUrl))
})

apiRouter.delete('/destinations/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: 'invalid destination id' })
    return
  }

  const inUse = await countRoutesUsing(id)
  if (inUse > 0) {
    res.status(409).json({
      error:
        inUse === 1
          ? '1 project still routes here; reroute it first'
          : `${inUse} projects still route here; reroute them first`,
    })
    return
  }

  await deleteDestination(id)
  res.json({ ok: true })
})

apiRouter.post('/destinations/:id/test', async (req, res) => {
  const id = Number(req.params.id)
  const webhookUrl = Number.isInteger(id) ? await getWebhookUrl(id) : null
  if (!webhookUrl) {
    res.status(404).json({ error: 'destination not found' })
    return
  }

  const issue = testIssue()
  try {
    // No Resolve button: the test issue is synthetic and Sentry has never heard
    // of it, so the button could only ever fail.
    await sendToSlack(webhookUrl, formatIssue(issue))
    await recordDelivery({
      source: 'test',
      projectSlug: issue.projectSlug,
      issueTitle: issue.title,
      destinationId: id,
      outcome: 'sent',
      detail: `test send to ${await getDestinationLabel(id)}`,
    })
    res.json({ ok: true })
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown slack error'
    await recordDelivery({
      source: 'test',
      projectSlug: issue.projectSlug,
      issueTitle: issue.title,
      destinationId: id,
      outcome: 'failed',
      detail,
    })
    res.status(502).json({ error: detail })
  }
})

apiRouter.get('/deliveries', async (req, res) => {
  const limit = z.coerce.number().int().min(1).max(500).catch(100).parse(req.query.limit)
  res.json(await listDeliveries(limit))
})

apiRouter.get('/settings', async (_req, res) => {
  const settings = await getSettings()
  const dto: SettingsDto = {
    pollIntervalMinutes: config.POLL_INTERVAL_MINUTES,
    lastPollAt: settings.lastPollAt?.toISOString() ?? null,
  }
  res.json(dto)
})

apiRouter.post('/poll', async (_req, res) => {
  try {
    res.json(await pollNow())
  } catch (err) {
    res.status(409).json({ error: err instanceof Error ? err.message : 'poll failed' })
  }
})
