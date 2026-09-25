import type { DeliveryDto, DeliveryOutcome, IngestSource } from '../../shared/types.js'
import { Delivery, Route, SlackDestination } from './models.js'

export interface RecordDelivery {
  source: IngestSource
  projectSlug?: string | null
  issueTitle?: string | null
  issueUrl?: string | null
  destinationId?: number | null
  outcome: DeliveryOutcome
  detail?: string | null
}

export async function recordDelivery(d: RecordDelivery): Promise<void> {
  await Delivery.create({
    source: d.source,
    projectSlug: d.projectSlug ?? null,
    issueTitle: d.issueTitle ?? null,
    issueUrl: d.issueUrl ?? null,
    destinationId: d.destinationId ?? null,
    outcome: d.outcome,
    detail: d.detail ?? null,
  })
}

export async function listDeliveries(limit: number): Promise<DeliveryDto[]> {
  const rows = await Delivery.findAll({
    include: [
      { model: SlackDestination, as: 'destination', required: false, attributes: ['label'] },
    ],
    order: [
      ['receivedAt', 'DESC'],
      ['id', 'DESC'],
    ],
    limit,
  })

  return rows.map((row) => ({
    id: String(row.id),
    receivedAt: row.receivedAt.toISOString(),
    source: row.source,
    projectSlug: row.projectSlug,
    issueTitle: row.issueTitle,
    issueUrl: row.issueUrl,
    destinationId: row.destinationId,
    destinationLabel: row.destination?.label ?? null,
    outcome: row.outcome,
    detail: row.detail,
  }))
}

export async function countRoutesUsing(destinationId: number): Promise<number> {
  return Route.count({ where: { destinationId } })
}
