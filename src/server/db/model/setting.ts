import {
  type CreationOptional,
  DataTypes,
  type InferAttributes,
  type InferCreationAttributes,
  Model,
} from 'sequelize'
import { DEFAULTS } from '../../defaults.js'
import { common } from './common.js'

export class Setting extends Model<InferAttributes<Setting>, InferCreationAttributes<Setting>> {
  declare id: CreationOptional<number>
  declare lastPollAt: Date | null
  declare updatedAt: CreationOptional<Date>
  declare pollIntervalMinutes: CreationOptional<number>
  declare alertCooldownMinutes: CreationOptional<number>
  declare retentionDays: CreationOptional<number>
}

Setting.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    lastPollAt: { type: DataTypes.DATE, allowNull: true },
    updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    pollIntervalMinutes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: DEFAULTS.pollIntervalMinutes },
    alertCooldownMinutes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: DEFAULTS.alertCooldownMinutes },
    retentionDays: { type: DataTypes.INTEGER, allowNull: false, defaultValue: DEFAULTS.retentionDays },
  },
  { ...common, tableName: 'settings' },
)
