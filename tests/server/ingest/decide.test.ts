import { describe, expect, it } from 'vitest'
import { decideAlert } from '../../../src/server/ingest/decide.js'

const NOW = Date.parse('2026-09-25T12:00:00Z')
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString()
const HOUR = 60 * 60_000

// Routed long ago, so alerts_from is not what is being tested unless it is.
const alertsFrom = new Date(NOW - 30 * 24 * HOUR)

const decide = (input: Parameters<typeof decideAlert>[0]) =>
  decideAlert({ now: NOW, cooldownMs: HOUR, alertsFrom, ...input })

describe('decideAlert', () => {
  it('alerts on an issue this app has never alerted on', () => {
    expect(decide({ lastSeen: iso(60_000), alertsFrom, state: undefined })).toBe('alert')
  })

  // The whole point of the change: an old issue that fires again is news.
  it('alerts on an old issue that has just been seen again', () => {
    expect(
      decide({
        lastSeen: iso(30_000),
        alertsFrom,
        state: { alertedAt: new Date(NOW - 5 * HOUR), releasedAt: null },
      }),
    ).toBe('alert')
  })

  it('stays quiet when nothing has happened since the last alert', () => {
    expect(
      decide({
        lastSeen: iso(6 * HOUR),
        alertsFrom,
        state: { alertedAt: new Date(NOW - 5 * HOUR), releasedAt: null },
      }),
    ).toBe('no-new-events')
  })

  it('holds a re-alert inside the cooldown', () => {
    expect(
      decide({
        lastSeen: iso(60_000),
        alertsFrom,
        state: { alertedAt: new Date(NOW - 10 * 60_000), releasedAt: null },
      }),
    ).toBe('in-cooldown')
  })

  it('lets a regression through the cooldown, since someone resolved it on purpose', () => {
    expect(
      decide({
        lastSeen: iso(60_000),
        alertsFrom,
        state: { alertedAt: new Date(NOW - 10 * 60_000), releasedAt: new Date(NOW - 20 * 60_000) },
      }),
    ).toBe('alert')
  })

  // Routing a project must not replay everything Sentry still holds.
  it('treats everything before the route start time as history', () => {
    const justRouted = new Date(NOW - 60_000)
    expect(decide({ lastSeen: iso(2 * HOUR), alertsFrom: justRouted })).toBe('before-start')
  })

  it('still alerts on an event after the route start time', () => {
    const justRouted = new Date(NOW - 5 * 60_000)
    expect(decide({ lastSeen: iso(60_000), alertsFrom: justRouted })).toBe('alert')
  })

  it('says so when Sentry gives no usable lastSeen', () => {
    expect(decide({ lastSeen: null, alertsFrom })).toBe('unknown')
    expect(decide({ lastSeen: 'not a date', alertsFrom })).toBe('unknown')
  })

  it('alerts every time when the cooldown is off', () => {
    expect(
      decideAlert({
        now: NOW,
        cooldownMs: 0,
        lastSeen: iso(60_000),
        alertsFrom,
        state: { alertedAt: new Date(NOW - 2 * 60_000), releasedAt: null },
      }),
    ).toBe('alert')
  })
})
