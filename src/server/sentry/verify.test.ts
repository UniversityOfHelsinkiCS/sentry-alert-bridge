import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { verifySignature } from './verify.js'

const SECRET = 'a-client-secret'
const body = Buffer.from(JSON.stringify({ action: 'created' }))
const sign = (buf: Buffer, secret = SECRET) =>
  createHmac('sha256', secret).update(buf).digest('hex')

describe('verifySignature', () => {
  it('accepts a signature made with the client secret', () => {
    expect(verifySignature(body, sign(body), SECRET)).toBe(true)
  })

  it('rejects a signature made with a different secret', () => {
    expect(verifySignature(body, sign(body, 'wrong'), SECRET)).toBe(false)
  })

  it('rejects a signature over different bytes', () => {
    expect(verifySignature(Buffer.from('{}'), sign(body), SECRET)).toBe(false)
  })

  it('rejects a missing or malformed signature', () => {
    expect(verifySignature(body, undefined, SECRET)).toBe(false)
    expect(verifySignature(body, 'not-hex', SECRET)).toBe(false)
    expect(verifySignature(body, '', SECRET)).toBe(false)
  })
})
