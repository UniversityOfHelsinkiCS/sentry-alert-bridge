import { sequelize } from '../connection.js'

export const common = {
  sequelize,
  underscored: true,
  timestamps: false,
  freezeTableName: true,
} as const
