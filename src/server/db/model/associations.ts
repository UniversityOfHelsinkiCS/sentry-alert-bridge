import { Delivery } from './delivery.js'
import { SlackDestination } from './slackDestination.js'

Delivery.belongsTo(SlackDestination, { as: 'destination', foreignKey: 'destinationId' })
SlackDestination.hasMany(Delivery, { as: 'deliveries', foreignKey: 'destinationId' })
