export const MAX_COOLDOWN_MINUTES = 52_560_000

export type DeliveryOutcome = 'sent' | 'unrouted' | 'failed'

export type IngestSource = 'polling' | 'test' | 'resolve'

/** The issue shape the Sentry API client produces. */
export interface OrgDto {
  slug: string
  name: string | null
  hasToken: boolean
  baseUrl: string | null
  projectCount: number
}

export interface NormalizedIssue {
  id: string
  orgSlug: string
  title: string
  culprit?: string | null
  level?: string | null
  shortId?: string | null
  url?: string | null
  count?: number | null
  projectSlug: string
  projectName?: string | null
  environment?: string | null
  /** Deepest in-app stack frame of the latest event, when one could be read. */
  frame?: string | null
}

export interface DestinationDto {
  id: number
  orgSlug: string
  label: string
  webhookUrl: string
  createdAt: string
  lastOutcome: DeliveryOutcome | null
  lastDeliveryAt: string | null
}

/** Why the poller would or would not alert on an issue, for the debug view. */
export type IssueVerdict =
  | 'alert'
  | 'before-start'
  | 'no-new-events'
  | 'in-cooldown'
  | 'unknown'

export interface ProjectIssueDto {
  id: string
  title: string
  shortId: string | null
  level: string | null
  url: string | null
  firstSeen: string | null
  lastSeen: string | null
  /** When this app last alerted on it; null means never. */
  alertedAt: string | null
  verdict: IssueVerdict
}

export interface ProjectIssuesDto {
  orgSlug: string
  projectSlug: string
  /** The route's start time: events before it are history and never alert. */
  alertsFrom: string
  cooldownMinutes: number
  issues: ProjectIssueDto[]
}

export interface ProjectDto {
  orgSlug: string
  slug: string
  name: string | null
  firstSeenAt: string
  lastSeenAt: string
  route: {
    destinationId: number
    enabled: boolean
    cooldownMinutes: number | null
    updatedAt: string
  } | null
}

export interface DeliveryDto {
  id: string
  receivedAt: string
  source: IngestSource
  orgSlug: string | null
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
  alertCooldownMinutes: number
  retentionDays: number
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
