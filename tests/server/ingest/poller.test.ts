import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiIssue } from '../../../src/server/sentry/types.js'

const handleIssue = vi.fn(async () => 'sent' as const)
const listNewIssues = vi.fn<(slug: string, limit?: number) => Promise<ApiIssue[]>>()
const listOrgProjects = vi.fn(async () => [{ slug: 'backend', name: 'Backend' }])
const listClaimStates = vi.fn(async () => new Map<string, { alertedAt: Date | null; releasedAt: Date | null }>())

vi.mock('../../../src/server/ingest/index.js', () => ({ handleIssue }))
vi.mock('../../../src/server/sentry/api.js', async () => {
  const actual = await vi.importActual<typeof import('../../../src/server/sentry/api.js')>('../../../src/server/sentry/api.js')
  return { ...actual, listNewIssues, listOrgProjects }
})
vi.mock('../../../src/server/db/projects.js', () => ({ upsertProject: vi.fn(async () => undefined) }))
vi.mock('../../../src/server/db/deliveries.js', () => ({ recordDelivery: vi.fn(async () => undefined) }))
vi.mock('../../../src/server/db/settings.js', () => ({ touchLastPoll: vi.fn(async () => undefined) }))
vi.mock('../../../src/server/db/seenIssues.js', () => ({ listClaimStates }))
const ROUTED_AT = new Date(Date.now() - 24 * 60 * 60_000)
vi.mock('../../../src/server/db/routes.js', () => ({
  listEnabledRoutes: vi.fn(async () => [
    { projectSlug: 'backend', destinationId: 1, enabled: true, alertsFrom: ROUTED_AT },
  ]),
}))

const { pollOnce } = await import('../../../src/server/ingest/poller.js')

/** `ageMinutes` is how long ago the issue was LAST seen. */
function issue(id: string, ageMinutes: number, firstSeenDaysAgo = 0): ApiIssue {
  return {
    id,
    title: `issue ${id}`,
    firstSeen: new Date(Date.now() - firstSeenDaysAgo * 24 * 60 * 60_000).toISOString(),
    lastSeen: new Date(Date.now() - ageMinutes * 60_000).toISOString(),
  } as ApiIssue
}

describe('pollOnce', () => {
  beforeEach(() => {
    handleIssue.mockClear()
    listNewIssues.mockReset()
    listClaimStates.mockClear()
    listClaimStates.mockResolvedValue(new Map())
  })

  it('alerts on an issue it has never alerted on', async () => {
    listNewIssues.mockResolvedValue([issue('1', 1)])

    const summary = await pollOnce()

    expect(handleIssue).toHaveBeenCalledTimes(1)
    expect(handleIssue).toHaveBeenCalledWith(
      expect.objectContaining({ id: '1', projectSlug: 'backend' }),
      'polling',
    )
    expect(summary.sent).toBe(1)
  })

  // The behaviour this whole model exists for: an issue Sentry has held for a
  // month is still news when it happens again.
  it('alerts on a month-old issue that was just seen again', async () => {
    listNewIssues.mockResolvedValue([issue('ancient', 1, 30)])
    listClaimStates.mockResolvedValue(
      new Map([['ancient', { alertedAt: new Date(Date.now() - 5 * 60 * 60_000), releasedAt: null }]]),
    )

    await pollOnce()

    expect(handleIssue).toHaveBeenCalledWith(expect.objectContaining({ id: 'ancient' }), 'polling')
  })

  it('stays quiet when nothing has happened since the last alert', async () => {
    listNewIssues.mockResolvedValue([issue('quiet', 6 * 60)])
    listClaimStates.mockResolvedValue(
      new Map([['quiet', { alertedAt: new Date(Date.now() - 60 * 60_000), releasedAt: null }]]),
    )

    const summary = await pollOnce()

    expect(handleIssue).not.toHaveBeenCalled()
    expect(summary.skipped).toBe(1)
  })

  it('holds a re-alert inside the cooldown', async () => {
    // ALERT_COOLDOWN_MINUTES is 60 by default.
    listNewIssues.mockResolvedValue([issue('noisy', 1)])
    listClaimStates.mockResolvedValue(
      new Map([['noisy', { alertedAt: new Date(Date.now() - 10 * 60_000), releasedAt: null }]]),
    )

    const summary = await pollOnce()

    expect(handleIssue).not.toHaveBeenCalled()
    expect(summary.skipped).toBe(1)
  })

  it('lets a regression skip the cooldown', async () => {
    listNewIssues.mockResolvedValue([issue('regressed', 1)])
    listClaimStates.mockResolvedValue(
      new Map([
        [
          'regressed',
          {
            alertedAt: new Date(Date.now() - 10 * 60_000),
            releasedAt: new Date(Date.now() - 5 * 60_000),
          },
        ],
      ]),
    )

    await pollOnce()

    expect(handleIssue).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'regressed' }),
      'polling',
    )
  })

  it('ignores everything from before the route start time, so routing does not flood', async () => {
    // ROUTED_AT is 24h ago; this issue last fired two days back.
    listNewIssues.mockResolvedValue([issue('history', 48 * 60, 30)])

    const summary = await pollOnce()

    expect(handleIssue).not.toHaveBeenCalled()
    expect(summary.skipped).toBe(1)
  })

  it('ignores an issue with no lastSeen rather than guessing', async () => {
    listNewIssues.mockResolvedValue([{ id: 'x', title: 'no date' } as ApiIssue])

    await pollOnce()

    expect(handleIssue).not.toHaveBeenCalled()
  })

  it('records a failure and keeps going when the Sentry API errors', async () => {
    listNewIssues.mockRejectedValue(new Error('boom'))

    const summary = await pollOnce()

    expect(summary.failed).toBe(1)
    expect(handleIssue).not.toHaveBeenCalled()
  })
})
