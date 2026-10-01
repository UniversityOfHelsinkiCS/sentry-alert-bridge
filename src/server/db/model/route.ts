import {
  type CreationOptional,
  DataTypes,
  type InferAttributes,
  type InferCreationAttributes,
  Model,
} from 'sequelize'
import { common } from './common.js'

export class Route extends Model<InferAttributes<Route>, InferCreationAttributes<Route>> {
  declare orgSlug: string
  declare projectSlug: string
  declare destinationId: number
  declare enabled: CreationOptional<boolean>
  declare updatedAt: CreationOptional<Date>
  declare alertsFrom: CreationOptional<Date>
  declare cooldownMinutes: CreationOptional<number | null>
}

Route.init(
  {
    orgSlug: { type: DataTypes.TEXT, primaryKey: true },
    projectSlug: { type: DataTypes.TEXT, primaryKey: true },
    destinationId: { type: DataTypes.INTEGER, allowNull: false },
    enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    alertsFrom: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    cooldownMinutes: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
  },
  { ...common, tableName: 'routes' },
)
