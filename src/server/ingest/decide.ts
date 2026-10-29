import { config } from '../config.js'
import type { ClaimState } from '../db/seenIssues.js'

export type AlertDecision =
  | 'alert'
  | 'before-start'
  | 'no-new-events'
  | 'in-cooldown'
  | 'unknown'

export interface CooldownInput {
  state?: ClaimState
  now?: number
  cooldownMs?: number
  backoffCeilingMs?: number | null
}

export interface DecideInput extends CooldownInput {
  lastSeen: string | null | undefined
  alertsFrom: Date
}

export function currentCooldownMs(input: CooldownInput): number {
  const cooldownMs = input.cooldownMs ?? config.alertCooldownMs
  const ceilingMs = input.backoffCeilingMs ?? null
  const streak = input.state?.alertStreak ?? 0
  if (ceilingMs === null || cooldownMs === 0 || streak <= 1) return cooldownMs

  const grown = Math.min(cooldownMs * 2 ** (streak - 1), ceilingMs)
  return Math.max(cooldownMs, grown)
}

export function isQuietSinceAlert(input: CooldownInput): boolean {
  const ceilingMs = input.backoffCeilingMs ?? null
  const alertedAt = input.state?.alertedAt ?? null
  if (ceilingMs === null || alertedAt === null) return false

  const now = input.now ?? Date.now()
  return now - alertedAt.getTime() >= currentCooldownMs(input) + ceilingMs
}

export function decideAlert(input: DecideInput): AlertDecision {
  const now = input.now ?? Date.now()

  const lastSeen = input.lastSeen ? Date.parse(input.lastSeen) : Number.NaN
  if (Number.isNaN(lastSeen)) return 'unknown'

  if (lastSeen < input.alertsFrom.getTime()) return 'before-start'

  const state = input.state
  if (!state || state.alertedAt === null) return 'alert'

  if (state.releasedAt !== null) return 'alert'

  if (lastSeen <= state.alertedAt.getTime()) return 'no-new-events'
  if (now - state.alertedAt.getTime() < currentCooldownMs(input)) return 'in-cooldown'

  return 'alert'
}
