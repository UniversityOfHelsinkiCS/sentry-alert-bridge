import { DataTypes } from 'sequelize'

import { config } from '../../config.js'
import { DEFAULTS } from '../../defaults.js'
import type { Migration } from '../connection.js'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.addColumn(
      'settings',
      'poll_interval_minutes',
      { type: DataTypes.INTEGER, allowNull: false, defaultValue: DEFAULTS.pollIntervalMinutes },
      { transaction },
    )

    await queryInterface.addColumn(
      'settings',
      'alert_cooldown_minutes',
      { type: DataTypes.INTEGER, allowNull: false, defaultValue: DEFAULTS.alertCooldownMinutes },
      { transaction },
    )

    await queryInterface.addColumn(
      'settings',
      'retention_days',
      { type: DataTypes.INTEGER, allowNull: false, defaultValue: DEFAULTS.retentionDays },
      { transaction },
    )

    await queryInterface.bulkUpdate(
      'settings',
      {
        poll_interval_minutes: config.POLL_INTERVAL_MINUTES,
        alert_cooldown_minutes: config.ALERT_COOLDOWN_MINUTES,
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
