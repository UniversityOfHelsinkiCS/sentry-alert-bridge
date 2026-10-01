import {
  type CreationOptional,
  DataTypes,
  type InferAttributes,
  type InferCreationAttributes,
  Model,
} from 'sequelize'
import { common } from './common.js'

export class SentryProject extends Model<
  InferAttributes<SentryProject>,
  InferCreationAttributes<SentryProject>
> {
  declare orgSlug: string
  declare slug: string
  declare name: string | null
  declare firstSeenAt: CreationOptional<Date>
  declare lastSeenAt: CreationOptional<Date>
}

SentryProject.init(
  {
    orgSlug: { type: DataTypes.TEXT, primaryKey: true },
    slug: { type: DataTypes.TEXT, primaryKey: true },
    name: { type: DataTypes.TEXT, allowNull: true },
    firstSeenAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    lastSeenAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  { ...common, tableName: 'sentry_projects' },
)
