import type { DestinationDto, DeliveryOutcome } from '../../shared/types.js'
import { hintFor } from '../crypto/urlHint.js'
import { query } from './pool.js'

interface DestinationRow {
  id: number
  label: string
  url_hint: string
  created_at: Date
  last_outcome: DeliveryOutcome | null
  last_delivery_at: Date | null
}

function toDto(row: DestinationRow): DestinationDto {
  return {
    id: row.id,
    label: row.label,
    urlHint: row.url_hint,
    createdAt: row.created_at.toISOString(),
    lastOutcome: row.last_outcome,
    lastDeliveryAt: row.last_delivery_at?.toISOString() ?? null,
  }
}

export async function listDestinations(): Promise<DestinationDto[]> {
  const { rows } = await query<DestinationRow>(`
    select d.id, d.label, d.url_hint, d.created_at,
           last.outcome     as last_outcome,
           last.received_at as last_delivery_at
      from slack_destinations d
      left join lateral (
        select outcome, received_at
          from deliveries
         where destination_id = d.id
         order by received_at desc
         limit 1
      ) last on true
     order by d.label
  `)
  return rows.map(toDto)
}

export async function createDestination(
  label: string,
  webhookUrl: string,
): Promise<DestinationDto> {
  const { rows } = await query<DestinationRow>(
    `insert into slack_destinations (label, webhook_url, url_hint)
     values ($1, $2, $3)
     returning id, label, url_hint, created_at,
               null::text as last_outcome, null::timestamptz as last_delivery_at`,
    [label, webhookUrl, hintFor(webhookUrl)],
  )
  return toDto(rows[0]!)
}

export async function deleteDestination(id: number): Promise<void> {
  await query('delete from slack_destinations where id = $1', [id])
}

/** The hook itself — callers must not log it or return it to the client. */
export async function getWebhookUrl(id: number): Promise<string | null> {
  const { rows } = await query<{ webhook_url: string }>(
    'select webhook_url from slack_destinations where id = $1',
    [id],
  )
  return rows[0]?.webhook_url ?? null
}

export async function getDestinationLabel(id: number): Promise<string | null> {
  const { rows } = await query<{ label: string }>(
    'select label from slack_destinations where id = $1',
    [id],
  )
  return rows[0]?.label ?? null
}
