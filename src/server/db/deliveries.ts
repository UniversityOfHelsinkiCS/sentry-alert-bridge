import type { DeliveryDto, DeliveryOutcome, IngestSource } from '../../shared/types.js'
import { query } from './pool.js'

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
  await query(
    `insert into deliveries
       (source, project_slug, issue_title, issue_url, destination_id, outcome, detail)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [
      d.source,
      d.projectSlug ?? null,
      d.issueTitle ?? null,
      d.issueUrl ?? null,
      d.destinationId ?? null,
      d.outcome,
      d.detail ?? null,
    ],
  )
}

interface DeliveryRow {
  id: string
  received_at: Date
  source: IngestSource
  project_slug: string | null
  issue_title: string | null
  issue_url: string | null
  destination_id: number | null
  destination_label: string | null
  outcome: DeliveryOutcome
  detail: string | null
}

export async function listDeliveries(limit: number): Promise<DeliveryDto[]> {
  const { rows } = await query<DeliveryRow>(
    `select d.id, d.received_at, d.source, d.project_slug, d.issue_title, d.issue_url,
            d.destination_id, s.label as destination_label, d.outcome, d.detail
       from deliveries d
       left join slack_destinations s on s.id = d.destination_id
      order by d.received_at desc, d.id desc
      limit $1`,
    [limit],
  )

  return rows.map((row) => ({
    id: String(row.id),
    receivedAt: row.received_at.toISOString(),
    source: row.source,
    projectSlug: row.project_slug,
    issueTitle: row.issue_title,
    issueUrl: row.issue_url,
    destinationId: row.destination_id,
    destinationLabel: row.destination_label,
    outcome: row.outcome,
    detail: row.detail,
  }))
}

export async function countRoutesUsing(destinationId: number): Promise<number> {
  const { rows } = await query<{ count: string }>(
    'select count(*)::text as count from routes where destination_id = $1',
    [destinationId],
  )
  return Number(rows[0]?.count ?? 0)
}
