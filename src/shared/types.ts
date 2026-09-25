export type DeliveryOutcome = 'sent' | 'unrouted' | 'failed'

export type IngestSource = 'polling' | 'test'

/** The issue shape the Sentry API client produces. */
export interface NormalizedIssue {
  id: string
  title: string
  culprit?: string | null
  level?: string | null
  shortId?: string | null
  url?: string | null
  count?: number | null
  projectSlug: string
  projectName?: string | null
  environment?: string | null
}

export interface DestinationDto {
  id: number
  label: string
  urlHint: string
  createdAt: string
  lastOutcome: DeliveryOutcome | null
  lastDeliveryAt: string | null
}

export interface ProjectDto {
  slug: string
  name: string | null
  firstSeenAt: string
  lastSeenAt: string
  route: { destinationId: number; enabled: boolean; updatedAt: string } | null
}

export interface DeliveryDto {
  id: string
  receivedAt: string
  source: IngestSource
  projectSlug: string | null
  issueTitle: string | null
  issueUrl: string | null
  destinationId: number | null
  destinationLabel: string | null
  outcome: DeliveryOutcome
  detail: string | null
}

export interface SettingsDto {
  pollIntervalMinutes: number
  lastPollAt: string | null
}

export interface MeDto {
  authenticated: true
  releaseVersion: string | null
  gitSha: string | null
  staging: boolean
}

export interface ApiError {
  error: string
}
