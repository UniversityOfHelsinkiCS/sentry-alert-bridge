import { Route as RouteModel } from './models.js'

export interface Route {
  projectSlug: string
  destinationId: number
  enabled: boolean
}

const toRoute = (row: RouteModel): Route => ({
  projectSlug: row.projectSlug,
  destinationId: row.destinationId,
  enabled: row.enabled,
})

export async function getRoute(projectSlug: string): Promise<Route | null> {
  const row = await RouteModel.findByPk(projectSlug)
  return row ? toRoute(row) : null
}

/** Project slugs the poller should ask Sentry about. */
export async function listEnabledRoutes(): Promise<Route[]> {
  const rows = await RouteModel.findAll({
    where: { enabled: true },
    order: [['projectSlug', 'ASC']],
  })
  return rows.map(toRoute)
}

export async function upsertRoute(
  projectSlug: string,
  destinationId: number,
  enabled: boolean,
): Promise<void> {
  await RouteModel.upsert({ projectSlug, destinationId, enabled, updatedAt: new Date() })
}

export async function deleteRoute(projectSlug: string): Promise<void> {
  await RouteModel.destroy({ where: { projectSlug } })
}
