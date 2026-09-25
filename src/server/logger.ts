import pino from 'pino'
import { config } from './config.js'

export const logger = pino({
  level: config.LOG_LEVEL,
  base: undefined,
  redact: {
    paths: ['req.headers.cookie', 'req.headers.authorization'],
    remove: true,
  },
})
