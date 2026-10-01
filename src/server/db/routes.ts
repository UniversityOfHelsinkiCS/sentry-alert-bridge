import { Route as RouteModel } from './model/index.js'

export interface Route {
  orgSlug: string
  projectSlug: string
  destinationId: number
  enabled: boolean
  alertsFrom: Date
  cooldownMinutes: number | null
}

const toRoute = (row: RouteModel): Route => ({
  orgSlug: row.orgSlug,
  projectSlug: row.projectSlug,
  destinationId: row.destinationId,
  enabled: row.enabled,
  alertsFrom: row.alertsFrom,
  cooldownMinutes: row.cooldownMinutes,
})

export async function getRoute(orgSlug: string, projectSlug: string): Promise<Route | null> {
  const row = await RouteModel.findOne({ where: { orgSlug, projectSlug } })
  return row ? toRoute(row) : null
}

export async function listEnabledRoutes(orgSlug?: string): Promise<Route[]> {
  const rows = await RouteModel.findAll({
    where: { enabled: true, ...(orgSlug === undefined ? {} : { orgSlug }) },
    order: [['projectSlug', 'ASC']],
  })
  return rows.map(toRoute)
}

export async function upsertRoute(
  orgSlug: string,
  projectSlug: string,
  destinationId: number,
  enabled: boolean,
  cooldownMinutes: number | null,
): Promise<void> {
  await RouteModel.upsert({
    orgSlug,
    projectSlug,
    destinationId,
    enabled,
    cooldownMinutes,
    updatedAt: new Date(),
  })
}

export async function deleteRoute(orgSlug: string, projectSlug: string): Promise<void> {
  await RouteModel.destroy({ where: { orgSlug, projectSlug } })
}
