import { z } from 'zod'

/**
 * Shape of an issue from GET /api/0/projects/{org}/{project}/issues/. The acual
 * payload drifts between Sentry versions, so everything beyond the id and the
 * title is optional and unknown keys are passed through untouched.
 */
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
    lastSeen: z.string().nullish(),
  })
  .passthrough()

export type ApiIssue = z.infer<typeof apiIssueSchema>

export const apiProjectSchema = z
  .object({
    slug: z.string(),
    name: z.string().nullish(),
  })
  .passthrough()
