import {
  type CreationOptional,
  DataTypes,
  type InferAttributes,
  type InferCreationAttributes,
  Model,
} from 'sequelize'
import { common } from './common.js'

export class SlackDestination extends Model<
  InferAttributes<SlackDestination>,
  InferCreationAttributes<SlackDestination>
> {
  declare id: CreationOptional<number>
  declare orgSlug: string
  declare label: string
  declare webhookUrl: string
  declare createdAt: CreationOptional<Date>
}

SlackDestination.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    orgSlug: { type: DataTypes.TEXT, allowNull: false },
    label: { type: DataTypes.TEXT, allowNull: false },
    webhookUrl: { type: DataTypes.TEXT, allowNull: false },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  { ...common, tableName: 'slack_destinations' },
)
