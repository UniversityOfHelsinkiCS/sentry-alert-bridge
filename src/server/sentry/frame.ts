import { exceptionDataSchema, type ApiEvent, type ApiFrame } from './types.js'

function framesOf(event: ApiEvent): ApiFrame[] {
  const entries = event.entries ?? []

  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i]
    if (entry?.type !== 'exception') continue

    const parsed = exceptionDataSchema.safeParse(entry.data)
    if (!parsed.success) continue

    const values = parsed.data.values ?? []
    for (let v = values.length - 1; v >= 0; v--) {
      const frames = values[v]?.stacktrace?.frames ?? []
      if (frames.length > 0) return frames
    }
  }

  return []
}

function position(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? String(n) : null
}

/**
 * The deepest in-app frame of the latest event, rendered as
 * `path:line:col in function`. Sentry orders frames caller to callee, so the
 * last one is where the throw happened; frames outside the app are only used
 * when nothing is marked in-app.
 */
export function topFrame(event: ApiEvent | null | undefined): string | null {
  if (!event) return null

  const frames = framesOf(event)
  if (frames.length === 0) return null

  const frame = [...frames].reverse().find((f) => f.inApp === true) ?? frames[frames.length - 1]
  if (!frame) return null

  const path = frame.absPath ?? frame.filename ?? frame.module
  if (!path) return null

  let location = path
  const line = position(frame.lineNo)
  if (line) {
    location += `:${line}`
    const col = position(frame.colNo)
    if (col) location += `:${col}`
  }

  return frame.function ? `${location} in ${frame.function}` : location
}
