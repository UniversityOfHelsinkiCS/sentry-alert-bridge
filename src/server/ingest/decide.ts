import { config } from '../config.js'
import type { ClaimState } from '../db/seenIssues.js'

/**
 * Why an issue would or would not alert right now. The poller acts on this and
 * the debug view prints it, so what the UI explains is always what the poller
 * actually did rather than a second copy of the rule.
 */
export type AlertDecision =
  | 'alert'
  /** Its last event predates the route's start time, so it is history. */
  | 'before-start'
  /** Nothing has happened since the last alert. */
  | 'no-new-events'
  /** It has fired again, but too soon after the last alert. */
  | 'in-cooldown'
  /** Sentry gave no usable lastSeen, so there is nothing to compare. */
  | 'unknown'

export interface DecideInput {
  lastSeen: string | null | undefined
  /** The route's alerts_from: events before it can never alert. */
  alertsFrom: Date
  /** What this app already knows about the issue, if anything. */
  state?: ClaimState
  now?: number
  cooldownMs?: number
}

export function decideAlert(input: DecideInput): AlertDecision {
  const now = input.now ?? Date.now()
  const cooldownMs = input.cooldownMs ?? config.alertCooldownMs

  const lastSeen = input.lastSeen ? Date.parse(input.lastSeen) : Number.NaN
  if (Number.isNaN(lastSeen)) return 'unknown'

  // The line between history and news. Without it, routing a project would
  // replay every issue Sentry still considers unresolved.
  if (lastSeen < input.alertsFrom.getTime()) return 'before-start'

  const state = input.state
  if (!state || state.alertedAt === null) return 'alert'

  // A regression of something resolved from Slack is news whatever the
  // cooldown says — that resolve is exactly the signal that someone cares.
  if (state.releasedAt !== null) return 'alert'

  if (lastSeen <= state.alertedAt.getTime()) return 'no-new-events'
  if (now - state.alertedAt.getTime() < cooldownMs) return 'in-cooldown'

  return 'alert'
}
