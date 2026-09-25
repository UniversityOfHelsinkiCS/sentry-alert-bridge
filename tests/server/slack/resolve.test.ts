import { beforeEach, describe, expect, it, vi } from 'vitest'

const resolveIssue = vi.hoisted(() => vi.fn())
const releaseIssue = vi.hoisted(() => vi.fn())
const recordDelivery = vi.hoisted(() => vi.fn())

vi.mock('../../../src/server/sentry/api.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/server/sentry/api.js')>()
  return { ...actual, resolveIssue }
})
vi.mock('../../../src/server/db/seenIssues.js', () => ({ releaseIssue, claimIssue: vi.fn() }))
vi.mock('../../../src/server/db/deliveries.js', () => ({ recordDelivery }))

const { SentryApiError } = await import('../../../src/server/sentry/api.js')
const { handleResolveClick } = await import('../../../src/server/slack/resolve.js')

const click = {
  projectSlug: 'backend',
  issueId: '42',
  userId: 'U123',
  responseUrl: 'https://hooks.slack.com/actions/T1/B2/abc',
  blocks: [{ type: 'section' }, { type: 'actions', elements: [] }],
}

function lastPostBody(fetchMock: ReturnType<typeof vi.fn>) {
  const call = fetchMock.mock.calls.at(-1)
  return JSON.parse((call?.[1] as { body: string }).body)
}

describe('handleResolveClick', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => '' })
    vi.stubGlobal('fetch', fetchMock)
  })

  it('resolves in Sentry, then releases the dedup claim', async () => {
    await handleResolveClick(click)

    expect(resolveIssue).toHaveBeenCalledWith('42')
    expect(releaseIssue).toHaveBeenCalledWith('backend', '42')
  })

  it('replaces the message and drops the button', async () => {
    await handleResolveClick(click)

    const body = lastPostBody(fetchMock)
    expect(body.replace_original).toBe(true)
    expect(JSON.stringify(body.blocks)).toContain('<@U123>')
    expect(body.blocks.some((b: { type?: string }) => b.type === 'actions')).toBe(false)
  })

  it('records the resolve for the deliveries log', async () => {
    await handleResolveClick(click)
    expect(recordDelivery).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'resolve', projectSlug: 'backend', outcome: 'sent' }),
    )
  })

  it('keeps the claim when Sentry refuses, so nothing re-alerts spuriously', async () => {
    resolveIssue.mockRejectedValueOnce(new SentryApiError('forbidden', 403))

    await handleResolveClick(click)

    expect(releaseIssue).not.toHaveBeenCalled()
  })

  it('leaves the button in place and explains a missing scope', async () => {
    resolveIssue.mockRejectedValueOnce(new SentryApiError('forbidden', 403))

    await handleResolveClick(click)

    const body = lastPostBody(fetchMock)
    expect(body.replace_original).toBe(false)
    expect(body.response_type).toBe('ephemeral')
    expect(body.text).toContain('event:write')
  })

  it('names rate limiting when that is the reason', async () => {
    resolveIssue.mockRejectedValueOnce(new SentryApiError('slow down', 429))

    await handleResolveClick(click)

    expect(lastPostBody(fetchMock).text).toContain('rate limiting')
  })

  it('records a failed delivery when the resolve does not go through', async () => {
    resolveIssue.mockRejectedValueOnce(new SentryApiError('nope', 404))

    await handleResolveClick(click)

    expect(recordDelivery).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'resolve', outcome: 'failed' }),
    )
  })
})
