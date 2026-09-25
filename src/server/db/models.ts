import {
  type CreationOptional,
  DataTypes,
  type InferAttributes,
  type InferCreationAttributes,
  Model,
} from 'sequelize'
import type { DeliveryOutcome, IngestSource } from '../../shared/types.js'
import { sequelize } from './connection.js'

/**
 * The models mirror the schema built in migrations/. `underscored` maps the
 * camelCase attributes onto the snake_case columns, and nothing here syncs —
 * the migrations remain the only thing that creates or alters tables.
 *
 * The `now()` column defaults live in the schema, but Sequelize validates
 * allowNull before it sends the insert — so the timestamps need a model-side
 * default too, or a create() would be rejected before postgres ever saw it.
 */
const common = { sequelize, underscored: true, timestamps: false, freezeTableName: true } as const

export class SlackDestination extends Model<
  InferAttributes<SlackDestination>,
  InferCreationAttributes<SlackDestination>
> {
  declare id: CreationOptional<number>
  declare label: string
  declare webhookUrl: string
  declare createdAt: CreationOptional<Date>
}

SlackDestination.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    label: { type: DataTypes.TEXT, allowNull: false },
    webhookUrl: { type: DataTypes.TEXT, allowNull: false },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  { ...common, tableName: 'slack_destinations' },
)

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

export class Route extends Model<InferAttributes<Route>, InferCreationAttributes<Route>> {
  declare projectSlug: string
  declare destinationId: number
  declare enabled: CreationOptional<boolean>
  declare updatedAt: CreationOptional<Date>
  /** Only events after this can alert, so routing replays no history. */
  declare alertsFrom: CreationOptional<Date>
}

Route.init(
  {
    projectSlug: { type: DataTypes.TEXT, primaryKey: true },
    destinationId: { type: DataTypes.INTEGER, allowNull: false },
    enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    alertsFrom: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  { ...common, tableName: 'routes' },
)

export class Setting extends Model<InferAttributes<Setting>, InferCreationAttributes<Setting>> {
  declare id: CreationOptional<number>
  declare lastPollAt: Date | null
  declare updatedAt: CreationOptional<Date>
}

Setting.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    lastPollAt: { type: DataTypes.DATE, allowNull: true },
    updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  { ...common, tableName: 'settings' },
)

export class SeenIssue extends Model<
  InferAttributes<SeenIssue>,
  InferCreationAttributes<SeenIssue>
> {
  declare projectSlug: string
  declare issueId: string
  declare seenAt: CreationOptional<Date>
  /** Null while claimed; set when the issue is resolved from Slack. */
  declare releasedAt: CreationOptional<Date | null>
  /** When this app last alerted on the issue; the cooldown runs from here. */
  declare alertedAt: CreationOptional<Date | null>
}

SeenIssue.init(
  {
    projectSlug: { type: DataTypes.TEXT, primaryKey: true },
    issueId: { type: DataTypes.TEXT, primaryKey: true },
    seenAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    releasedAt: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
    alertedAt: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
  },
  { ...common, tableName: 'seen_issues' },
)

export class Delivery extends Model<
  InferAttributes<Delivery>,
  InferCreationAttributes<Delivery>
> {
  declare id: CreationOptional<string>
  declare receivedAt: CreationOptional<Date>
  declare source: IngestSource
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
    projectSlug: { type: DataTypes.TEXT, allowNull: true },
    issueTitle: { type: DataTypes.TEXT, allowNull: true },
    issueUrl: { type: DataTypes.TEXT, allowNull: true },
    destinationId: { type: DataTypes.INTEGER, allowNull: true },
    outcome: { type: DataTypes.TEXT, allowNull: false },
    detail: { type: DataTypes.TEXT, allowNull: true },
  },
  { ...common, tableName: 'deliveries' },
)

SentryProject.hasOne(Route, { as: 'route', foreignKey: 'projectSlug', sourceKey: 'slug' })
Route.belongsTo(SentryProject, { foreignKey: 'projectSlug', targetKey: 'slug' })

Delivery.belongsTo(SlackDestination, { as: 'destination', foreignKey: 'destinationId' })
SlackDestination.hasMany(Delivery, { as: 'deliveries', foreignKey: 'destinationId' })
