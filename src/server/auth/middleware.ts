import type { NextFunction, Request, Response } from 'express'
import { logger } from '../logger.js'
import { SESSION_COOKIE, verifySession } from './token.js'

/**
 * Answers 401 rather than redirecting: the client is a SPA and turns a 401 into
 * a route change to the login view.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = (req.cookies as Record<string, string | undefined> | undefined)?.[SESSION_COOKIE]
  if (!verifySession(token)) {
    res.status(401).json({ error: 'authentication required' })
    return
  }
  next()
}

/**
 * Failed logins are counted globally, not per IP: `req.ip` comes from
 * X-Forwarded-For behind the ingress, so a caller that controls that header can
 * spread its guesses over as many keys as a per-IP counter would track. Past
 * MAX_FAILURES failures from anywhere, logins are refused outright until the
 * lockdown expires. A success clears the count.
 *
 * The trade is deliberate: five bad requests from a stranger lock the operator
 * out too. With one shared access token and no user accounts there is nothing
 * to scope the lockdown to, and the expiry keeps it from needing a restart.
 *
 * State is in memory and resets on restart, which is fine.
 */
const MAX_FAILURES = 5
const LOCKDOWN_MS = 15 * 60 * 1000

let failures = 0
let lockedUntil = 0

export function loginRateLimit(_req: Request, res: Response, next: NextFunction): void {
  const now = Date.now()

  if (lockedUntil > now) {
    res.status(429).json({
      error: 'too many failed attempts; logins are locked down, try again later',
      retryAfterSeconds: Math.ceil((lockedUntil - now) / 1000),
    })
    return
  }

  next()
}

export function recordLoginFailure(): void {
  const now = Date.now()

  // The expired lockdown that let this attempt through also clears its count.
  if (lockedUntil !== 0 && lockedUntil <= now) {
    failures = 0
    lockedUntil = 0
  }

  failures++
  if (failures < MAX_FAILURES) return

  lockedUntil = now + LOCKDOWN_MS
  logger.error(
    { failures, lockdownMinutes: LOCKDOWN_MS / 60_000 },
    'login lockdown engaged after repeated failed attempts',
  )
}

export function clearLoginFailures(): void {
  failures = 0
  lockedUntil = 0
}

/** Test seam: drops the failure count and lifts an active lockdown. */
export function resetLoginLimiter(): void {
  failures = 0
  lockedUntil = 0
}
