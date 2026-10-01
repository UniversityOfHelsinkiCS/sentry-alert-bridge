import { Router, type Request, type Response } from 'express'
import { z } from 'zod'
import type { ProjectIssuesDto, SettingsDto } from '../../shared/types.js'
import { requireAuth } from '../auth/middleware.js'
import { countRoutesUsing, listDeliveries, recordDelivery } from '../db/deliveries.js'
import {
  createDestination,
  deleteDestination,
  getDestinationLabel,
  getDestinationOrg,
  getWebhookUrl,
  listDestinations,
  updateDestination,
} from '../db/destinations.js'
import {
  countOrgUsage,
  createOrg,
  deleteOrg,
  getOrg,
  listOrgs,
  orgExists,
  updateOrg,
} from '../db/orgs.js'
import { listProjects, upsertProject } from '../db/projects.js'
import { deleteRoute, getRoute, upsertRoute } from '../db/routes.js'
import { listClaimStates } from '../db/seenIssues.js'
import { getSettings, type Settings, updateSettings } from '../db/settings.js'
import { decideAlert } from '../ingest/decide.js'
import { pollNow, restartPoller } from '../ingest/poller.js'
import {
  listNewIssues,
  listOrgProjects,
  normalizeApiIssue,
  type SentryOrg,
} from '../sentry/api.js'
import { sendToSlack } from '../slack/client.js'
import { formatIssue, testIssue } from '../slack/format.js'

export const apiRouter: Router = Router()

apiRouter.use(requireAuth)

const destinationSchema = z.object({
  label: z.string().min(1).max(100),
  webhookUrl: z
    .string()
    .url()
    .startsWith('https://hooks.slack.com/', 'must be a Slack incoming webhook URL'),
})

const slugSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9][a-z0-9._-]*$/i, 'not a valid project slug')

async function resolveOrg(slug: unknown, res: Response): Promise<SentryOrg | null> {
  const parsed = slugSchema.safeParse(slug)
  if (!parsed.success) {
    res.status(400).json({ error: 'a valid org slug is required' })
    return null
  }

  const org = await getOrg(parsed.data)
  if (!org) {
    res.status(404).json({ error: `no Sentry organisation ${parsed.data} is configured` })
    return null
  }
  return org
}

const requireOrg = (req: Request, res: Response): Promise<SentryOrg | null> =>
  resolveOrg(req.query.org, res)

const orgSchema = z.object({
  slug: slugSchema,
  name: z.string().max(200).nullable().default(null),
  authToken: z.string().min(1).optional(),
  baseUrl: z.string().url().nullable().default(null),
})

apiRouter.get('/orgs', async (_req, res) => {
  res.json(await listOrgs())
})

apiRouter.post('/orgs', async (req, res) => {
  const parsed = orgSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'invalid organisation' })
    return
  }
  if (!parsed.data.authToken) {
    res.status(400).json({ error: 'an auth token is required' })
    return
  }
  if (await orgExists(parsed.data.slug)) {
    res.status(409).json({ error: `organisation ${parsed.data.slug} already exists` })
    return
  }

  res.status(201).json(await createOrg(parsed.data))
})

apiRouter.patch('/orgs/:slug', async (req, res) => {
  const slug = slugSchema.safeParse(req.params.slug)
  const parsed = orgSchema.omit({ slug: true }).safeParse(req.body)
  if (!slug.success || !parsed.success) {
    res.status(400).json({ error: 'invalid organisation' })
    return
  }

  const updated = await updateOrg(slug.data, { slug: slug.data, ...parsed.data })
  if (!updated) {
    res.status(404).json({ error: 'organisation not found' })
    return
  }
  res.json(updated)
})

apiRouter.delete('/orgs/:slug', async (req, res) => {
  const slug = slugSchema.safeParse(req.params.slug)
  if (!slug.success) {
    res.status(400).json({ error: 'invalid organisation slug' })
    return
  }

  const usage = await countOrgUsage(slug.data)
  if (usage.routes > 0 || usage.destinations > 0) {
    const parts = []
    if (usage.routes > 0) parts.push(`${usage.routes} routed project(s)`)
    if (usage.destinations > 0) parts.push(`${usage.destinations} destination(s)`)
    res.status(409).json({ error: `${parts.join(' and ')} still belong here; remove them first` })
    return
  }

  await deleteOrg(slug.data)
  res.json({ ok: true })
})

apiRouter.post('/orgs/:slug/test', async (req, res) => {
  const org = await resolveOrg(req.params.slug, res)
  if (!org) return

  try {
    const projects = await listOrgProjects(org)
    res.json({ ok: true, projects: projects.length })
  } catch (err) {
    res.status(502).json({
      error: err instanceof Error ? err.message : 'could not reach Sentry',
    })
  }
})

apiRouter.get('/projects', async (req, res) => {
  const org = await requireOrg(req, res)
  if (!org) return
  res.json(await listProjects(org.slug))
})

