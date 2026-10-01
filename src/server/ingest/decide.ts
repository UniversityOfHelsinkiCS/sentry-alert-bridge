import { config } from '../config.js'
import type { ClaimState } from '../db/seenIssues.js'

export type AlertDecision =
  | 'alert'
  | 'before-start'
  | 'no-new-events'
  | 'in-cooldown'
  | 'unknown'

export interface DecideInput {
  lastSeen: string | null | undefined
  alertsFrom: Date
  state?: ClaimState
  now?: number
  cooldownMs?: number
}

export function decideAlert(input: DecideInput): AlertDecision {
  const now = input.now ?? Date.now()
  const cooldownMs = input.cooldownMs ?? config.alertCooldownMs

  const lastSeen = input.lastSeen ? Date.parse(input.lastSeen) : Number.NaN
  if (Number.isNaN(lastSeen)) return 'unknown'

  if (lastSeen < input.alertsFrom.getTime()) return 'before-start'

  const state = input.state
  if (!state || state.alertedAt === null) return 'alert'

  if (state.releasedAt !== null) return 'alert'

  if (lastSeen <= state.alertedAt.getTime()) return 'no-new-events'
  if (now - state.alertedAt.getTime() < cooldownMs) return 'in-cooldown'

  return 'alert'
}
