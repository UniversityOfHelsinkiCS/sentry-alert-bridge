import { SeenIssue } from './models.js'

/**
 * Claims an issue for alerting. Returns true the first time an issue is seen
 * and false ever after, which is the polling dedup — each tick re-reads an
 * overlapping window.
 */
export async function claimIssue(projectSlug: string, issueId: string): Promise<boolean> {
  const [, created] = await SeenIssue.findOrCreate({
    where: { projectSlug, issueId },
    defaults: { projectSlug, issueId },
  })
  return created
}

/** Lets a failed send be retried on the next tick rather than being swallowed. */
export async function releaseIssue(projectSlug: string, issueId: string): Promise<void> {
  await SeenIssue.destroy({ where: { projectSlug, issueId } })
}
