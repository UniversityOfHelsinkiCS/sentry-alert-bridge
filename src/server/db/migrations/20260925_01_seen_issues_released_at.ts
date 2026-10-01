import { DataTypes } from 'sequelize'

import type { Migration } from '../connection.js'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.addColumn('seen_issues', 'released_at', {
    type: DataTypes.DATE,
    allowNull: true,
  })
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.removeColumn('seen_issues', 'released_at')
}
