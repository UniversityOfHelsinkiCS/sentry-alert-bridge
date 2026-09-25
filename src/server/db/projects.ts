import { literal } from 'sequelize'
import type { ProjectDto } from '../../shared/types.js'
import { Route, SentryProject } from './models.js'

/**
 * Auto-learning: called for every issue the poller sees, and for every project
 * the Sentry API lists. `name` is left out of the payload when we do not have
 * one, so an upsert never overwrites a known name with null.
 */
export async function upsertProject(slug: string, name?: string | null): Promise<void> {
  await SentryProject.upsert({
    slug,
    lastSeenAt: new Date(),
    ...(name == null ? {} : { name }),
  })
}

export async function listProjects(): Promise<ProjectDto[]> {
  const projects = await SentryProject.findAll({
    include: [{ model: Route, as: 'route', required: false }],
    // Unrouted projects first, so the ones needing attention are at the top.
    order: [literal('"route"."destination_id" is null desc'), ['slug', 'ASC']],
  })

  return projects.map((project) => ({
    slug: project.slug,
    name: project.name,
    firstSeenAt: project.firstSeenAt.toISOString(),
    lastSeenAt: project.lastSeenAt.toISOString(),
    route: project.route
      ? {
          destinationId: project.route.destinationId,
          enabled: project.route.enabled,
          updatedAt: (project.route.updatedAt ?? project.lastSeenAt).toISOString(),
        }
      : null,
  }))
}
