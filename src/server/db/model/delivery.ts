import {
  type CreationOptional,
  DataTypes,
  type InferAttributes,
  type InferCreationAttributes,
  Model,
} from 'sequelize'
import type { DeliveryOutcome, IngestSource } from '../../../shared/types.js'
import { common } from './common.js'
import type { SlackDestination } from './slackDestination.js'

export class Delivery extends Model<
  InferAttributes<Delivery>,
  InferCreationAttributes<Delivery>
> {
  declare id: CreationOptional<string>
  declare receivedAt: CreationOptional<Date>
  declare source: IngestSource
  declare orgSlug: string | null
  declare projectSlug: string | null
  declare issueTitle: string | null
  declare issueUrl: string | null
  declare destinationId: number | null
  declare outcome: DeliveryOutcome
  declare detail: string | null
  declare destination?: SlackDestination | null
}

Delivery.init(
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    receivedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    source: { type: DataTypes.TEXT, allowNull: false },
    orgSlug: { type: DataTypes.TEXT, allowNull: true },
    projectSlug: { type: DataTypes.TEXT, allowNull: true },
    issueTitle: { type: DataTypes.TEXT, allowNull: true },
    issueUrl: { type: DataTypes.TEXT, allowNull: true },
    destinationId: { type: DataTypes.INTEGER, allowNull: true },
    outcome: { type: DataTypes.TEXT, allowNull: false },
    detail: { type: DataTypes.TEXT, allowNull: true },
  },
  { ...common, tableName: 'deliveries' },
)
