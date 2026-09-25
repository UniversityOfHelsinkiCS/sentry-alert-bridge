import type { ProjectDto } from '../../shared/types.js'
import { query } from './pool.js'

interface ProjectRow {
  slug: string
  name: string | null
  first_seen_at: Date
  last_seen_at: Date
  destination_id: number | null
  enabled: boolean | null
  updated_at: Date | null
}

/**
 * Auto-learning: called for every issue we see, from either ingest mode, and
 * for every project the Sentry API lists while polling.
 */
export async function upsertProject(slug: string, name?: string | null): Promise<void> {
  await query(
    `insert into sentry_projects (slug, name)
     values ($1, $2)
     on conflict (slug) do update
        set last_seen_at = now(),
            name = coalesce(excluded.name, sentry_projects.name)`,
    [slug, name ?? null],
  )
}

export async function listProjects(): Promise<ProjectDto[]> {
  const { rows } = await query<ProjectRow>(`
    select p.slug, p.name, p.first_seen_at, p.last_seen_at,
           r.destination_id, r.enabled, r.updated_at
      from sentry_projects p
      left join routes r on r.project_slug = p.slug
     order by (r.destination_id is null) desc, p.slug
  `)

  return rows.map((row) => ({
    slug: row.slug,
    name: row.name,
    firstSeenAt: row.first_seen_at.toISOString(),
    lastSeenAt: row.last_seen_at.toISOString(),
    route:
      row.destination_id === null
        ? null
        : {
            destinationId: row.destination_id,
            enabled: row.enabled ?? false,
            updatedAt: (row.updated_at ?? row.last_seen_at).toISOString(),
          },
  }))
}
