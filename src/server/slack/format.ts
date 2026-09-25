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

/** Slack treats &, < and > specially inside mrkdwn. */
function escape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function field(label: string, value: string | null | undefined) {
  if (!value) return null
  return { type: 'mrkdwn' as const, text: `*${label}*\n${escape(value)}` }
}

export interface SlackMessage {
  text: string
  blocks: unknown[]
}

export const RESOLVE_ACTION_ID = 'resolve_issue'

export interface FormatOptions {
  /** Adds the Resolve button. Off by default so the test alert cannot get one. */
  resolvable?: boolean
}

/**
 * What the button carries back to us on a click. Versioned so a later change to
 * the encoding does not break the buttons already sitting in Slack history.
 */
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
        value: JSON.stringify({ v: 1, projectSlug: issue.projectSlug, issueId: issue.id }),
        // Without this a mistaken tap on a phone silently mutates Sentry.
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

  // Slack allows at most 10 fields per section.
  if (fields.length > 0) blocks.push({ type: 'section', fields: fields.slice(0, 10) })

  if (options.resolvable) blocks.push(resolveButton(issue))

  return {
    // Fallback for notifications and clients that ignore blocks.
    text: `${emoji} ${issue.projectSlug}: ${issue.title}`,
    blocks,
  }
}

/**
 * Rewrites the blocks Slack hands back on a click: drops the actions block so
 * the button cannot be pressed twice, and notes who resolved it. Working from
 * the original message means we never have to reconstruct the issue, so this
 * keeps working even if formatIssue changes.
 *
 * `<@id>` rather than a username: Slack renders the display name itself, and
 * the username field is often absent from the payload.
 */
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

/** The synthetic issue behind the "Test" button on the destinations page. */
export function testIssue(): NormalizedIssue {
  return {
    id: `test-${Date.now()}`,
    title: 'Test alert from sentry-alert-bridge',
    culprit: 'sentry-alert-bridge/test',
    level: 'info',
    shortId: 'TEST-1',
    url: null,
    count: 1,
    projectSlug: 'sentry-alert-bridge',
    projectName: 'sentry-alert-bridge',
    environment: 'test',
  }
}
