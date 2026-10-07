import {
  type CreationOptional,
  DataTypes,
  type InferAttributes,
  type InferCreationAttributes,
  Model,
} from 'sequelize'
import { common } from './common.js'

export class SentryOrg extends Model<
  InferAttributes<SentryOrg>,
  InferCreationAttributes<SentryOrg>
> {
  declare slug: string
  declare name: string | null
  declare authToken: string
  declare baseUrl: string | null
  declare timezone: CreationOptional<string | null>
  declare createdAt: CreationOptional<Date>
}

SentryOrg.init(
  {
    slug: { type: DataTypes.TEXT, primaryKey: true },
    name: { type: DataTypes.TEXT, allowNull: true },
    authToken: { type: DataTypes.TEXT, allowNull: false },
    baseUrl: { type: DataTypes.TEXT, allowNull: true },
    timezone: { type: DataTypes.TEXT, allowNull: true, defaultValue: null },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  { ...common, tableName: 'sentry_orgs' },
)
