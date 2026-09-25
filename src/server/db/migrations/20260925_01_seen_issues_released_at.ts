import { DataTypes } from 'sequelize'

import type { Migration } from '../connection.js'

/**
 * Resolving an issue from Slack used to delete its seen_issues row outright,
 * which left no way to tell "we deliberately let this one go" apart from "we
 * have never seen it". The poller needs that difference: a released issue is
 * allowed to alert again whenever it comes back, while an issue we have simply
 * never seen stays behind the firstSeen window so enabling a route does not
 * replay a backlog.
 *
 * Null means claimed, a timestamp means released and waiting for a regression.
 */
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.addColumn('seen_issues', 'released_at', {
    type: DataTypes.DATE,
    allowNull: true,
  })
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.removeColumn('seen_issues', 'released_at')
}
