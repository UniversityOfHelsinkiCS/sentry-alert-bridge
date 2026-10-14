import Button from '@mui/material/Button'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import type { SentryDebugCall } from '../../shared/types'

const CALL_LABELS: Record<SentryDebugCall, string> = {
  projects: 'Projects list',
  issues: 'Issues list',
  event: 'Latest event',
}

export interface SentryCallFields {
  call: SentryDebugCall
  project: string
  issueId: string
  limit: string
}

interface Props {
  fields: SentryCallFields
  onChange: (fields: SentryCallFields) => void
  onRun: () => void
  running: boolean
}

export default function SentryCallForm({ fields, onChange, onRun, running }: Props) {
  const set = (patch: Partial<SentryCallFields>) => onChange({ ...fields, ...patch })
  const needsProject = fields.call === 'issues'
  const needsIssueId = fields.call === 'event'

  return (
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="flex-start">
      <TextField
        select
        label="Call"
        size="small"
        value={fields.call}
        onChange={(e) => set({ call: e.target.value as SentryDebugCall })}
        sx={{ minWidth: 200 }}
      >
        {Object.entries(CALL_LABELS).map(([value, label]) => (
          <MenuItem key={value} value={value}>
            {label}
          </MenuItem>
        ))}
      </TextField>

      {needsProject && (
        <TextField
          label="Project slug"
          size="small"
          value={fields.project}
          onChange={(e) => set({ project: e.target.value })}
          placeholder="backend"
        />
      )}

      {needsProject && (
        <TextField
          label="Limit"
          size="small"
          value={fields.limit}
          onChange={(e) => set({ limit: e.target.value })}
          sx={{ width: 120 }}
        />
      )}

      {needsIssueId && (
        <TextField
          label="Issue id"
          size="small"
          value={fields.issueId}
          onChange={(e) => set({ issueId: e.target.value })}
          placeholder="2884"
        />
      )}

      <Button variant="contained" onClick={onRun} disabled={running}>
        {running ? 'Running…' : 'Run call'}
      </Button>
    </Stack>
  )
}
