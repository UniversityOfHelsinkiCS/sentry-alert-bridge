import { DataTypes } from 'sequelize'

import type { Migration } from '../connection.js'

const DEFAULT_POLL_INTERVAL_MINUTES = 5
const DEFAULT_ALERT_COOLDOWN_MINUTES = 60
const DEFAULT_RETENTION_DAYS = 30

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim()
  if (!raw) return fallback

  const parsed = Number(raw)
  if (!Number.isInteger(parsed) || parsed < 0) return fallback

  return parsed
}

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.addColumn(
      'settings',
      'poll_interval_minutes',
      {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: DEFAULT_POLL_INTERVAL_MINUTES,
      },
      { transaction },
    )

    await queryInterface.addColumn(
      'settings',
      'alert_cooldown_minutes',
      {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: DEFAULT_ALERT_COOLDOWN_MINUTES,
      },
      { transaction },
    )

    await queryInterface.addColumn(
      'settings',
      'retention_days',
      { type: DataTypes.INTEGER, allowNull: false, defaultValue: DEFAULT_RETENTION_DAYS },
      { transaction },
    )

    await queryInterface.bulkUpdate(
      'settings',
      {
        poll_interval_minutes: intFromEnv(
          'POLL_INTERVAL_MINUTES',
          DEFAULT_POLL_INTERVAL_MINUTES,
        ),
        alert_cooldown_minutes: intFromEnv(
          'ALERT_COOLDOWN_MINUTES',
          DEFAULT_ALERT_COOLDOWN_MINUTES,
        ),
      },
      { id: 1 },
      { transaction },
    )

    await queryInterface.addColumn(
      'routes',
      'cooldown_minutes',
      { type: DataTypes.INTEGER, allowNull: true },
      { transaction },
    )
  })
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.removeColumn('settings', 'poll_interval_minutes', { transaction })
    await queryInterface.removeColumn('settings', 'alert_cooldown_minutes', { transaction })
    await queryInterface.removeColumn('settings', 'retention_days', { transaction })
    await queryInterface.removeColumn('routes', 'cooldown_minutes', { transaction })
  })
}
