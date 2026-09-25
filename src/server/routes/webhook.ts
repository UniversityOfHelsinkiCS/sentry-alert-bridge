import express, { Router } from 'express'
import { config } from '../config.js'
import { recordDelivery } from '../db/deliveries.js'
import { currentIngestMode } from '../ingest/mode.js'
import { handleIssue } from '../ingest/index.js'
import { logger } from '../logger.js'
import { normalizeWebhookIssue, webhookPayloadSchema } from '../sentry/types.js'
import { verifySignature } from '../sentry/verify.js'

export const WEBHOOK_PATH = '/webhooks/sentry'

export const webhookRouter: Router = Router()

// Raw body on this route only: the signature covers the exact bytes Sentry
// sent, so a re-serialized JSON body would never match.
webhookRouter.post(
  WEBHOOK_PATH,
  express.raw({ type: '*/*', limit: '1mb' }),
  async (req, res) => {
    if (currentIngestMode() !== 'webhook') {
      res.status(503).json({ error: 'the app is in polling mode; webhooks are not accepted' })
      return
    }

    if (!config.SENTRY_CLIENT_SECRET) {
      res.status(503).json({ error: 'SENTRY_CLIENT_SECRET is not configured' })
      return
    }

    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from('')
    const signature = req.header('sentry-hook-signature')
    if (!verifySignature(rawBody, signature, config.SENTRY_CLIENT_SECRET)) {
      logger.warn({ ip: req.ip }, 'webhook with a bad signature')
      res.status(401).json({ error: 'invalid signature' })
      return
    }

    if (req.header('sentry-hook-resource') !== 'issue') {
      res.status(202).json({ ignored: 'only the issue resource is handled' })
      return
    }

    let parsed
    try {
      parsed = webhookPayloadSchema.safeParse(JSON.parse(rawBody.toString('utf8')))
    } catch {
      res.status(400).json({ error: 'body is not valid JSON' })
      return
    }

    if (!parsed.success) {
      logger.warn({ issues: parsed.error.issues }, 'unrecognised issue payload')
      res.status(400).json({ error: 'unrecognised issue payload' })
      return
    }

    if (parsed.data.action !== 'created') {
      const issue = normalizeWebhookIssue(parsed.data)
      await recordDelivery({
        source: 'webhook',
        projectSlug: issue.projectSlug,
        issueTitle: issue.title,
        issueUrl: issue.url,
        outcome: 'skipped',
        detail: `action "${parsed.data.action}" is not alerted on`,
      })
      res.status(202).json({ ignored: `action ${parsed.data.action}` })
      return
    }

    // Answer Sentry whatever Slack does — a 5xx here would eventually have
    // Sentry disable the integration.
    try {
      const result = await handleIssue(normalizeWebhookIssue(parsed.data), 'webhook')
      res.status(200).json({ result })
    } catch (err) {
      logger.error({ err }, 'failed to handle webhook issue')
      res.status(200).json({ result: 'failed' })
    }
  },
)
