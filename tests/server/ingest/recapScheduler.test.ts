import { beforeEach, describe, expect, it, vi } from 'vitest'

const listRecapRoutes = vi.fn()
const getRoute = vi.fn()
const stampRecapRun = vi.fn(async () => undefined)
const listRecapQueue = vi.fn()
const clearRecapQueue = vi.fn(async () => 0)
const getWebhookUrl = vi.fn(async () => 'https://hooks.slack.com/services/x')
const recordAlert = vi.fn(async () => undefined)
const recordDelivery = vi.fn(async () => undefined)
const sendToSlack = vi.fn(async () => undefined)
const listOrgTimezones = vi.fn(async () => new Map([['sentry', 'Europe/Helsinki']]))

vi.mock('../../../src/server/db/routes.js', () => ({ listRecapRoutes, stampRecapRun, getRoute }))
vi.mock('../../../src/server/db/recapQueue.js', () => ({ listRecapQueue, clearRecapQueue }))
vi.mock('../../../src/server/db/destinations.js', () => ({ getWebhookUrl }))
vi.mock('../../../src/server/db/seenIssues.js', () => ({ recordAlert }))
vi.mock('../../../src/server/db/deliveries.js', () => ({ recordDelivery }))
vi.mock('../../../src/server/db/orgs.js', () => ({ listOrgTimezones }))
vi.mock('../../../src/server/slack/client.js', () => ({ sendToSlack }))

const { recapOnce, runRecapNow } = await import('../../../src/server/ingest/recapScheduler.js')

const ROUTE = {
  orgSlug: 'sentry',
  projectSlug: 'backend',
  destinationId: 1,
  enabled: true,
  alertsFrom: new Date('2026-01-01T00:00:00Z'),
  cooldownMinutes: null,
  recapPatterns: ['^Timeout'],
  recapTimes: ['09:00'],
  lastRecapAt: new Date('2026-10-07T04:00:00Z'),
}

const QUEUED = [
  {
    issueId: '1',
    issueTitle: 'TimeoutError',
    issueUrl: 'https://sentry/issues/1',
    culprit: null,
    level: 'error',
    shortId: 'BACK-1',
    eventCount: 12,
    matchedPattern: '^Timeout',
    firstQueuedAt: new Date('2026-10-07T05:00:00Z'),
    lastQueuedAt: new Date('2026-10-07T05:30:00Z'),
    occurrences: 3,
  },
]

const JUST_AFTER = new Date('2026-10-07T06:01:00Z')

beforeEach(() => {
  vi.clearAllMocks()
  listRecapRoutes.mockResolvedValue([ROUTE])
  getRoute.mockResolvedValue(ROUTE)
  listRecapQueue.mockResolvedValue(QUEUED)
  getWebhookUrl.mockResolvedValue('https://hooks.slack.com/services/x')
  sendToSlack.mockResolvedValue(undefined)
  listOrgTimezones.mockResolvedValue(new Map([['sentry', 'Europe/Helsinki']]))
})

describe('recapOnce', () => {
  it('sends one grouped message and clears the queue when a time is crossed', async () => {
    expect(await recapOnce(JUST_AFTER)).toBe(1)

    expect(sendToSlack).toHaveBeenCalledTimes(1)
    expect(clearRecapQueue).toHaveBeenCalledWith('sentry', 'backend', ['1'])
    expect(stampRecapRun).toHaveBeenCalledWith('sentry', 'backend', expect.any(Date))
    expect(recordDelivery).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'recap', outcome: 'sent' }),
    )
  })

  it('only claims the cooldown once the recap has actually been delivered', async () => {
    await recapOnce(JUST_AFTER)
    expect(recordAlert).toHaveBeenCalledWith('sentry', 'backend', '1')
  })

  it('does nothing before the configured time', async () => {
    await recapOnce(new Date('2026-10-07T05:00:00Z'))
    expect(sendToSlack).not.toHaveBeenCalled()
    expect(stampRecapRun).not.toHaveBeenCalled()
  })

  it('sends nothing for an empty queue but still advances the cursor', async () => {
    listRecapQueue.mockResolvedValue([])

    expect(await recapOnce(JUST_AFTER)).toBe(0)
    expect(sendToSlack).not.toHaveBeenCalled()
    expect(stampRecapRun).toHaveBeenCalledTimes(1)
  })

  it('leaves the queue intact when Slack rejects the recap', async () => {
    sendToSlack.mockRejectedValue(new Error('channel is gone'))

    expect(await recapOnce(JUST_AFTER)).toBe(0)
    expect(clearRecapQueue).not.toHaveBeenCalled()
    expect(recordAlert).not.toHaveBeenCalled()
    expect(stampRecapRun).toHaveBeenCalledTimes(1)
    expect(recordDelivery).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'recap', outcome: 'failed' }),
    )
  })

  it('reports a destination that has been deleted', async () => {
    getWebhookUrl.mockResolvedValue(null)

    await recapOnce(JUST_AFTER)
    expect(sendToSlack).not.toHaveBeenCalled()
    expect(clearRecapQueue).not.toHaveBeenCalled()
    expect(recordDelivery).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'failed', detail: 'destination no longer exists' }),
    )
  })

  it('reads the recap time in the org’s zone', async () => {
    listOrgTimezones.mockResolvedValue(new Map([['sentry', 'America/New_York']]))

    await recapOnce(JUST_AFTER)
    expect(sendToSlack).not.toHaveBeenCalled()

    await recapOnce(new Date('2026-10-07T13:01:00Z'))
    expect(sendToSlack).toHaveBeenCalledTimes(1)
  })
})

describe('runRecapNow', () => {
  it('sends regardless of the schedule', async () => {
    const result = await runRecapNow('sentry', 'backend')

    expect(result).toEqual({ issues: 1, sent: true })
    expect(sendToSlack).toHaveBeenCalledTimes(1)
  })

  it('works for a project that has patterns but no times yet', async () => {
    getRoute.mockResolvedValue({ ...ROUTE, recapTimes: [] })

    expect(await runRecapNow('sentry', 'backend')).toEqual({ issues: 1, sent: true })
  })

  it('refuses a project that is not routed', async () => {
    getRoute.mockResolvedValue(null)
    await expect(runRecapNow('sentry', 'backend')).rejects.toThrow(/not routed/)
  })
})
