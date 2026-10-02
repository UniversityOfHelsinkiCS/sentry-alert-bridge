import { z } from 'zod'
import type { NormalizedIssue } from '../../shared/types.js'
import { config } from '../config.js'
import {
  apiEventSchema,
  apiIssueSchema,
  apiProjectSchema,
  type ApiEvent,
  type ApiIssue,
} from './types.js'

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

export interface SentryOrg {
  slug: string
  authToken: string
  baseUrl: string | null
}

interface RequestOptions {
  method?: 'GET' | 'PUT'
  search?: Record<string, string>
  body?: unknown
}

async function request(
  org: SentryOrg,
  path: string,
  options: RequestOptions = {},
): Promise<unknown> {
  if (!org.authToken) {
    throw new SentryApiError(`no Sentry auth token stored for org ${org.slug}`, 0)
  }

  const url = new URL(path, org.baseUrl ?? config.SENTRY_BASE_URL)
  for (const [key, value] of Object.entries(options.search ?? {})) {
    url.searchParams.set(key, value)
  }

  const hasBody = options.body !== undefined

  const res = await fetch(url, {
    method: options.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${org.authToken}`,
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

  if (res.status === 204) return null

  return res.json()
}

async function get(
  org: SentryOrg,
  path: string,
  search?: Record<string, string>,
): Promise<unknown> {
  return request(org, path, { search })
}

export interface SentryProject {
  slug: string
  name: string | null
}

export async function listOrgProjects(org: SentryOrg): Promise<SentryProject[]> {
  const body = await get(org, `/api/0/organizations/${org.slug}/projects/`)
  const parsed = z.array(apiProjectSchema).safeParse(body)
  if (!parsed.success) throw new SentryApiError('unexpected project list shape', 0)
  return parsed.data.map((p) => ({ slug: p.slug, name: p.name ?? null }))
}

export async function listNewIssues(
  org: SentryOrg,
  projectSlug: string,
  limit = 25,
): Promise<ApiIssue[]> {
  const body = await get(org, `/api/0/projects/${org.slug}/${projectSlug}/issues/`, {
    query: 'is:unresolved',
    sort: 'new',
    limit: String(limit),
  })
  const parsed = z.array(apiIssueSchema).safeParse(body)
  if (!parsed.success) throw new SentryApiError('unexpected issue list shape', 0)
  return parsed.data
}

export async function getLatestEvent(org: SentryOrg, issueId: string): Promise<ApiEvent | null> {
  const body = await get(org, `/api/0/issues/${encodeURIComponent(issueId)}/events/latest/`)
  const parsed = apiEventSchema.safeParse(body)
  return parsed.success ? parsed.data : null
}

export async function resolveIssue(org: SentryOrg, issueId: string): Promise<void> {
  await request(org, `/api/0/issues/${encodeURIComponent(issueId)}/`, {
    method: 'PUT',
    body: { status: 'resolved' },
  })
}

export function normalizeApiIssue(
  org: SentryOrg,
  issue: ApiIssue,
  projectSlug: string,
  projectName: string | null,
  frame: string | null = null,
): NormalizedIssue {
  return {
    id: issue.id,
    orgSlug: org.slug,
    title: issue.title,
    culprit: issue.culprit ?? null,
    level: issue.level ?? null,
    shortId: issue.shortId ?? null,
    url:
      issue.permalink ??
      new URL(
        `/organizations/${org.slug}/issues/${issue.id}/`,
        org.baseUrl ?? config.SENTRY_BASE_URL,
      ).toString(),
    count: issue.count === null || issue.count === undefined ? null : Number(issue.count),
    projectSlug,
    projectName,
    environment: null,
    frame,
  }
}
