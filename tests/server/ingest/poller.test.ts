import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiIssue } from '../../../src/server/sentry/types.js'

const handleIssue = vi.fn(async () => 'sent' as const)
const listNewIssues = vi.fn<(slug: string, limit?: number) => Promise<ApiIssue[]>>()
const listOrgProjects = vi.fn(async () => [{ slug: 'backend', name: 'Backend' }])

vi.mock('../../../src/server/ingest/index.js', () => ({ handleIssue }))
vi.mock('../../../src/server/sentry/api.js', async () => {
  const actual = await vi.importActual<typeof import('../../../src/server/sentry/api.js')>('../../../src/server/sentry/api.js')
  return { ...actual, listNewIssues, listOrgProjects }
})
vi.mock('../../../src/server/db/projects.js', () => ({ upsertProject: vi.fn(async () => undefined) }))
vi.mock('../../../src/server/db/deliveries.js', () => ({ recordDelivery: vi.fn(async () => undefined) }))
vi.mock('../../../src/server/db/settings.js', () => ({ touchLastPoll: vi.fn(async () => undefined) }))
vi.mock('../../../src/server/db/routes.js', () => ({
  listEnabledRoutes: vi.fn(async () => [
    { projectSlug: 'backend', destinationId: 1, enabled: true },
  ]),
}))

const { pollOnce } = await import('../../../src/server/ingest/poller.js')

function issue(id: string, ageMinutes: number): ApiIssue {
  return {
    id,
    title: `issue ${id}`,
    firstSeen: new Date(Date.now() - ageMinutes * 60_000).toISOString(),
  } as ApiIssue
}

describe('pollOnce', () => {
  beforeEach(() => {
    handleIssue.mockClear()
    listNewIssues.mockReset()
  })

  it('alerts on an issue first seen inside the window', async () => {
    listNewIssues.mockResolvedValue([issue('1', 1)])

    const summary = await pollOnce()

    expect(handleIssue).toHaveBeenCalledTimes(1)
    expect(handleIssue).toHaveBeenCalledWith(
      expect.objectContaining({ id: '1', projectSlug: 'backend' }),
      'polling',
    )
    expect(summary.sent).toBe(1)
  })

  it('ignores an issue older than two intervals, so enabling polling does not flood', async () => {
    // POLL_INTERVAL_MINUTES is 5 in tests, so the window is 10 minutes.
    listNewIssues.mockResolvedValue([issue('old', 60), issue('fresh', 3)])

    await pollOnce()

    expect(handleIssue).toHaveBeenCalledTimes(1)
    expect(handleIssue).toHaveBeenCalledWith(expect.objectContaining({ id: 'fresh' }), 'polling')
  })

  it('ignores an issue with no firstSeen rather than guessing', async () => {
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
