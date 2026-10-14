import { describe, expect, it } from 'vitest'
import { issueUrl, type SentryOrg } from '../../../src/server/sentry/api.js'

function org(baseUrl: string | null): SentryOrg {
  return { slug: 'sentry', authToken: 'token', baseUrl }
}

describe('issueUrl', () => {
  it('rebuilds a relative permalink onto the org base url', () => {
    const url = issueUrl(
      org('https://toska.it.helsinki.fi'),
      '2884',
      '/organizations/sentry/issues/2884/',
    )
    expect(url).toBe('https://toska.it.helsinki.fi/organizations/sentry/issues/2884/')
  })

  it('discards the origin of an absolute permalink pointing elsewhere', () => {
    const url = issueUrl(
      org('https://toska.it.helsinki.fi'),
      '2884',
      'http://sentry-web:9000/organizations/sentry/issues/2884/',
    )
    expect(url).toBe('https://toska.it.helsinki.fi/organizations/sentry/issues/2884/')
  })

  it('keeps the query string of a permalink', () => {
    const url = issueUrl(org('https://sentry.example'), '7', '/issues/7/?environment=prod')
    expect(url).toBe('https://sentry.example/issues/7/?environment=prod')
  })

  it('keeps a path prefix on the base url when using the permalink', () => {
    const url = issueUrl(org('https://host/sentry'), '2884', '/organizations/sentry/issues/2884/')
    expect(url).toBe('https://host/sentry/organizations/sentry/issues/2884/')
  })

  it('keeps a path prefix on the base url when building the fallback', () => {
    const url = issueUrl(org('https://host/sentry'), '2884', null)
    expect(url).toBe('https://host/sentry/organizations/sentry/issues/2884/')
  })

  it('builds the fallback from the configured base url when the org has none', () => {
    expect(issueUrl(org(null), '2884', null)).toMatch(/^https?:\/\/.+\/issues\/2884\/$/)
  })

  it('treats a blank org base url as unset instead of throwing', () => {
    expect(issueUrl(org('   '), '2884', null)).toMatch(/^https?:\/\/.+\/issues\/2884\/$/)
  })

  it('falls back to the constructed path when the permalink cannot be parsed', () => {
    const url = issueUrl(org('https://sentry.example'), '2884', 'http://[')
    expect(url).toBe('https://sentry.example/organizations/sentry/issues/2884/')
  })
})
