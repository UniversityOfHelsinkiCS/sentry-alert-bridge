import {
  type CreationOptional,
  DataTypes,
  type InferAttributes,
  type InferCreationAttributes,
  Model,
} from 'sequelize'
import { common } from './common.js'

export class SeenIssue extends Model<
  InferAttributes<SeenIssue>,
  InferCreationAttributes<SeenIssue>
> {
  declare orgSlug: string
  declare projectSlug: string
  declare issueId: string
  declare seenAt: CreationOptional<Date>
  declare releasedAt: CreationOptional<Date | null>
  declare alertedAt: CreationOptional<Date | null>
}

SeenIssue.init(
  {
    orgSlug: { type: DataTypes.TEXT, primaryKey: true },
    projectSlug: { type: DataTypes.TEXT, primaryKey: true },
    issueId: { type: DataTypes.TEXT, primaryKey: true },
    seenAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    releasedAt: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
    alertedAt: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
  },
  { ...common, tableName: 'seen_issues' },
)
