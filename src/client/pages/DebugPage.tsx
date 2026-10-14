import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useState } from 'react'
import type { SentryDebugDto } from '../../shared/types'
import { api } from '../api'
import { useOrg } from '../OrgContext'
import { errorMessage, useToast } from '../useToast'
import RawJsonView from './RawJsonView'
import SentryCallForm, { type SentryCallFields } from './SentryCallForm'

const INITIAL_FIELDS: SentryCallFields = {
  call: 'issues',
  project: '',
  issueId: '',
  limit: '25',
}

export default function DebugPage() {
  const org = useOrg()
  const { show, toast } = useToast()
  const [fields, setFields] = useState<SentryCallFields>(INITIAL_FIELDS)
  const [result, setResult] = useState<SentryDebugDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)

  const run = async () => {
    setRunning(true)
    setError(null)
    try {
      const next = await api.debugSentry(org, fields.call, {
        project: fields.project.trim() || undefined,
        issueId: fields.issueId.trim() || undefined,
        limit: fields.limit.trim() || undefined,
      })
      setResult(next)
    } catch (err) {
      setResult(null)
      setError(errorMessage(err))
    } finally {
      setRunning(false)
    }
  }

  const copy = (text: string) => {
    void navigator.clipboard.writeText(text)
    show('Copied the raw response')
  }

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5">Debug</Typography>
        <Typography variant="body2" color="text.secondary">
          Fires a Sentry API call as {org} and shows the untouched response, so you can see what
          Sentry actually returns before this bridge normalises it.
        </Typography>
      </Box>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <SentryCallForm fields={fields} onChange={setFields} onRun={() => void run()} running={running} />
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}
      {result && <RawJsonView result={result} onCopy={copy} />}

      {toast}
    </Stack>
  )
}
