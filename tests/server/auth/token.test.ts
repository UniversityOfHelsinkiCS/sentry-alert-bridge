import jwt from 'jsonwebtoken'
import { describe, expect, it } from 'vitest'
import { config } from '../../../src/server/config.js'
import { isValidAccessToken, signSession, verifySession } from '../../../src/server/auth/token.js'

describe('access token', () => {
  it('accepts the configured token', () => {
    expect(isValidAccessToken(config.ACCESS_TOKEN)).toBe(true)
  })

  it('rejects a wrong token, including one of a different length', () => {
    expect(isValidAccessToken('nope')).toBe(false)
    expect(isValidAccessToken(`${config.ACCESS_TOKEN}x`)).toBe(false)
    expect(isValidAccessToken('')).toBe(false)
  })
})

describe('session jwt', () => {
  it('verifies a token it just signed', () => {
    expect(verifySession(signSession())).toBe(true)
  })

  it('rejects a missing, garbage or foreign-signed token', () => {
    expect(verifySession(undefined)).toBe(false)
    expect(verifySession('garbage')).toBe(false)
    expect(verifySession(jwt.sign({ sub: 'x' }, 'another-secret'))).toBe(false)
  })

  it('rejects an expired token', () => {
    const expired = jwt.sign({ sub: 'internal' }, config.JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: '-1s',
    })
    expect(verifySession(expired)).toBe(false)
  })

  it('rejects the "none" algorithm', () => {
    const unsigned = jwt.sign({ sub: 'internal' }, '', { algorithm: 'none' })
    expect(verifySession(unsigned)).toBe(false)
  })
})
