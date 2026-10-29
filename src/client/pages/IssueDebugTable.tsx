import Chip from '@mui/material/Chip'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import { memo } from 'react'
import type { IssueVerdict, ProjectIssueDto } from '../../shared/types'

const VERDICTS: Record<
  IssueVerdict,
  { label: string; color: 'success' | 'default' | 'warning'; why: string }
> = {
  alert: {
    label: 'would alert',
    color: 'success',
    why: 'Seen again since the last alert, and out of cooldown.',
  },
  'before-start': {
    label: 'before start',
    color: 'default',
    why: 'Its last event predates this route’s start time, so it counts as history.',
  },
  'no-new-events': {
    label: 'nothing new',
    color: 'default',
    why: 'Not seen again since this app last alerted on it.',
  },
  'in-cooldown': {
    label: 'in cooldown',
    color: 'warning',
    why: 'It has fired again, but too soon after the last alert.',
  },
  recap: {
    label: 'recap',
    color: 'default',
    why: 'Matches a recap rule, so it waits for this project’s next recap instead of alerting.',
  },
  unknown: {
    label: 'no last seen',
    color: 'warning',
    why: 'Sentry returned no usable lastSeen, so there is nothing to compare.',
  },
}

const IssueDebugRow = memo(function IssueDebugRow({ issue }: { issue: ProjectIssueDto }) {
  return (
    <TableRow>
      <TableCell>
        <Typography variant="body2">
          {issue.url ? (
            <a href={issue.url} target="_blank" rel="noreferrer">
              {issue.title}
            </a>
          ) : (
            issue.title
          )}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {issue.shortId ?? issue.id}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="caption">
          {issue.firstSeen ? new Date(issue.firstSeen).toLocaleString() : '—'}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="caption">
          {issue.lastSeen ? new Date(issue.lastSeen).toLocaleString() : '—'}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="caption">
          {issue.alertedAt ? new Date(issue.alertedAt).toLocaleString() : 'never'}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="caption">
          {issue.alertedAt ? `${issue.cooldownMinutes} min` : '—'}
        </Typography>
      </TableCell>
      <TableCell align="right">
        <Chip
          size="small"
          label={VERDICTS[issue.verdict].label}
          color={VERDICTS[issue.verdict].color}
          title={VERDICTS[issue.verdict].why}
        />
      </TableCell>
    </TableRow>
  )
})

export function IssueDebugTable({ issues }: { issues: ProjectIssueDto[] }) {
  return (
    <Table size="small" sx={{ mt: 1 }}>
      <TableHead>
        <TableRow>
          <TableCell>Issue</TableCell>
          <TableCell>First seen</TableCell>
          <TableCell>Last seen</TableCell>
          <TableCell>Last alerted</TableCell>
          <TableCell>Cooldown</TableCell>
          <TableCell align="right">Verdict</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {issues.map((issue) => (
          <IssueDebugRow key={issue.id} issue={issue} />
        ))}
      </TableBody>
    </Table>
  )
}