apiRouter.get('/projects/:slug/issues', async (req, res) => {
  const org = await requireOrg(req, res)
  if (!org) return

  const parsed = slugSchema.safeParse(req.params.slug)
  if (!parsed.success) {
    res.status(400).json({ error: 'not a valid project slug' })
    return
  }
  const projectSlug = parsed.data

  const route = await getRoute(org.slug, projectSlug)
  if (!route) {
    res.status(404).json({ error: 'project is not routed, so it is never polled' })
    return
  }

  const [issues, states, settings] = await Promise.all([
    listNewIssues(org, projectSlug),
    listClaimStates(org.slug, projectSlug),
    getSettings(),
  ])

  const cooldownMinutes = route.cooldownMinutes ?? settings.alertCooldownMinutes
  const cooldownMs = cooldownMinutes * 60_000

  const body: ProjectIssuesDto = {
    orgSlug: org.slug,
    projectSlug,
    alertsFrom: route.alertsFrom.toISOString(),
    cooldownMinutes,
    issues: issues.map((issue) => {
      const normalized = normalizeApiIssue(org, issue, projectSlug, null)
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
        verdict: decideAlert({
          lastSeen: issue.lastSeen,
          alertsFrom: route.alertsFrom,
          state,
          cooldownMs,
        }),
      }
    }),
  }

  res.json(body)
})

apiRouter.post('/projects', async (req, res) => {
  const org = await requireOrg(req, res)
  if (!org) return

  const parsed = z.object({ slug: slugSchema, name: z.string().max(200).optional() }).safeParse(
    req.body,
  )
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'invalid project' })
    return
  }
  await upsertProject(org.slug, parsed.data.slug, parsed.data.name ?? null)
  res.status(201).json(await listProjects(org.slug))
})

apiRouter.put('/routes/:slug', async (req, res) => {
  const org = await requireOrg(req, res)
  if (!org) return

  const slug = slugSchema.safeParse(req.params.slug)
  const body = z
    .object({
      destinationId: z.number().int().positive(),
      enabled: z.boolean().default(true),
      cooldownMinutes: z.number().int().min(0).max(1440).nullable().default(null),
    })
    .safeParse(req.body)

  if (!slug.success || !body.success) {
    res.status(400).json({ error: 'invalid route' })
    return
  }

  if ((await getDestinationOrg(body.data.destinationId)) !== org.slug) {
    res.status(400).json({ error: 'that destination belongs to another organisation' })
    return
  }

  await upsertProject(org.slug, slug.data)
  await upsertRoute(
    org.slug,
    slug.data,
    body.data.destinationId,
    body.data.enabled,
    body.data.cooldownMinutes,
  )
  res.json(await listProjects(org.slug))
})

apiRouter.delete('/routes/:slug', async (req, res) => {
  const org = await requireOrg(req, res)
  if (!org) return

  const slug = slugSchema.safeParse(req.params.slug)
  if (!slug.success) {
    res.status(400).json({ error: 'invalid project slug' })
    return
  }
  await deleteRoute(org.slug, slug.data)
  res.json(await listProjects(org.slug))
})

apiRouter.get('/destinations', async (req, res) => {
  const org = await requireOrg(req, res)
  if (!org) return
  res.json(await listDestinations(org.slug))
})

apiRouter.post('/destinations', async (req, res) => {
  const org = await requireOrg(req, res)
  if (!org) return

  const parsed = destinationSchema.safeParse(req.body)

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'invalid destination' })
    return
  }

  res.status(201).json(
    await createDestination(org.slug, parsed.data.label, parsed.data.webhookUrl),
  )
})

apiRouter.patch('/destinations/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: 'invalid destination id' })
    return
  }

  const parsed = destinationSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'invalid destination' })
    return
  }

  const updated = await updateDestination(id, parsed.data.label, parsed.data.webhookUrl)
  if (!updated) {
    res.status(404).json({ error: 'destination not found' })
    return
  }

  res.json(updated)
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
  const org = await requireOrg(req, res)
  if (!org) return

  const limit = z.coerce.number().int().min(1).max(500).catch(100).parse(req.query.limit)
  res.json(await listDeliveries(org.slug, limit))
})

const toSettingsDto = (settings: Settings): SettingsDto => ({
  pollIntervalMinutes: settings.pollIntervalMinutes,
  alertCooldownMinutes: settings.alertCooldownMinutes,
  retentionDays: settings.retentionDays,
  lastPollAt: settings.lastPollAt?.toISOString() ?? null,
})

apiRouter.get('/settings', async (_req, res) => {
  res.json(toSettingsDto(await getSettings()))
})

apiRouter.patch('/settings', async (req, res) => {
  const parsed = z
    .object({
      pollIntervalMinutes: z.number().int().min(1).max(1440),
      alertCooldownMinutes: z.number().int().min(0).max(1440),
      retentionDays: z.number().int().min(1).max(3650),
    })
    .safeParse(req.body)

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'invalid settings' })
    return
  }

  const before = await getSettings()
  const settings = await updateSettings(parsed.data)
  if (settings.pollIntervalMinutes !== before.pollIntervalMinutes) {
    restartPoller(settings.pollIntervalMinutes)
  }

  res.json(toSettingsDto(settings))
})

apiRouter.post('/poll', async (_req, res) => {
  try {
    res.json(await pollNow())
  } catch (err) {
    res.status(409).json({ error: err instanceof Error ? err.message : 'poll failed' })
  }
})
