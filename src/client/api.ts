import { useCallback, useEffect, useState } from 'react'
import type {
  DeliveryDto,
  DestinationDto,
  MeDto,
  OrgDto,
  ProjectDto,
  ProjectIssuesDto,
  SettingsDto,
} from '../shared/types'

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }

  get isUnauthorized(): boolean {
    return this.status === 401
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
      ...init?.headers,
    },
  })

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new ApiError(body?.error ?? `request failed (${res.status})`, res.status)
  }

  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

const body = (data: unknown) => ({ body: JSON.stringify(data) })

const scoped = (path: string, org: string, extra: Record<string, string> = {}) => {
  const params = new URLSearchParams({ org, ...extra })
  return `${path}?${params.toString()}`
}

export interface OrgInput {
  slug: string
  name: string | null
  authToken?: string
  baseUrl: string | null
}

export const api = {
  me: () => request<MeDto>('/me'),
  login: (token: string) => request<{ ok: true }>('/login', { method: 'POST', ...body({ token }) }),
  logout: () => request<{ ok: true }>('/logout', { method: 'POST' }),

  orgs: () => request<OrgDto[]>('/orgs'),
  addOrg: (input: OrgInput) => request<OrgDto>('/orgs', { method: 'POST', ...body(input) }),
  updateOrg: (slug: string, input: Omit<OrgInput, 'slug'>) =>
    request<OrgDto>(`/orgs/${encodeURIComponent(slug)}`, { method: 'PATCH', ...body(input) }),
  deleteOrg: (slug: string) =>
    request<{ ok: true }>(`/orgs/${encodeURIComponent(slug)}`, { method: 'DELETE' }),
  testOrg: (slug: string) =>
    request<{ ok: true; projects: number }>(`/orgs/${encodeURIComponent(slug)}/test`, {
      method: 'POST',
    }),

  projects: (org: string) => request<ProjectDto[]>(scoped('/projects', org)),
  projectIssues: (org: string, slug: string) =>
    request<ProjectIssuesDto>(scoped(`/projects/${encodeURIComponent(slug)}/issues`, org)),
  addProject: (org: string, slug: string) =>
    request<ProjectDto[]>(scoped('/projects', org), { method: 'POST', ...body({ slug }) }),
  setRoute: (
    org: string,
    slug: string,
    destinationId: number,
    enabled: boolean,
    cooldownMinutes: number | null = null,
  ) =>
    request<ProjectDto[]>(scoped(`/routes/${encodeURIComponent(slug)}`, org), {
      method: 'PUT',
      ...body({ destinationId, enabled, cooldownMinutes }),
    }),
  clearRoute: (org: string, slug: string) =>
    request<ProjectDto[]>(scoped(`/routes/${encodeURIComponent(slug)}`, org), {
      method: 'DELETE',
    }),

  destinations: (org: string) => request<DestinationDto[]>(scoped('/destinations', org)),
  addDestination: (org: string, label: string, webhookUrl: string) =>
    request<DestinationDto>(scoped('/destinations', org), {
      method: 'POST',
      ...body({ label, webhookUrl }),
    }),
  updateDestination: (id: number, label: string, webhookUrl: string) =>
    request<DestinationDto>(`/destinations/${id}`, {
      method: 'PATCH',
      ...body({ label, webhookUrl }),
    }),
  deleteDestination: (id: number) =>
    request<{ ok: true }>(`/destinations/${id}`, { method: 'DELETE' }),
  testDestination: (id: number) =>
    request<{ ok: true }>(`/destinations/${id}/test`, { method: 'POST' }),

  deliveries: (org: string, limit = 100) =>
    request<DeliveryDto[]>(scoped('/deliveries', org, { limit: String(limit) })),

  settings: () => request<SettingsDto>('/settings'),
  updateSettings: (
    values: Pick<
      SettingsDto,
      'pollIntervalMinutes' | 'alertCooldownMinutes' | 'retentionDays'
    >,
  ) => request<SettingsDto>('/settings', { method: 'PATCH', ...body(values) }),
  pollNow: () => request<Record<string, number>>('/poll', { method: 'POST' }),
}

export interface UseApi<T> {
  data: T | undefined
  error: string | null
  loading: boolean
  reload: () => void
  setData: (value: T) => void
}

export function useApi<T>(fetcher: () => Promise<T>, deps: unknown[] = []): UseApi<T> {
  const [data, setData] = useState<T>()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [nonce, setNonce] = useState(0)

  const run = useCallback(fetcher, deps)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    run()
      .then((value) => {
        if (!cancelled) {
          setData(value)
          setError(null)
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (err instanceof ApiError && err.isUnauthorized) {
          window.dispatchEvent(new Event('unauthorized'))
          return
        }
        setError(err instanceof Error ? err.message : 'request failed')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [run, nonce])

  return { data, error, loading, reload: () => setNonce((n) => n + 1), setData }
}
