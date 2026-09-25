/**
 * A recognisable but non-reusable fragment of a Slack hook URL, for the UI.
 * Keeps the last two path segments before the secret and masks all but the last
 * four characters of the secret itself.
 */
export function hintFor(webhookUrl: string): string {
  const parts = webhookUrl.split('/').filter(Boolean)
  const tail = parts.slice(-3)
  const secret = tail.at(-1) ?? ''
  const masked = secret.length > 4 ? `…${secret.slice(-4)}` : '…'
  return [...tail.slice(0, -1), masked].join('/')
}
