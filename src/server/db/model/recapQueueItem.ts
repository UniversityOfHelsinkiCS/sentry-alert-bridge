import {
  type CreationOptional,
  DataTypes,
  type InferAttributes,
  type InferCreationAttributes,
  Model,
} from 'sequelize'
import { common } from './common.js'

export class RecapQueueItem extends Model<
  InferAttributes<RecapQueueItem>,
  InferCreationAttributes<RecapQueueItem>
> {
  declare orgSlug: string
  declare projectSlug: string
  declare issueId: string
  declare issueTitle: string
  declare issueUrl: string
  declare culprit: CreationOptional<string | null>
  declare level: CreationOptional<string | null>
  declare shortId: CreationOptional<string | null>
  declare eventCount: CreationOptional<number | null>
  declare frame: CreationOptional<string | null>
  declare matchedPattern: string
  declare firstQueuedAt: CreationOptional<Date>
  declare lastQueuedAt: CreationOptional<Date>
  declare occurrences: CreationOptional<number>
}

RecapQueueItem.init(
  {
    orgSlug: { type: DataTypes.TEXT, primaryKey: true },
    projectSlug: { type: DataTypes.TEXT, primaryKey: true },
    issueId: { type: DataTypes.TEXT, primaryKey: true },
    issueTitle: { type: DataTypes.TEXT, allowNull: false },
    issueUrl: { type: DataTypes.TEXT, allowNull: false },
    culprit: { type: DataTypes.TEXT, allowNull: true, defaultValue: null },
    level: { type: DataTypes.TEXT, allowNull: true, defaultValue: null },
    shortId: { type: DataTypes.TEXT, allowNull: true, defaultValue: null },
    eventCount: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
    frame: { type: DataTypes.TEXT, allowNull: true, defaultValue: null },
    matchedPattern: { type: DataTypes.TEXT, allowNull: false },
    firstQueuedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    lastQueuedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    occurrences: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  },
  { ...common, tableName: 'recap_queue' },
)
