import { useCallback, useEffect, useState } from 'react'
import type {
  DeliveryDto,
  DestinationDto,
  MeDto,
  ProjectDto,
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

export const api = {
  me: () => request<MeDto>('/me'),
  login: (token: string) => request<{ ok: true }>('/login', { method: 'POST', ...body({ token }) }),
  logout: () => request<{ ok: true }>('/logout', { method: 'POST' }),

  projects: () => request<ProjectDto[]>('/projects'),
  addProject: (slug: string) =>
    request<ProjectDto[]>('/projects', { method: 'POST', ...body({ slug }) }),
  setRoute: (slug: string, destinationId: number, enabled: boolean) =>
    request<ProjectDto[]>(`/routes/${encodeURIComponent(slug)}`, {
      method: 'PUT',
      ...body({ destinationId, enabled }),
    }),
  clearRoute: (slug: string) =>
    request<ProjectDto[]>(`/routes/${encodeURIComponent(slug)}`, { method: 'DELETE' }),

  destinations: () => request<DestinationDto[]>('/destinations'),
  addDestination: (label: string, webhookUrl: string) =>
    request<DestinationDto>('/destinations', { method: 'POST', ...body({ label, webhookUrl }) }),
  deleteDestination: (id: number) =>
    request<{ ok: true }>(`/destinations/${id}`, { method: 'DELETE' }),
  testDestination: (id: number) =>
    request<{ ok: true }>(`/destinations/${id}/test`, { method: 'POST' }),

  deliveries: (limit = 100) => request<DeliveryDto[]>(`/deliveries?limit=${limit}`),

  settings: () => request<SettingsDto>('/settings'),
  setIngestMode: (ingestMode: SettingsDto['ingestMode']) =>
    request<SettingsDto>('/settings', { method: 'PUT', ...body({ ingestMode }) }),
  pollNow: () => request<Record<string, number>>('/poll', { method: 'POST' }),
}

export interface UseApi<T> {
  data: T | undefined
  error: string | null
  loading: boolean
  reload: () => void
  setData: (value: T) => void
}

/** Minimal data hook — one request per page is all this app needs. */
export function useApi<T>(fetcher: () => Promise<T>, deps: unknown[] = []): UseApi<T> {
  const [data, setData] = useState<T>()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [nonce, setNonce] = useState(0)

  // The fetcher is recreated on every render; the caller's deps decide reloads.
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
