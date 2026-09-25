import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express, { Router } from 'express'
import { logger } from '../logger.js'

// dist/server/routes/spa.js -> dist/client
const clientDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../client',
)

/**
 * Serves the built SPA with an index.html fallback so client-side routes
 * survive a reload. In development Vite serves the client instead.
 */
export function spaRouter(): Router {
  const router = Router()

  if (!existsSync(clientDir)) {
    logger.warn({ clientDir }, 'no built client found; run npm run build:client')
    return router
  }

  router.use(express.static(clientDir, { index: false }))
  router.get('*', (_req, res) => {
    res.sendFile(path.join(clientDir, 'index.html'))
  })

  return router
}
