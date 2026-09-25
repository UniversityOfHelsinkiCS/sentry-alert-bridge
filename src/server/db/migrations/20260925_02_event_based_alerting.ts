import { DataTypes, literal } from 'sequelize'

import type { Migration } from '../connection.js'

/**
 * Alerting moves from "a new issue appeared" to "an issue was seen again",
 * which needs two pieces of state the old rule did not.
 *
 * routes.alerts_from is the line between history and news: only events after it
 * can alert, so routing a project does not replay everything Sentry already
 * holds. Existing routes get now(), so nothing in the past can spam.
 *
 * seen_issues.alerted_at is when this app last alerted on an issue. Together
 * with the issue's lastSeen it answers "has anything happened since we spoke?",
 * and it is what the cooldown is measured from.
 */
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

    // Rows that predate the column were all created by an alert being sent.
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
