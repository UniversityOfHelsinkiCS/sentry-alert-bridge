import { query } from './pool.js'

/**
 * Claims an issue for alerting. Returns true the first time an issue is seen
 * and false ever after, which is both the polling dedup (each tick re-reads an
 * overlapping window) and the guard against double-alerting when the ingest
 * mode is switched.
 */
export async function claimIssue(projectSlug: string, issueId: string): Promise<boolean> {
  const { rowCount } = await query(
    `insert into seen_issues (project_slug, issue_id)
     values ($1, $2)
     on conflict do nothing`,
    [projectSlug, issueId],
  )
  return rowCount === 1
}

/** Lets a failed send be retried on the next tick rather than being swallowed. */
export async function releaseIssue(projectSlug: string, issueId: string): Promise<void> {
  await query('delete from seen_issues where project_slug = $1 and issue_id = $2', [
    projectSlug,
    issueId,
  ])
}
