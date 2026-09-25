import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useState } from 'react'
import { api, useApi } from '../api'
import { errorMessage, useToast } from '../useToast'

export default function SettingsPage() {
  const settings = useApi(() => api.settings(), [])
  const { show, toast } = useToast()
  const [busy, setBusy] = useState(false)

  const pollNow = async () => {
    setBusy(true)
    try {
      const summary = await api.pollNow()
      show(`polled ${summary.polled ?? 0} projects, sent ${summary.sent ?? 0}`)
      settings.reload()
    } catch (err) {
      show(errorMessage(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  if (settings.loading || !settings.data) return <Skeleton variant="rectangular" height={200} />

  const s = settings.data

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5">Settings</Typography>
        <Typography variant="body2" color="text.secondary">
          How issues reach this bridge.
        </Typography>
      </Box>

      {settings.error && <Alert severity="error">{settings.error}</Alert>}

      <Paper variant="outlined" sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="subtitle1">Polling</Typography>
          <Typography variant="body2" color="text.secondary">
            Asking the Sentry API for new issues every {s.pollIntervalMinutes} minutes
            (POLL_INTERVAL_MINUTES). Needs no inbound network access.
            <br />
            Last poll: {s.lastPollAt ? new Date(s.lastPollAt).toLocaleString() : 'never'}.
          </Typography>
          <Box>
            <Button variant="outlined" onClick={pollNow} disabled={busy}>
              {busy ? 'Polling…' : 'Poll now'}
            </Button>
          </Box>
        </Stack>
      </Paper>

      {toast}
    </Stack>
  )
}
