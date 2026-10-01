import { z } from 'zod'
import { RESOLVE_ACTION_ID } from './format.js'

const payloadSchema = z.object({
  type: z.string(),
  user: z.object({ id: z.string().min(1) }),
  response_url: z.string().url(),
  message: z.object({ blocks: z.array(z.unknown()) }),
  actions: z.array(z.object({ action_id: z.string(), value: z.string().optional() })).min(1),
})

const slug = z.string().min(1).max(100).regex(/^[a-z0-9][a-z0-9._-]*$/i)

const actionValueSchema = z.union([
  z.object({
    v: z.literal(2),
    orgSlug: slug,
    projectSlug: slug,
    issueId: z.string().min(1).max(64).regex(/^\d+$/),
  }),
  z.object({
    v: z.literal(1),
    projectSlug: slug,
    issueId: z.string().min(1).max(64).regex(/^\d+$/),
  }),
])

export interface ResolveClick {
  orgSlug: string | null
  projectSlug: string
  issueId: string
  userId: string
  responseUrl: string
  blocks: unknown[]
}

export function parseInteraction(payload: unknown): ResolveClick | null {
  const parsed = payloadSchema.safeParse(payload)
  if (!parsed.success || parsed.data.type !== 'block_actions') return null

  const action = parsed.data.actions.find((a) => a.action_id === RESOLVE_ACTION_ID)
  if (!action?.value) return null

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
    orgSlug: value.data.v === 2 ? value.data.orgSlug : null,
    projectSlug: value.data.projectSlug,
    issueId: value.data.issueId,
    userId: parsed.data.user.id,
    responseUrl: parsed.data.response_url,
    blocks: parsed.data.message.blocks,
  }
}
