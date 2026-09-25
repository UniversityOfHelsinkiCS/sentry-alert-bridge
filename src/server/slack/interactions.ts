import { z } from 'zod'
import { RESOLVE_ACTION_ID } from './format.js'

/**
 * Slack's block_actions payload, narrowed to the parts this app uses. Unknown
 * fields are ignored rather than rejected: Slack adds them over time, and a
 * strict schema here would break the button on their schedule, not ours.
 */
const payloadSchema = z.object({
  type: z.string(),
  user: z.object({ id: z.string().min(1) }),
  response_url: z.string().url(),
  message: z.object({ blocks: z.array(z.unknown()) }),
  actions: z.array(z.object({ action_id: z.string(), value: z.string().optional() })).min(1),
})

/**
 * The button's own payload. Both fields end up in a Sentry API URL, so the
 * shapes are checked rather than trusted — this is the traversal guard.
 */
const actionValueSchema = z.object({
  v: z.literal(1),
  // The same slug shape routes/api.ts accepts.
  projectSlug: z.string().min(1).max(100).regex(/^[a-z0-9][a-z0-9._-]*$/i),
  issueId: z.string().min(1).max(64).regex(/^\d+$/),
})

export interface ResolveClick {
  projectSlug: string
  issueId: string
  userId: string
  responseUrl: string
  blocks: unknown[]
}

/**
 * Returns null for anything that is not one of our Resolve buttons — Slack
 * sends other interaction types, and they are ignored rather than treated as
 * errors. Never throws: a malformed payload is just not a click we act on.
 */
export function parseInteraction(payload: unknown): ResolveClick | null {
  const parsed = payloadSchema.safeParse(payload)
  if (!parsed.success || parsed.data.type !== 'block_actions') return null

  const action = parsed.data.actions.find((a) => a.action_id === RESOLVE_ACTION_ID)
  if (!action?.value) return null

  // The response_url is signed by Slack, but pinning the host keeps a future
  // refactor from turning this into a request-forgery primitive.
  if (!parsed.data.response_url.startsWith('https://hooks.slack.com/')) return null

  let decoded: unknown
  try {
    decoded = JSON.parse(action.value)
  } catch {
    return null
  }

  const value = actionValueSchema.safeParse(decoded)
  if (!value.success) return null

  return {
    projectSlug: value.data.projectSlug,
    issueId: value.data.issueId,
    userId: parsed.data.user.id,
    responseUrl: parsed.data.response_url,
    blocks: parsed.data.message.blocks,
  }
}
