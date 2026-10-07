import { describe, expect, it } from 'vitest'

import { compilePatterns, matchRecap, recapDueAt } from '../../../src/server/ingest/recap.js'

const HELSINKI = 'Europe/Helsinki'

describe('matchRecap', () => {
  it('matches on the title', () => {
    const patterns = compilePatterns(['^Timeout'])
    expect(matchRecap({ title: 'TimeoutError: upstream gone' }, patterns)).toBe('^Timeout')
  })

  it('matches on the culprit when the title does not', () => {
    const patterns = compilePatterns(['api/sync'])
    expect(matchRecap({ title: 'Something else', culprit: 'app/api/sync' }, patterns)).toBe(
      'api/sync',
    )
  })

  it('is case insensitive and unanchored', () => {
    const patterns = compilePatterns(['timeout'])
    expect(matchRecap({ title: 'Upstream TIMEOUT reached' }, patterns)).toBe('timeout')
  })

  it('returns null when nothing matches', () => {
    expect(matchRecap({ title: 'NullPointer' }, compilePatterns(['^Timeout']))).toBeNull()
  })

  it('skips patterns that do not compile rather than throwing', () => {
    const patterns = compilePatterns(['([unclosed', 'Timeout'])
    expect(patterns).toHaveLength(1)
    expect(matchRecap({ title: 'Timeout' }, patterns)).toBe('Timeout')
  })

  it('treats a missing pattern list as no rules', () => {
    expect(compilePatterns(undefined)).toEqual([])
  })
})

describe('recapDueAt', () => {
  const due = (times: string[], lastRecapAt: Date | null, now: string, timeZone = HELSINKI) =>
    recapDueAt({ times, timeZone, lastRecapAt, now: new Date(now) })

  it('is not due before the configured time', () => {
    expect(due(['09:00'], new Date('2026-10-07T04:00:00Z'), '2026-10-07T05:30:00Z')).toBeNull()
  })

  it('fires once the local time has been crossed', () => {
    const at = due(['09:00'], new Date('2026-10-07T04:00:00Z'), '2026-10-07T06:01:00Z')
    expect(at?.toISOString()).toBe('2026-10-07T06:00:00.000Z')
  })

  it('does not fire twice for the same occurrence', () => {
    const at = new Date('2026-10-07T06:00:00Z')
    expect(due(['09:00'], at, '2026-10-07T07:00:00Z')).toBeNull()
  })

  it('fires once after downtime spanning several configured times', () => {
    const at = due(
      ['09:00', '12:00'],
      new Date('2026-10-07T05:00:00Z'),
      '2026-10-07T10:30:00Z',
    )
    expect(at?.toISOString()).toBe('2026-10-07T09:00:00.000Z')
  })

  it('does not backfill earlier in the day for a freshly configured route', () => {
    expect(due(['09:00'], null, '2026-10-07T15:00:00Z')).toBeNull()
  })

  it('fires for a route configured moments before its time', () => {
    const at = due(['09:00'], null, '2026-10-07T06:00:30Z')
    expect(at?.toISOString()).toBe('2026-10-07T06:00:00.000Z')
  })

  it('reads the time in the given zone, not the server one', () => {
    const at = due(['09:00'], new Date('2026-10-07T12:00:00Z'), '2026-10-07T14:00:00Z', 'America/New_York')
    expect(at?.toISOString()).toBe('2026-10-07T13:00:00.000Z')
  })

  it('fires once across an autumn repeated hour', () => {
    const first = due(['03:30'], new Date('2026-10-25T00:00:00Z'), '2026-10-25T02:00:00Z')
    expect(first).not.toBeNull()
    expect(due(['03:30'], first, '2026-10-25T05:00:00Z')).toBeNull()
  })

  it('still fires for a time inside a spring-forward gap', () => {
    const at = due(['03:30'], new Date('2026-03-29T00:00:00Z'), '2026-03-29T06:00:00Z')
    expect(at).not.toBeNull()
  })

  it('is never due with no times configured', () => {
    expect(due([], null, '2026-10-07T06:01:00Z')).toBeNull()
  })

  it('ignores malformed times', () => {
    expect(due(['25:99'], new Date('2026-10-07T00:00:00Z'), '2026-10-07T23:00:00Z')).toBeNull()
  })
})
