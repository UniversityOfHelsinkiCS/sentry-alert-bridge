import { createHmac } from 'node:crypto'
import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const handleIssue = vi.fn(async () => 'sent' as const)
const recordDelivery = vi.fn(async () => undefined)

vi.mock('../ingest/index.js', () => ({ handleIssue }))
vi.mock('../db/deliveries.js', () => ({ recordDelivery }))
vi.mock('../ingest/mode.js', () => ({ currentIngestMode: () => 'webhook' }))

const { webhookRouter, WEBHOOK_PATH } = await import('./webhook.js')
const { config } = await import('../config.js')

const app = express().use(webhookRouter)

const payload = {
  action: 'created',
  data: {
    issue: {
      id: 1234,
      title: 'TypeError: boom',
      level: 'error',
      shortId: 'BACKEND-1',
      web_url: 'https://toska.it.helsinki.fi/issues/1234/',
      project: { slug: 'backend', name: 'Backend' },
    },
  },
}

function post(body: unknown, opts: { signature?: string; resource?: string } = {}) {
  const raw = JSON.stringify(body)
  const signature =
    opts.signature ??
    createHmac('sha256', config.SENTRY_CLIENT_SECRET!).update(raw).digest('hex')

  return request(app)
    .post(WEBHOOK_PATH)
    .set('content-type', 'application/json')
    .set('sentry-hook-resource', opts.resource ?? 'issue')
    .set('sentry-hook-signature', signature)
    .send(raw)
}

describe(`POST ${WEBHOOK_PATH}`, () => {
  beforeEach(() => {
    handleIssue.mockClear()
    recordDelivery.mockClear()
  })

  it('accepts a correctly signed issue.created and hands it to the pipeline', async () => {
    const res = await post(payload)

    expect(res.status).toBe(200)
    expect(handleIssue).toHaveBeenCalledWith(
      expect.objectContaining({ id: '1234', projectSlug: 'backend', title: 'TypeError: boom' }),
      'webhook',
    )
  })

  it('rejects a bad signature without touching the pipeline', async () => {
    const res = await post(payload, { signature: 'deadbeef' })

    expect(res.status).toBe(401)
    expect(handleIssue).not.toHaveBeenCalled()
  })

  it('ignores resources other than issue', async () => {
    const res = await post(payload, { resource: 'error' })

    expect(res.status).toBe(202)
    expect(handleIssue).not.toHaveBeenCalled()
  })

  it('records a skip for an action other than created', async () => {
    const res = await post({ ...payload, action: 'resolved' })

    expect(res.status).toBe(202)
    expect(handleIssue).not.toHaveBeenCalled()
    expect(recordDelivery).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'skipped', projectSlug: 'backend' }),
    )
  })

  it('rejects a payload that is not an issue event', async () => {
    const res = await post({ action: 'created', data: {} })

    expect(res.status).toBe(400)
    expect(handleIssue).not.toHaveBeenCalled()
  })

  it('still answers 200 when the pipeline throws, so Sentry keeps the integration enabled', async () => {
    handleIssue.mockRejectedValueOnce(new Error('database is down'))

    const res = await post(payload)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ result: 'failed' })
  })
})
