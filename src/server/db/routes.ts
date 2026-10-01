import { Route as RouteModel } from './model/index.js'

export interface Route {
  projectSlug: string
  destinationId: number
  enabled: boolean
  alertsFrom: Date
  cooldownMinutes: number | null
}

const toRoute = (row: RouteModel): Route => ({
  projectSlug: row.projectSlug,
  destinationId: row.destinationId,
  enabled: row.enabled,
  alertsFrom: row.alertsFrom,
  cooldownMinutes: row.cooldownMinutes,
})

export async function getRoute(projectSlug: string): Promise<Route | null> {
  const row = await RouteModel.findByPk(projectSlug)
  return row ? toRoute(row) : null
}

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
  cooldownMinutes: number | null,
): Promise<void> {
  await RouteModel.upsert({
    projectSlug,
    destinationId,
    enabled,
    cooldownMinutes,
    updatedAt: new Date(),
  })
}

export async function deleteRoute(projectSlug: string): Promise<void> {
  await RouteModel.destroy({ where: { projectSlug } })
}
