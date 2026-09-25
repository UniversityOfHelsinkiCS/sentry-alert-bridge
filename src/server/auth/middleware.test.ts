import type { NextFunction, Request, Response } from 'express'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearLoginFailures,
  loginRateLimit,
  recordLoginFailure,
  resetLoginLimiter,
} from './middleware.js'

const LOCKDOWN_MS = 15 * 60 * 1000

/** Enough of a Response to see which of the two branches the limiter took. */
function fakeRes() {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      res.statusCode = code
      return res
    },
    json(payload: unknown) {
      res.body = payload
      return res
    },
  }
  return res
}

function attempt(): { allowed: boolean; res: ReturnType<typeof fakeRes> } {
  const res = fakeRes()
  let allowed = false
  const next: NextFunction = () => {
    allowed = true
  }
  loginRateLimit({} as Request, res as unknown as Response, next)
  return { allowed, res }
}

beforeEach(() => {
  resetLoginLimiter()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  resetLoginLimiter()
})

describe('login lockdown', () => {
  it('allows attempts up to the fifth failure', () => {
    for (let i = 0; i < 4; i++) {
      expect(attempt().allowed).toBe(true)
      recordLoginFailure()
    }
    expect(attempt().allowed).toBe(true)
  })

  it('locks down after five failures, whatever the source', () => {
    for (let i = 0; i < 5; i++) recordLoginFailure()

    const { allowed, res } = attempt()
    expect(allowed).toBe(false)
    expect(res.statusCode).toBe(429)
    expect(res.body).toMatchObject({ retryAfterSeconds: LOCKDOWN_MS / 1000 })
  })

  it('lifts the lockdown once it expires', () => {
    for (let i = 0; i < 5; i++) recordLoginFailure()
    expect(attempt().allowed).toBe(false)

    vi.advanceTimersByTime(LOCKDOWN_MS + 1)
    expect(attempt().allowed).toBe(true)
  })

  it('starts a fresh count after an expired lockdown', () => {
    for (let i = 0; i < 5; i++) recordLoginFailure()
    vi.advanceTimersByTime(LOCKDOWN_MS + 1)

    // The first failure after the expiry must not re-trigger the lockdown.
    recordLoginFailure()
    expect(attempt().allowed).toBe(true)

    for (let i = 0; i < 4; i++) recordLoginFailure()
    expect(attempt().allowed).toBe(false)
  })

  it('clears the count on a successful login', () => {
    for (let i = 0; i < 4; i++) recordLoginFailure()
    clearLoginFailures()

    for (let i = 0; i < 4; i++) recordLoginFailure()
    expect(attempt().allowed).toBe(true)
  })
})
