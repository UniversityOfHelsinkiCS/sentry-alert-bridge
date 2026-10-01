import type { OrgDto } from '../../shared/types.js'
import type { SentryOrg as SentryOrgType } from '../sentry/api.js'
import { Route, SentryOrg, SlackDestination } from './model/index.js'
import { countProjects } from './projects.js'

export interface OrgInput {
  slug: string
  name: string | null
  authToken?: string
  baseUrl: string | null
}

async function toDto(org: SentryOrg): Promise<OrgDto> {
  return {
    slug: org.slug,
    name: org.name,
    hasToken: org.authToken.length > 0,
    baseUrl: org.baseUrl,
    projectCount: await countProjects(org.slug),
  }
}

const toSentryOrg = (org: SentryOrg): SentryOrgType => ({
  slug: org.slug,
  authToken: org.authToken,
  baseUrl: org.baseUrl,
})

export async function listOrgs(): Promise<OrgDto[]> {
  const orgs = await SentryOrg.findAll({ order: [['slug', 'ASC']] })
  return Promise.all(orgs.map(toDto))
}

export async function listPollableOrgs(): Promise<SentryOrgType[]> {
  const orgs = await SentryOrg.findAll({ order: [['slug', 'ASC']] })
  return orgs.map(toSentryOrg)
}

export async function getOrg(slug: string): Promise<SentryOrgType | null> {
  const org = await SentryOrg.findByPk(slug)
  return org ? toSentryOrg(org) : null
}

export async function orgExists(slug: string): Promise<boolean> {
  return (await SentryOrg.count({ where: { slug } })) > 0
}

export async function createOrg(input: OrgInput): Promise<OrgDto> {
  const org = await SentryOrg.create({
    slug: input.slug,
    name: input.name,
    authToken: input.authToken ?? '',
    baseUrl: input.baseUrl,
  })
  return toDto(org)
}

export async function updateOrg(slug: string, input: OrgInput): Promise<OrgDto | null> {
  const org = await SentryOrg.findByPk(slug)
  if (!org) return null
  await org.update({
    name: input.name,
    baseUrl: input.baseUrl,
    ...(input.authToken ? { authToken: input.authToken } : {}),
  })
  return toDto(org)
}

export interface OrgUsage {
  routes: number
  destinations: number
}

export async function countOrgUsage(slug: string): Promise<OrgUsage> {
  const [routes, destinations] = await Promise.all([
    Route.count({ where: { orgSlug: slug } }),
    SlackDestination.count({ where: { orgSlug: slug } }),
  ])
  return { routes, destinations }
}

export async function deleteOrg(slug: string): Promise<void> {
  await SentryOrg.destroy({ where: { slug } })
}
