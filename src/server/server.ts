import cookieParser from 'cookie-parser'
import express, { type Express, type NextFunction, type Request, type Response } from 'express'
import { pinoHttp } from 'pino-http'
import { config } from './config.js'
import { logger } from './logger.js'
import { apiRouter } from './routes/api.js'
import { authRouter } from './routes/auth.js'
import { spaRouter } from './routes/spa.js'
import { webhookRouter } from './routes/webhook.js'

export function createApp(): Express {
  const app = express()

  // One hop, the ingress. `true` would trust any X-Forwarded-For the client
  // sends, which puts a forged address into req.ip and into the logs.
  app.set('trust proxy', 1)
  app.use(pinoHttp({ logger }))
  app.use(cookieParser())

  // Mounted before express.json so it keeps the raw signed bytes.
  app.use(webhookRouter)

  app.use(express.json({ limit: '1mb' }))
  app.use('/api', authRouter)
  app.use('/api', apiRouter)

  if (config.isProduction) app.use(spaRouter())

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'not found' })
  })

  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    req.log.error({ err }, 'unhandled error')
    if (res.headersSent) return
    res.status(500).json({ error: 'internal error' })
  })

  return app
}
