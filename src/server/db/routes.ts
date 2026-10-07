import { Route as RouteModel } from './model/index.js'

export interface Route {
  orgSlug: string
  projectSlug: string
  destinationId: number
  enabled: boolean
  alertsFrom: Date
  cooldownMinutes: number | null
  recapPatterns: string[]
  recapTimes: string[]
  lastRecapAt: Date | null
}

const toRoute = (row: RouteModel): Route => ({
  orgSlug: row.orgSlug,
  projectSlug: row.projectSlug,
  destinationId: row.destinationId,
  enabled: row.enabled,
  alertsFrom: row.alertsFrom,
  cooldownMinutes: row.cooldownMinutes,
  recapPatterns: row.recapPatterns ?? [],
  recapTimes: row.recapTimes ?? [],
  lastRecapAt: row.lastRecapAt,
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

export async function listRecapRoutes(): Promise<Route[]> {
  const rows = await RouteModel.findAll({
    where: { enabled: true },
    order: [
      ['orgSlug', 'ASC'],
      ['projectSlug', 'ASC'],
    ],
  })
  return rows.map(toRoute).filter((route) => route.recapTimes.length > 0)
}

export async function updateRouteRecap(
  orgSlug: string,
  projectSlug: string,
  recapPatterns: string[],
  recapTimes: string[],
): Promise<boolean> {
  const [updated] = await RouteModel.update(
    { recapPatterns, recapTimes, updatedAt: new Date() },
    { where: { orgSlug, projectSlug } },
  )
  return updated > 0
}

export async function stampRecapRun(
  orgSlug: string,
  projectSlug: string,
  at: Date,
): Promise<void> {
  await RouteModel.update({ lastRecapAt: at }, { where: { orgSlug, projectSlug } })
}

export async function deleteRoute(orgSlug: string, projectSlug: string): Promise<void> {
  await RouteModel.destroy({ where: { orgSlug, projectSlug } })
}
