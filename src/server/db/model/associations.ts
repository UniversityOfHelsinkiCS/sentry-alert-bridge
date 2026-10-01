import { Delivery } from './delivery.js'
import { Route } from './route.js'
import { SentryProject } from './sentryProject.js'
import { SlackDestination } from './slackDestination.js'

SentryProject.hasOne(Route, { as: 'route', foreignKey: 'projectSlug', sourceKey: 'slug' })
Route.belongsTo(SentryProject, { foreignKey: 'projectSlug', targetKey: 'slug' })

Delivery.belongsTo(SlackDestination, { as: 'destination', foreignKey: 'destinationId' })
SlackDestination.hasMany(Delivery, { as: 'deliveries', foreignKey: 'destinationId' })
