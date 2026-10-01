import type { ProjectDto } from '../../shared/types.js'
import { Route, SentryProject } from './model/index.js'

export async function upsertProject(
  orgSlug: string,
  slug: string,
  name?: string | null,
): Promise<void> {
  await SentryProject.upsert({
    orgSlug,
    slug,
    lastSeenAt: new Date(),
    ...(name == null ? {} : { name }),
  })
}

export async function listProjects(orgSlug: string): Promise<ProjectDto[]> {
  const [projects, routes] = await Promise.all([
    SentryProject.findAll({ where: { orgSlug }, order: [['slug', 'ASC']] }),
    Route.findAll({ where: { orgSlug } }),
  ])

  const byProject = new Map(routes.map((route) => [route.projectSlug, route]))

  const dtos = projects.map((project) => {
    const route = byProject.get(project.slug)
    return {
      orgSlug: project.orgSlug,
      slug: project.slug,
      name: project.name,
      firstSeenAt: project.firstSeenAt.toISOString(),
      lastSeenAt: project.lastSeenAt.toISOString(),
      route: route
        ? {
            destinationId: route.destinationId,
            enabled: route.enabled,
            cooldownMinutes: route.cooldownMinutes,
            updatedAt: (route.updatedAt ?? project.lastSeenAt).toISOString(),
          }
        : null,
    }
  })

  return dtos.sort((a, b) => {
    if ((a.route === null) !== (b.route === null)) return a.route === null ? -1 : 1
    return a.slug.localeCompare(b.slug)
  })
}

export async function countProjects(orgSlug: string): Promise<number> {
  return SentryProject.count({ where: { orgSlug } })
}
