import { z } from 'zod'
import type { NormalizedIssue } from '../../shared/types.js'
import { config } from '../config.js'
import { apiIssueSchema, apiProjectSchema, type ApiIssue } from './types.js'

export class SentryApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'SentryApiError'
  }

  get isRateLimited(): boolean {
    return this.status === 429
  }
}

interface RequestOptions {
  method?: 'GET' | 'PUT'
  search?: Record<string, string>
  body?: unknown
}

async function request(path: string, options: RequestOptions = {}): Promise<unknown> {
  if (!config.SENTRY_AUTH_TOKEN) {
    throw new SentryApiError('SENTRY_AUTH_TOKEN is not set', 0)
  }

  const url = new URL(path, config.SENTRY_BASE_URL)
  for (const [key, value] of Object.entries(options.search ?? {})) {
    url.searchParams.set(key, value)
  }

  const hasBody = options.body !== undefined

  const res = await fetch(url, {
    method: options.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${config.SENTRY_AUTH_TOKEN}`,
      Accept: 'application/json',
      ...(hasBody ? { 'content-type': 'application/json' } : {}),
    },
    body: hasBody ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(15_000),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new SentryApiError(
      `Sentry API ${res.status} for ${path}${body ? `: ${body.slice(0, 200)}` : ''}`,
      res.status,
    )
  }

  // A mutation answers 204 with no body, and res.json() would throw on it.
  if (res.status === 204) return null

  return res.json()
}

async function get(path: string, search?: Record<string, string>): Promise<unknown> {
  return request(path, { search })
}

export interface SentryProject {
  slug: string
  name: string | null
}

export async function listOrgProjects(): Promise<SentryProject[]> {
  const body = await get(`/api/0/organizations/${config.SENTRY_ORG_SLUG}/projects/`)
  const parsed = z.array(apiProjectSchema).safeParse(body)
  if (!parsed.success) throw new SentryApiError('unexpected project list shape', 0)
  return parsed.data.map((p) => ({ slug: p.slug, name: p.name ?? null }))
}

export async function listNewIssues(projectSlug: string, limit = 25): Promise<ApiIssue[]> {
  const body = await get(
    `/api/0/projects/${config.SENTRY_ORG_SLUG}/${projectSlug}/issues/`,
    { query: 'is:unresolved', sort: 'new', limit: String(limit) },
  )
  const parsed = z.array(apiIssueSchema).safeParse(body)
  if (!parsed.success) throw new SentryApiError('unexpected issue list shape', 0)
  return parsed.data
}

/**
 * The org-scoped form rather than the project-scoped bulk mutate: the bulk
 * endpoint answers 204 having changed nothing when the issue is not in the
 * project, while this one 404s and says so.
 *
 * Needs the event:write scope on SENTRY_AUTH_TOKEN; polling only needs read.
 */
export async function resolveIssue(issueId: string): Promise<void> {
  await request(`/api/0/issues/${encodeURIComponent(issueId)}/`, {
    method: 'PUT',
    body: { status: 'resolved' },
  })
}

export function normalizeApiIssue(
  issue: ApiIssue,
  projectSlug: string,
  projectName: string | null,
): NormalizedIssue {
  return {
    id: issue.id,
    title: issue.title,
    culprit: issue.culprit ?? null,
    level: issue.level ?? null,
    shortId: issue.shortId ?? null,
    url:
      issue.permalink ??
      new URL(
        `/organizations/${config.SENTRY_ORG_SLUG}/issues/${issue.id}/`,
        config.SENTRY_BASE_URL,
      ).toString(),
    count: issue.count === null || issue.count === undefined ? null : Number(issue.count),
    projectSlug,
    projectName,
    environment: null,
  }
}
