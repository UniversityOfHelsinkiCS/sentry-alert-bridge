import type { IngestMode } from '../../shared/types.js'
import { getSettings } from '../db/settings.js'
import { startPoller, stopPoller } from './poller.js'

let current: IngestMode = 'polling'

/** Starts or stops the poller in place, so a mode change needs no restart. */
export async function applyIngestMode(mode: IngestMode): Promise<void> {
  current = mode
  if (mode === 'polling') startPoller()
  else stopPoller()
}

export function currentIngestMode(): IngestMode {
  return current
}

export async function initIngestMode(): Promise<IngestMode> {
  const { ingestMode } = await getSettings()
  await applyIngestMode(ingestMode)
  return ingestMode
}
