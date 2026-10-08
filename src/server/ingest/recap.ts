const DAY_MS = 86_400_000

export interface RecapDueInput {
  times: string[]
  timeZone: string
  lastRecapAt: Date | null
  now: Date
}

function offsetAt(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date(instant))

  const at = (type: string): number => Number(parts.find((part) => part.type === type)?.value)
  const hour = at('hour') === 24 ? 0 : at('hour')

  return (
    Date.UTC(at('year'), at('month') - 1, at('day'), hour, at('minute'), at('second')) - instant
  )
}

function localDateParts(instant: number, timeZone: string): [number, number, number] {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(instant))

  const at = (type: string): number => Number(parts.find((part) => part.type === type)?.value)
  return [at('year'), at('month'), at('day')]
}

function zonedWallClockToUtc(
  year: number,
  month: number,
  day: number,
  hours: number,
  minutes: number,
  timeZone: string,
): number {
  const wall = Date.UTC(year, month - 1, day, hours, minutes)
  const first = wall - offsetAt(wall, timeZone)
  return wall - offsetAt(first, timeZone)
}

function parseTime(time: string): [number, number] | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time)
  if (!match) return null
  return [Number(match[1]), Number(match[2])]
}

export function recapDueAt(input: RecapDueInput): Date | null {
  if (!Array.isArray(input.times) || input.times.length === 0) return null

  const now = input.now.getTime()
  const since = input.lastRecapAt === null ? now - 120_000 : input.lastRecapAt.getTime()

  let latest: number | null = null

  for (const time of input.times) {
    const parsed = parseTime(time)
    if (!parsed) continue

    for (const dayOffset of [-1, 0, 1]) {
      const [year, month, day] = localDateParts(now + dayOffset * DAY_MS, input.timeZone)
      const instant = zonedWallClockToUtc(year, month, day, parsed[0], parsed[1], input.timeZone)

      if (instant > since && instant <= now && (latest === null || instant > latest)) {
        latest = instant
      }
    }
  }

  return latest === null ? null : new Date(latest)
}
