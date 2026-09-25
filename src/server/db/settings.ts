import type { IngestMode } from '../../shared/types.js'
import { config } from '../config.js'
import { query } from './pool.js'

export interface Settings {
  ingestMode: IngestMode
  lastPollAt: Date | null
}

export async function getSettings(): Promise<Settings> {
  const { rows } = await query<{ ingest_mode: IngestMode; last_poll_at: Date | null }>(
    'select ingest_mode, last_poll_at from settings where id = 1',
  )
  const row = rows[0]
  if (!row) throw new Error('settings row is missing; migrations may not have run')
  return { ingestMode: row.ingest_mode, lastPollAt: row.last_poll_at }
}

export async function setIngestMode(mode: IngestMode): Promise<void> {
  await query('update settings set ingest_mode = $1, updated_at = now() where id = 1', [mode])
}

export async function touchLastPoll(): Promise<void> {
  await query('update settings set last_poll_at = now() where id = 1')
}

/**
 * Seeds the mode from INGEST_MODE_DEFAULT the first time the app runs against a
 * fresh database. Afterwards the UI owns the setting and the env var is ignored.
 */
export async function seedIngestMode(): Promise<void> {
  await query(
    `update settings
        set ingest_mode = $1, seeded = true, updated_at = now()
      where id = 1 and not seeded`,
    [config.INGEST_MODE_DEFAULT],
  )
}
