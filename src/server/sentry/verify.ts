import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Sentry signs internal-integration webhooks with
 * HMAC-SHA256(rawBody, clientSecret), hex encoded, in `sentry-hook-signature`.
 * The raw request bytes matter — a re-serialized JSON body will not match.
 */
export function verifySignature(
  rawBody: Buffer,
  signature: string | undefined,
  clientSecret: string,
): boolean {
  if (!signature) return false

  const expected = createHmac('sha256', clientSecret).update(rawBody).digest()

  let given: Buffer
  try {
    given = Buffer.from(signature, 'hex')
  } catch {
    return false
  }

  if (given.length !== expected.length) return false
  return timingSafeEqual(given, expected)
}
