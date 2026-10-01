import { DEFAULTS } from '../defaults.js'
import { logger } from '../logger.js'
import { Setting } from './model/index.js'

export interface Settings {
  lastPollAt: Date | null
  pollIntervalMinutes: number
  alertCooldownMinutes: number
  retentionDays: number
}

export interface SettingsUpdate {
  pollIntervalMinutes: number
  alertCooldownMinutes: number
  retentionDays: number
}

const positive = (value: number | null | undefined, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback

const toSettings = (row: Setting): Settings => ({
  lastPollAt: row.lastPollAt,
  pollIntervalMinutes: positive(row.pollIntervalMinutes, DEFAULTS.pollIntervalMinutes),
  alertCooldownMinutes: positive(row.alertCooldownMinutes, DEFAULTS.alertCooldownMinutes),
  retentionDays: positive(row.retentionDays, DEFAULTS.retentionDays),
})

export async function getSettings(): Promise<Settings> {
  const row = await Setting.findByPk(1)
  if (!row) {
    logger.warn('settings row is missing; falling back to built-in defaults')
    return { lastPollAt: null, ...DEFAULTS }
  }
  return toSettings(row)
}

export async function updateSettings(values: SettingsUpdate): Promise<Settings> {
  const [row] = await Setting.upsert({ id: 1, ...values, updatedAt: new Date() })
  return toSettings(row)
}

export async function touchLastPoll(): Promise<void> {
  await Setting.update({ lastPollAt: new Date() }, { where: { id: 1 } })
}
