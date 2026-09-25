import { createHash, timingSafeEqual } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { config } from '../config.js'

export const SESSION_COOKIE = 'session'

/**
 * Constant-time compare over SHA-256 digests, so differing lengths neither
 * throw nor leak through timing.
 */
export function isValidAccessToken(given: string): boolean {
  const a = createHash('sha256').update(given).digest()
  const b = createHash('sha256').update(config.ACCESS_TOKEN).digest()
  return timingSafeEqual(a, b)
}

export function signSession(): string {
  return jwt.sign({ sub: 'internal' }, config.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: `${config.SESSION_TTL_HOURS}h`,
  })
}

export function verifySession(token: string | undefined): boolean {
  if (!token) return false
  try {
    jwt.verify(token, config.JWT_SECRET, { algorithms: ['HS256'] })
    return true
  } catch {
    return false
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: config.isProduction,
    path: '/',
    maxAge: config.SESSION_TTL_HOURS * 60 * 60 * 1000,
  }
}
