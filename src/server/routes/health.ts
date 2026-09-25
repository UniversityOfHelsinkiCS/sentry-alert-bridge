import { Router } from 'express'
import { config } from '../config.js'
import { query } from '../db/pool.js'

export const healthRouter: Router = Router()

healthRouter.get('/healthz', async (_req, res) => {
  try {
    await query('select 1')
  } catch (err) {
    res.status(503).json({
      status: 'error',
      database: err instanceof Error ? err.message : 'unreachable',
    })
    return
  }

  res.json({
    status: 'ok',
    releaseVersion: config.RELEASE_VERSION ?? null,
    gitSha: config.GIT_SHA ?? config.IMAGE_SHA ?? null,
  })
})
