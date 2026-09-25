import type { DestinationDto } from '../../shared/types.js'
import { hintFor } from '../crypto/urlHint.js'
import { Delivery, SlackDestination } from './models.js'

async function toDto(destination: SlackDestination): Promise<DestinationDto> {
  // One extra query per destination, and there are only ever a handful of them.
  const last = await Delivery.findOne({
    where: { destinationId: destination.id },
    order: [['receivedAt', 'DESC']],
  })

  return {
    id: destination.id,
    label: destination.label,
    urlHint: destination.urlHint,
    createdAt: destination.createdAt.toISOString(),
    lastOutcome: last?.outcome ?? null,
    lastDeliveryAt: last?.receivedAt.toISOString() ?? null,
  }
}

export async function listDestinations(): Promise<DestinationDto[]> {
  const destinations = await SlackDestination.findAll({ order: [['label', 'ASC']] })
  return Promise.all(destinations.map(toDto))
}

export async function createDestination(
  label: string,
  webhookUrl: string,
): Promise<DestinationDto> {
  const destination = await SlackDestination.create({
    label,
    webhookUrl,
    urlHint: hintFor(webhookUrl),
  })
  return toDto(destination)
}

export async function deleteDestination(id: number): Promise<void> {
  await SlackDestination.destroy({ where: { id } })
}

/** The hook itself — callers must not log it or return it to the client. */
export async function getWebhookUrl(id: number): Promise<string | null> {
  const destination = await SlackDestination.findByPk(id, { attributes: ['webhookUrl'] })
  return destination?.webhookUrl ?? null
}

export async function getDestinationLabel(id: number): Promise<string | null> {
  const destination = await SlackDestination.findByPk(id, { attributes: ['label'] })
  return destination?.label ?? null
}
