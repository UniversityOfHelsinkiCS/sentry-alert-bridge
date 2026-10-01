import type { DestinationDto } from '../../shared/types.js'
import { Delivery, SlackDestination } from './model/index.js'

async function toDto(destination: SlackDestination): Promise<DestinationDto> {
  const last = await Delivery.findOne({
    where: { destinationId: destination.id },
    order: [['receivedAt', 'DESC']],
  })

  return {
    id: destination.id,
    orgSlug: destination.orgSlug,
    label: destination.label,
    webhookUrl: destination.webhookUrl,
    createdAt: destination.createdAt.toISOString(),
    lastOutcome: last?.outcome ?? null,
    lastDeliveryAt: last?.receivedAt.toISOString() ?? null,
  }
}

export async function listDestinations(orgSlug: string): Promise<DestinationDto[]> {
  const destinations = await SlackDestination.findAll({
    where: { orgSlug },
    order: [['label', 'ASC']],
  })
  return Promise.all(destinations.map(toDto))
}

export async function createDestination(
  orgSlug: string,
  label: string,
  webhookUrl: string,
): Promise<DestinationDto> {
  const destination = await SlackDestination.create({ orgSlug, label, webhookUrl })
  return toDto(destination)
}

export async function updateDestination(
  id: number,
  label: string,
  webhookUrl: string,
): Promise<DestinationDto | null> {
  const destination = await SlackDestination.findByPk(id)
  if (!destination) return null
  await destination.update({ label, webhookUrl })
  return toDto(destination)
}

export async function deleteDestination(id: number): Promise<void> {
  await SlackDestination.destroy({ where: { id } })
}

export async function getWebhookUrl(id: number): Promise<string | null> {
  const destination = await SlackDestination.findByPk(id, { attributes: ['webhookUrl'] })
  return destination?.webhookUrl ?? null
}

export async function getDestinationLabel(id: number): Promise<string | null> {
  const destination = await SlackDestination.findByPk(id, { attributes: ['label'] })
  return destination?.label ?? null
}

export async function getDestinationOrg(id: number): Promise<string | null> {
  const destination = await SlackDestination.findByPk(id, { attributes: ['orgSlug'] })
  return destination?.orgSlug ?? null
}
