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

export const apiFrameSchema = z
  .object({
    filename: z.string().nullish(),
    absPath: z.string().nullish(),
    module: z.string().nullish(),
    function: z.string().nullish(),
    lineNo: z.union([z.string(), z.number()]).nullish(),
    colNo: z.union([z.string(), z.number()]).nullish(),
    inApp: z.boolean().nullish(),
  })
  .passthrough()

export type ApiFrame = z.infer<typeof apiFrameSchema>

export const exceptionDataSchema = z
  .object({
    values: z
      .array(
        z
          .object({
            stacktrace: z
              .object({ frames: z.array(apiFrameSchema).nullish() })
              .passthrough()
              .nullish(),
          })
          .passthrough(),
      )
      .nullish(),
  })
  .passthrough()

/**
 * Shape of GET /api/0/issues/{id}/events/latest/. Only the entries list
 * matters here, and its payloads differ per SDK, so `data` stays unknown
 * until the entry type is known.
 */
export const apiEventSchema = z
  .object({
    entries: z
      .array(z.object({ type: z.string(), data: z.unknown() }).passthrough())
      .nullish(),
  })
  .passthrough()

export type ApiEvent = z.infer<typeof apiEventSchema>
