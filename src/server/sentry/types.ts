import { z } from 'zod'
import type { NormalizedIssue } from '../../shared/types.js'

/**
 * The acual payload shape drifts between Sentry versions, so everything beyond
 * the issue id, the title and the project slug is optional and unknown keys are
 * passed through untouched.
 */
const issueSchema = z
  .object({
    id: z.union([z.string(), z.number()]).transform(String),
    title: z.string().default('(untitled issue)'),
    culprit: z.string().nullish(),
    level: z.string().nullish(),
    shortId: z.string().nullish(),
    permalink: z.string().nullish(),
    web_url: z.string().nullish(),
    count: z.union([z.string(), z.number()]).nullish(),
    project: z
      .object({
        slug: z.string(),
        name: z.string().nullish(),
      })
      .passthrough(),
    metadata: z
      .object({ value: z.string().nullish(), type: z.string().nullish() })
      .passthrough()
      .nullish(),
  })
  .passthrough()

export const webhookPayloadSchema = z
  .object({
    action: z.string(),
    data: z.object({ issue: issueSchema }),
  })
  .passthrough()

export type WebhookPayload = z.infer<typeof webhookPayloadSchema>

export function normalizeWebhookIssue(payload: WebhookPayload): NormalizedIssue {
  const issue = payload.data.issue
  return {
    id: issue.id,
    title: issue.title,
    culprit: issue.culprit ?? null,
    level: issue.level ?? null,
    shortId: issue.shortId ?? null,
    url: issue.web_url ?? issue.permalink ?? null,
    count: issue.count === null || issue.count === undefined ? null : Number(issue.count),
    projectSlug: issue.project.slug,
    projectName: issue.project.name ?? null,
    environment: null,
  }
}

/** Shape of an issue from GET /api/0/projects/{org}/{project}/issues/ */
export const apiIssueSchema = z
  .object({
    id: z.union([z.string(), z.number()]).transform(String),
    title: z.string().default('(untitled issue)'),
    culprit: z.string().nullish(),
    level: z.string().nullish(),
    shortId: z.string().nullish(),
    permalink: z.string().nullish(),
    count: z.union([z.string(), z.number()]).nullish(),
    firstSeen: z.string().nullish(),
  })
  .passthrough()

export type ApiIssue = z.infer<typeof apiIssueSchema>

export const apiProjectSchema = z
  .object({
    slug: z.string(),
    name: z.string().nullish(),
  })
  .passthrough()
