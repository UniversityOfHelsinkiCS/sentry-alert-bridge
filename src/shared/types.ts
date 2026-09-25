export type DeliveryOutcome = 'sent' | 'unrouted' | 'failed'

export type IngestSource = 'polling' | 'test' | 'resolve'

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
  projectSlug: string
  /** The route's start time: events before it are history and never alert. */
  alertsFrom: string
  cooldownMinutes: number
  issues: ProjectIssueDto[]
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
