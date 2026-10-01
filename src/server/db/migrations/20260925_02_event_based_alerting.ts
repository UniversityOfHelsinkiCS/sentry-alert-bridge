import { DataTypes, literal } from 'sequelize'

import type { Migration } from '../connection.js'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.addColumn(
      'routes',
      'alerts_from',
      { type: DataTypes.DATE, allowNull: false, defaultValue: literal('now()') },
      { transaction },
    )

    await queryInterface.addColumn(
      'seen_issues',
      'alerted_at',
      { type: DataTypes.DATE, allowNull: true },
      { transaction },
    )

    await queryInterface.sequelize.query(
      'update seen_issues set alerted_at = seen_at where alerted_at is null',
      { transaction },
    )
  })
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.removeColumn('routes', 'alerts_from', { transaction })
    await queryInterface.removeColumn('seen_issues', 'alerted_at', { transaction })
  })
}
