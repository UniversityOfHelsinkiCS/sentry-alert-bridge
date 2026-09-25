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

export function formatIssue(issue: NormalizedIssue): SlackMessage {
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

  return {
    // Fallback for notifications and clients that ignore blocks.
    text: `${emoji} ${issue.projectSlug}: ${issue.title}`,
    blocks,
  }
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
