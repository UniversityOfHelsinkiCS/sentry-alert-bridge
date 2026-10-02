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
