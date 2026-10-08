import { DataTypes } from 'sequelize'

import type { Migration } from '../connection.js'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.addColumn('recap_queue', 'frame', {
    type: DataTypes.TEXT,
    allowNull: true,
  })
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.removeColumn('recap_queue', 'frame')
}
