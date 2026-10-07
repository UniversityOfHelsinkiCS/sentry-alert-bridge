import type { NormalizedIssue } from '../../shared/types.js'

function emojiFor(level: string | null | undefined): string {
  switch ((level ?? '').toLowerCase()) {
    case 'fatal':
    case 'error':
      return '🔴'
    case 'warning':
      return '🟡'
    default:
      return '⚪'
  }
}

function escape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function field(label: string, value: string | null | undefined) {
  if (!value) return null
  return { type: 'mrkdwn' as const, text: `*${label}*\n${escape(value)}` }
}

const FRAME_MAX_LENGTH = 110

/** Container paths are long and front-loaded with noise, so keep the tail. */
function truncateLeft(text: string): string {
  if (text.length <= FRAME_MAX_LENGTH) return text
  return `…${text.slice(text.length - FRAME_MAX_LENGTH + 1)}`
}

function frameText(frame: string): string {
  const match = /^(.*?) in (.+)$/.exec(frame)
  if (!match) return `📍 \`${escape(truncateLeft(frame))}\``
  return `📍 \`${escape(truncateLeft(match[1] ?? ''))}\` in \`${escape(match[2] ?? '')}\``
}

export interface SlackMessage {
  text: string
  blocks: unknown[]
}

export const RESOLVE_ACTION_ID = 'resolve_issue'

export interface FormatOptions {
  resolvable?: boolean
}

function resolveButton(issue: NormalizedIssue) {
  return {
    type: 'actions',
    block_id: 'issue_actions',
    elements: [
      {
        type: 'button',
        action_id: RESOLVE_ACTION_ID,
        text: { type: 'plain_text', text: 'Resolve' },
        style: 'primary',
        value: JSON.stringify({
          v: 2,
          orgSlug: issue.orgSlug,
          projectSlug: issue.projectSlug,
          issueId: issue.id,
        }),
        confirm: {
          title: { type: 'plain_text', text: 'Resolve this issue?' },
          text: { type: 'mrkdwn', text: 'This marks the issue resolved in Sentry.' },
          confirm: { type: 'plain_text', text: 'Resolve' },
          deny: { type: 'plain_text', text: 'Cancel' },
        },
      },
    ],
  }
}

export function formatIssue(issue: NormalizedIssue, options: FormatOptions = {}): SlackMessage {
  const emoji = emojiFor(issue.level)
  const title = escape(issue.title)
  const heading = issue.url ? `<${issue.url}|${title}>` : title

  const fields = [
    field('Project', issue.projectName ?? issue.projectSlug),
    field('Level', issue.level),
    field('Short ID', issue.shortId),
    field('Events', issue.count === null || issue.count === undefined ? null : String(issue.count)),
    field('Environment', issue.environment),
  ].filter((f): f is NonNullable<typeof f> => f !== null)

  const blocks: unknown[] = [
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `${emoji} *New Sentry issue*\n${heading}` },
    },
  ]

  if (issue.culprit) {
    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `\`${escape(issue.culprit)}\`` }],
    })
  }

  if (issue.frame) {
    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: frameText(issue.frame) }],
    })
  }

  if (fields.length > 0) blocks.push({ type: 'section', fields: fields.slice(0, 10) })

  if (options.resolvable) blocks.push(resolveButton(issue))

  return {
    text: `${emoji} ${issue.projectSlug}: ${issue.title}`,
    blocks,
  }
}

export interface RecapIssue {
  issueTitle: string
  issueUrl: string
  level: string | null
  eventCount: number | null
  occurrences: number
}

export interface RecapMessageInput {
  projectLabel: string
  issues: RecapIssue[]
  since: Date | null
  timeZone: string
}

const RECAP_MAX_ISSUES = 50
const RECAP_SECTION_MAX_CHARS = 2800

function recapLine(issue: RecapIssue): string {
  const heading = `<${issue.issueUrl}|${escape(issue.issueTitle)}>`
  const parts = [`${emojiFor(issue.level)} ${heading}`]

  if (issue.eventCount !== null) parts.push(`${issue.eventCount} events`)
  if (issue.occurrences > 1) parts.push(`seen ${issue.occurrences}\u00d7`)

  return `\u2022 ${parts.join('  \u00b7  ')}`
}

function recapSince(since: Date | null, timeZone: string): string {
  if (!since) return 'since the last recap'

  const formatted = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(since)

  return `since ${formatted}`
}

function packLines(lines: string[]): unknown[] {
  const blocks: unknown[] = []
  let current: string[] = []
  let length = 0

  for (const line of lines) {
    if (current.length > 0 && length + line.length + 1 > RECAP_SECTION_MAX_CHARS) {
      blocks.push({ type: 'section', text: { type: 'mrkdwn', text: current.join('\n') } })
      current = []
      length = 0
    }
    current.push(line)
    length += line.length + 1
  }

  if (current.length > 0) {
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: current.join('\n') } })
  }

  return blocks
}

export function formatRecap(input: RecapMessageInput): SlackMessage {
  const total = input.issues.length
  const ordered = [...input.issues].sort((a, b) => (b.eventCount ?? 0) - (a.eventCount ?? 0))
  const shown = ordered.slice(0, RECAP_MAX_ISSUES)

  const heading =
    `\ud83d\uddd2\ufe0f *Daily recap \u2014 ${escape(input.projectLabel)}*\n` +
    `${total} ${total === 1 ? 'issue' : 'issues'} matched this project's recap rules ` +
    `${recapSince(input.since, input.timeZone)}.`

  const lines = shown.map(recapLine)
  if (total > shown.length) lines.push(`_+${total - shown.length} more_`)

  return {
    text: `\ud83d\uddd2\ufe0f Daily recap \u2014 ${input.projectLabel}: ${total} ${total === 1 ? 'issue' : 'issues'}`,
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text: heading } },
      ...packLines(lines),
    ],
  }
}

export function markResolved(blocks: unknown[], userId: string): unknown[] {
  const kept = blocks.filter((block) => {
    return !(typeof block === 'object' && block !== null && 'type' in block &&
      (block as { type?: unknown }).type === 'actions')
  })

  return [
    ...kept,
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `✅ Resolved in Sentry by <@${userId}>` }],
    },
  ]
}

export function testIssue(): NormalizedIssue {
  return {
    id: `test-${Date.now()}`,
    title: 'Test alert from sentry-alert-bridge',
    culprit: 'sentry-alert-bridge/test',
    level: 'info',
    shortId: 'TEST-1',
    url: null,
    count: 1,
    orgSlug: 'sentry',
    projectSlug: 'sentry-alert-bridge',
    projectName: 'sentry-alert-bridge',
    environment: 'test',
    frame: '/opt/app-root/src/src/server/updater/util.ts:27:20 in safeBulkCreate',
  }
}
