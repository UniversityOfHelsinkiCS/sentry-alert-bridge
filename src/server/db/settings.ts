import { query } from './pool.js'

export interface Settings {
  lastPollAt: Date | null
}

export async function getSettings(): Promise<Settings> {
  const { rows } = await query<{ last_poll_at: Date | null }>(
    'select last_poll_at from settings where id = 1',
  )
  const row = rows[0]
  if (!row) throw new Error('settings row is missing; migrations may not have run')
  return { lastPollAt: row.last_poll_at }
}

export async function touchLastPoll(): Promise<void> {
  await query('update settings set last_poll_at = now() where id = 1')
}
