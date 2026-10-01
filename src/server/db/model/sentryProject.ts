import {
  type CreationOptional,
  DataTypes,
  type InferAttributes,
  type InferCreationAttributes,
  Model,
} from 'sequelize'
import { common } from './common.js'
import type { Route } from './route.js'

export class SentryProject extends Model<
  InferAttributes<SentryProject>,
  InferCreationAttributes<SentryProject>
> {
  declare slug: string
  declare name: string | null
  declare firstSeenAt: CreationOptional<Date>
  declare lastSeenAt: CreationOptional<Date>
  declare route?: Route | null
}

SentryProject.init(
  {
    slug: { type: DataTypes.TEXT, primaryKey: true },
    name: { type: DataTypes.TEXT, allowNull: true },
    firstSeenAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    lastSeenAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  { ...common, tableName: 'sentry_projects' },
)
