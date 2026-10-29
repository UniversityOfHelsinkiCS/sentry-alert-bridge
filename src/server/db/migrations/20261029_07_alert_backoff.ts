import { DataTypes } from 'sequelize'

import type { Migration } from '../connection.js'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.addColumn(
      'routes',
      'backoff_ceiling_minutes',
      { type: DataTypes.INTEGER, allowNull: true },
      { transaction },
    )

    await queryInterface.addColumn(
      'seen_issues',
      'alert_streak',
      { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      { transaction },
    )
  })
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.removeColumn('routes', 'backoff_ceiling_minutes', { transaction })
    await queryInterface.removeColumn('seen_issues', 'alert_streak', { transaction })
  })
}
