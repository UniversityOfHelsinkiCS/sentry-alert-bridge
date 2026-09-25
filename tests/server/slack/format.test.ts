import { describe, expect, it } from 'vitest'
import type { NormalizedIssue } from '../../../src/shared/types.js'
import { formatIssue, markResolved } from '../../../src/server/slack/format.js'

interface Block {
  type?: string
  elements?: { action_id?: string; value?: string }[]
}

const issue: NormalizedIssue = {
  id: '42',
  title: 'TypeError: cannot read property of undefined',
  culprit: 'app/routes/index.ts',
  level: 'error',
  shortId: 'BACKEND-7',
  url: 'https://toska.it.helsinki.fi/organizations/sentry/issues/42/',
  count: 12,
  projectSlug: 'backend',
  projectName: 'Backend',
  environment: 'production',
}

describe('formatIssue', () => {
  it('links the title and picks an emoji for the level', () => {
    const message = formatIssue(issue)
    expect(message.text).toContain('🔴')
    expect(JSON.stringify(message.blocks)).toContain(`<${issue.url}|${issue.title}>`)
  })

  it('has a plain-text fallback naming the project', () => {
    expect(formatIssue(issue).text).toContain('backend')
  })

  it('escapes Slack mrkdwn control characters in the title', () => {
    const message = formatIssue({ ...issue, title: '<script> & "x"' })
    expect(JSON.stringify(message.blocks)).toContain('&lt;script&gt; &amp; ')
  })

  it('omits fields that are missing rather than rendering empties', () => {
    const message = formatIssue({
      id: '1',
      title: 'bare',
      projectSlug: 'p',
      culprit: null,
      level: null,
      shortId: null,
      url: null,
      count: null,
      projectName: null,
      environment: null,
    })
    const json = JSON.stringify(message.blocks)
    expect(json).not.toContain('Short ID')
    expect(json).not.toContain('Environment')
    expect(json).toContain('Project')
  })

  it('renders an unlinked title when there is no permalink', () => {
    const json = JSON.stringify(formatIssue({ ...issue, url: null }).blocks)
    expect(json).toContain(issue.title)
    expect(json).not.toContain('|')
  })

  it('adds a Resolve button carrying the project and issue when asked', () => {
    const blocks = formatIssue(issue, { resolvable: true }).blocks as Block[]
    const actions = blocks.find((b) => b.type === 'actions')
    expect(actions).toBeDefined()

    const button = actions?.elements?.[0]
    expect(button?.action_id).toBe('resolve_issue')
    expect(JSON.parse(button?.value ?? '{}')).toEqual({
      v: 1,
      projectSlug: 'backend',
      issueId: '42',
    })
  })

  // The test alert on the destinations page goes through the default, and its
  // synthetic issue id would fail at Sentry if it ever grew a button.
  it('has no Resolve button by default', () => {
    const blocks = formatIssue(issue).blocks as Block[]
    expect(blocks.find((b) => b.type === 'actions')).toBeUndefined()
  })
})

describe('markResolved', () => {
  it('drops the button and credits the user', () => {
    const blocks = formatIssue(issue, { resolvable: true }).blocks
    const updated = markResolved(blocks, 'U123') as Block[]

    expect(updated.find((b) => b.type === 'actions')).toBeUndefined()
    expect(JSON.stringify(updated)).toContain('<@U123>')
  })

  it('keeps the rest of the original message intact', () => {
    const blocks = formatIssue(issue, { resolvable: true }).blocks
    const updated = markResolved(blocks, 'U123')
    expect(JSON.stringify(updated)).toContain(issue.title)
  })
})
