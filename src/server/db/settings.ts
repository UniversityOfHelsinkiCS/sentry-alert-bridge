import { Setting } from './models.js'

export interface Settings {
  lastPollAt: Date | null
}

export async function getSettings(): Promise<Settings> {
  const row = await Setting.findByPk(1)
  if (!row) throw new Error('settings row is missing; migrations may not have run')
  return { lastPollAt: row.lastPollAt }
}

export async function touchLastPoll(): Promise<void> {
  await Setting.update({ lastPollAt: new Date() }, { where: { id: 1 } })
}
