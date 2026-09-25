import { Router } from 'express'
import { z } from 'zod'
import type { MeDto } from '../../shared/types.js'
import {
  clearLoginFailures,
  loginRateLimit,
  recordLoginFailure,
  requireAuth,
} from '../auth/middleware.js'
import {
  isValidAccessToken,
  SESSION_COOKIE,
  sessionCookieOptions,
  signSession,
} from '../auth/token.js'
import { config } from '../config.js'
import { logger } from '../logger.js'

const loginSchema = z.object({ token: z.string().min(1) })

// A fixed pause on failure, so a wrong token is never noticeably faster or
// slower than a right one.
const FAILURE_DELAY_MS = 400

export const authRouter: Router = Router()

authRouter.post('/login', loginRateLimit, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success || !isValidAccessToken(parsed.data.token)) {
    recordLoginFailure()
    logger.warn({ ip: req.ip }, 'failed login attempt')
    await new Promise((resolve) => setTimeout(resolve, FAILURE_DELAY_MS))
    res.status(401).json({ error: 'invalid access token' })
    return
  }

  clearLoginFailures()
  res.cookie(SESSION_COOKIE, signSession(), sessionCookieOptions())
  res.json({ ok: true })
})

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(SESSION_COOKIE, { ...sessionCookieOptions(), maxAge: undefined })
  res.json({ ok: true })
})

authRouter.get('/me', requireAuth, (_req, res) => {
  const me: MeDto = {
    authenticated: true,
    releaseVersion: config.RELEASE_VERSION ?? null,
    gitSha: config.GIT_SHA ?? config.IMAGE_SHA ?? null,
    staging: config.STAGING,
  }
  res.json(me)
})
