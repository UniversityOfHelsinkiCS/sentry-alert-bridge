import { describe, expect, it } from 'vitest'
import type { NormalizedIssue } from '../../../src/shared/types.js'
import {
  chunkRecapIssues,
  formatIssue,
  formatRecap,
  markResolved,
  type RecapIssue,
} from '../../../src/server/slack/format.js'

interface Block {
  type?: string
  elements?: { action_id?: string; value?: string }[]
}

const issue: NormalizedIssue = {
  id: '42',
  orgSlug: 'sentry',
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
      v: 2,
      orgSlug: 'sentry',
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

describe('formatIssue stack frame', () => {
  const frame = '/opt/app-root/src/src/server/updater/util.ts:27:20 in safeBulkCreate'

  it('shows the frame alongside the culprit', () => {
    const json = JSON.stringify(formatIssue({ ...issue, frame }).blocks)
    expect(json).toContain('/opt/app-root/src/src/server/updater/util.ts:27:20')
    expect(json).toContain('safeBulkCreate')
    expect(json).toContain(issue.culprit as string)
  })

  it('adds no frame block when the stack trace was unavailable', () => {
    const before = formatIssue(issue).blocks.length
    expect(formatIssue({ ...issue, frame: null }).blocks).toHaveLength(before)
  })

  it('truncates a long path from the left so the filename stays visible', () => {
    const long = `/${'deep/'.repeat(40)}util.ts:27:20 in safeBulkCreate`
    const json = JSON.stringify(formatIssue({ ...issue, frame: long }).blocks)
    expect(json).toContain('…')
    expect(json).toContain('util.ts:27:20')
    expect(json).toContain('safeBulkCreate')
    expect(json).not.toContain('/deep/deep/deep/deep/deep/deep/deep/deep/deep/deep/deep/deep/deep/deep/deep/deep/deep/deep/deep/deep/deep/deep/deep/deep')
  })

  it('escapes a frame that looks like markup', () => {
    const json = JSON.stringify(formatIssue({ ...issue, frame: '<anonymous>:1:1' }).blocks)
    expect(json).toContain('&lt;anonymous&gt;')
  })
})

describe('formatRecap', () => {
  const entry = (n: number, overrides: Partial<RecapIssue> = {}): RecapIssue => ({
    issueTitle: `issue ${n}`,
    issueUrl: `https://sentry/issues/${n}`,
    culprit: null,
    level: 'error',
    shortId: null,
    frame: null,
    eventCount: n,
    occurrences: 1,
    ...overrides,
  })

  const recap = (issues: RecapIssue[]) =>
    formatRecap({
      projectLabel: 'backend',
      issues,
      since: new Date('2026-10-06T06:00:00Z'),
      timeZone: 'Europe/Helsinki',
    })

  it('renders every issue as a link', () => {
    const text = JSON.stringify(recap([entry(1), entry(2)]).blocks)

    expect(text).toContain('<https://sentry/issues/1|issue 1>')
    expect(text).toContain('<https://sentry/issues/2|issue 2>')
  })

  it('keeps every chunk of a large queue under the Slack block limit', () => {
    const issues = Array.from({ length: 200 }, (_, i) => entry(i + 1))
    const chunks = chunkRecapIssues(issues)

    expect(chunks.flat()).toHaveLength(200)
    for (const chunk of chunks) {
      expect(recap(chunk).blocks.length).toBeLessThanOrEqual(50)
    }
  })

  it('hides nothing — a chunk renders every issue it is given', () => {
    const issues = Array.from({ length: 24 }, (_, i) => entry(i + 1))
    const text = JSON.stringify(recap(issues).blocks)

    for (const issue of issues) {
      expect(text).toContain(issue.issueUrl)
    }
  })

  it('splits a queue across messages without losing or duplicating an issue', () => {
    const issues = Array.from({ length: 53 }, (_, i) => entry(i + 1))
    const chunks = chunkRecapIssues(issues)

    expect(chunks).toHaveLength(3)

    const rendered = chunks.flatMap((chunk, i) => {
      const message = formatRecap({
        projectLabel: 'backend',
        issues: chunk,
        since: null,
        timeZone: 'Europe/Helsinki',
        part: i + 1,
        parts: chunks.length,
      })
      expect(message.blocks.length).toBeLessThanOrEqual(50)
      return chunk.map((issue) => issue.issueUrl)
    })

    expect(new Set(rendered).size).toBe(53)
  })

  it('numbers the parts when a recap spans several messages', () => {
    const single = formatRecap({
      projectLabel: 'backend',
      issues: [entry(1)],
      since: null,
      timeZone: 'Europe/Helsinki',
    })
    const split = formatRecap({
      projectLabel: 'backend',
      issues: [entry(1)],
      since: null,
      timeZone: 'Europe/Helsinki',
      part: 2,
      parts: 3,
    })

    expect(single.text).not.toContain('part')
    expect(split.text).toContain('part 2 of 3')
  })

  it('carries the same detail a regular alert shows', () => {
    const blocks = recap([
      entry(1, {
        culprit: 'app/api/sync',
        shortId: 'BACK-1',
        frame: '/opt/app/src/http.ts:42:9 in fetchWithRetry',
        level: 'warning',
      }),
    ]).blocks
    const text = JSON.stringify(blocks)

    expect(text).toContain('app/api/sync')
    expect(text).toContain('fetchWithRetry')
    expect(text).toContain('BACK-1')
    expect(text).toContain('warning')
  })

  it('separates issues with dividers but does not trail one', () => {
    const blocks = recap([entry(1), entry(2), entry(3)]).blocks as { type: string }[]

    expect(blocks.filter((b) => b.type === 'divider')).toHaveLength(2)
    expect(blocks[blocks.length - 1]?.type).toBe('section')
  })

  it('omits fields an issue does not have', () => {
    const text = JSON.stringify(recap([entry(1, { eventCount: null })]).blocks)

    expect(text).not.toContain('*Short ID*')
    expect(text).not.toContain('*Events*')
  })

  it('lists the noisiest issue first', () => {
    const text = JSON.stringify(recap([entry(1), entry(99)]).blocks)

    expect(text.indexOf('issue 99')).toBeLessThan(text.indexOf('issue 1'))
  })

  it('mentions repeat sightings only when there were several', () => {
    expect(JSON.stringify(recap([entry(1, { occurrences: 4 })]).blocks)).toContain('4 times')
    expect(JSON.stringify(recap([entry(1, { occurrences: 1 })]).blocks)).not.toContain('*Seen*')
  })

  it('has a fallback text for notifications', () => {
    expect(recap([entry(1)]).text).toContain('backend')
    expect(recap([entry(1)]).text).toContain('1 issue')
  })
})
