import { describe, expect, it } from 'vitest'
import { parseInteraction } from '../../../src/server/slack/interactions.js'

function payload(value: unknown, overrides: Record<string, unknown> = {}) {
  return {
    type: 'block_actions',
    user: { id: 'U123' },
    response_url: 'https://hooks.slack.com/actions/T1/B2/abc',
    message: { blocks: [{ type: 'section' }] },
    actions: [
      {
        action_id: 'resolve_issue',
        value: typeof value === 'string' ? value : JSON.stringify(value),
      },
    ],
    ...overrides,
  }
}

const good = { v: 1, projectSlug: 'backend', issueId: '42' }

describe('parseInteraction', () => {
  it('pulls the project, issue, user and response url out of a click', () => {
    expect(parseInteraction(payload(good))).toEqual({
      projectSlug: 'backend',
      issueId: '42',
      userId: 'U123',
      responseUrl: 'https://hooks.slack.com/actions/T1/B2/abc',
      blocks: [{ type: 'section' }],
    })
  })

  it('ignores interaction types that are not block actions', () => {
    expect(parseInteraction(payload(good, { type: 'view_submission' }))).toBeNull()
  })

  it('ignores clicks on some other button', () => {
    const other = payload(good, {
      actions: [{ action_id: 'mute_issue', value: JSON.stringify(good) }],
    })
    expect(parseInteraction(other)).toBeNull()
  })

  it('rejects a project slug that could climb out of the api path', () => {
    expect(parseInteraction(payload({ ...good, projectSlug: '../../foo' }))).toBeNull()
  })

  it('rejects a non-numeric issue id', () => {
    expect(parseInteraction(payload({ ...good, issueId: '42/../1' }))).toBeNull()
  })

  it('rejects an unknown value version', () => {
    expect(parseInteraction(payload({ ...good, v: 2 }))).toBeNull()
  })

  it('rejects a response url that is not slack', () => {
    const evil = payload(good, { response_url: 'https://evil.invalid/hook' })
    expect(parseInteraction(evil)).toBeNull()
  })

  it('returns null rather than throwing on a malformed value', () => {
    expect(parseInteraction(payload('not json at all'))).toBeNull()
  })

  it('returns null rather than throwing on junk', () => {
    expect(parseInteraction(undefined)).toBeNull()
    expect(parseInteraction({})).toBeNull()
    expect(parseInteraction('nope')).toBeNull()
  })
})
