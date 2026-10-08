import { beforeEach, describe, expect, it, vi } from 'vitest'

const findOne = vi.fn()
const count = vi.fn()
const create = vi.fn(async () => undefined)

vi.mock('../../../src/server/db/model/index.js', () => ({
  RecapQueueItem: { findOne, count, create },
}))

const { queueRecapIssue, MAX_RECAP_QUEUE_PER_PROJECT } = await import(
  '../../../src/server/db/recapQueue.js'
)

const ITEM = {
  orgSlug: 'sentry',
  projectSlug: 'backend',
  issueId: '1',
  issueTitle: 'TimeoutError',
  issueUrl: 'https://sentry/issues/1',
  culprit: null,
  level: 'error',
  shortId: 'BACK-1',
  eventCount: 12,
  matchedPattern: '^Timeout',
}

beforeEach(() => {
  vi.clearAllMocks()
  findOne.mockResolvedValue(null)
  count.mockResolvedValue(0)
})

describe('queueRecapIssue', () => {
  it('fetches the stack frame for an issue it has not queued before', async () => {
    const fetchFrame = vi.fn(async () => 'http.ts:42 in fetchRetry')

    expect(await queueRecapIssue(ITEM, fetchFrame)).toBe(true)
    expect(fetchFrame).toHaveBeenCalledTimes(1)
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ frame: 'http.ts:42 in fetchRetry', occurrences: 1 }),
    )
  })

  it('does not fetch the frame again when the same issue re-queues', async () => {
    const update = vi.fn(async () => undefined)
    findOne.mockResolvedValue({ occurrences: 3, update })
    const fetchFrame = vi.fn(async () => 'never read')

    expect(await queueRecapIssue(ITEM, fetchFrame)).toBe(true)
    expect(fetchFrame).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ occurrences: 4 }))
  })

  it('still queues the issue when the frame cannot be read', async () => {
    expect(await queueRecapIssue(ITEM, async () => null)).toBe(true)
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ frame: null }))
  })

  it('does not fetch a frame for an issue it is going to drop', async () => {
    count.mockResolvedValue(MAX_RECAP_QUEUE_PER_PROJECT)
    const fetchFrame = vi.fn(async () => 'wasted call')

    expect(await queueRecapIssue(ITEM, fetchFrame)).toBe(false)
    expect(fetchFrame).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
  })
})
