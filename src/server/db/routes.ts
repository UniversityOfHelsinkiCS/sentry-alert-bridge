import { query } from './pool.js'

export interface Route {
  projectSlug: string
  destinationId: number
  enabled: boolean
}

export async function getRoute(projectSlug: string): Promise<Route | null> {
  const { rows } = await query<{ project_slug: string; destination_id: number; enabled: boolean }>(
    'select project_slug, destination_id, enabled from routes where project_slug = $1',
    [projectSlug],
  )
  const row = rows[0]
  return row
    ? { projectSlug: row.project_slug, destinationId: row.destination_id, enabled: row.enabled }
    : null
}

/** Project slugs the poller should ask Sentry about. */
export async function listEnabledRoutes(): Promise<Route[]> {
  const { rows } = await query<{ project_slug: string; destination_id: number; enabled: boolean }>(
    'select project_slug, destination_id, enabled from routes where enabled order by project_slug',
  )
  return rows.map((r) => ({
    projectSlug: r.project_slug,
    destinationId: r.destination_id,
    enabled: r.enabled,
  }))
}

export async function upsertRoute(
  projectSlug: string,
  destinationId: number,
  enabled: boolean,
): Promise<void> {
  await query(
    `insert into routes (project_slug, destination_id, enabled)
     values ($1, $2, $3)
     on conflict (project_slug) do update
        set destination_id = excluded.destination_id,
            enabled = excluded.enabled,
            updated_at = now()`,
    [projectSlug, destinationId, enabled],
  )
}

export async function deleteRoute(projectSlug: string): Promise<void> {
  await query('delete from routes where project_slug = $1', [projectSlug])
}
