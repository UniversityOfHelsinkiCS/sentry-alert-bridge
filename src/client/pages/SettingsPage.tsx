import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import { useState } from 'react'
import type { IngestMode } from '../../shared/types'
import { api, useApi } from '../api'
import { errorMessage, useToast } from '../useToast'

export default function SettingsPage() {
  const settings = useApi(() => api.settings(), [])
  const { show, toast } = useToast()
  const [busy, setBusy] = useState(false)

  const change = async (mode: IngestMode | null) => {
    if (!mode || mode === settings.data?.ingestMode) return
    setBusy(true)
    try {
      settings.setData(await api.setIngestMode(mode))
      show(`switched to ${mode} mode`)
    } catch (err) {
      show(errorMessage(err), 'error')
    } finally {
      setBusy(false)
    }
  }

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

  if (settings.loading || !settings.data) return <Skeleton variant="rectangular" height={280} />

  const s = settings.data
  const webhookUrl = `${window.location.origin}${s.webhookPath}`

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5">Settings</Typography>
        <Typography variant="body2" color="text.secondary">
          How issues reach this bridge. The setting is global and takes effect immediately.
        </Typography>
      </Box>

      {settings.error && <Alert severity="error">{settings.error}</Alert>}

      <Paper variant="outlined" sx={{ p: 3 }}>
        <Stack spacing={2}>
          <ToggleButtonGroup
            exclusive
            value={s.ingestMode}
            onChange={(_e, value: IngestMode | null) => change(value)}
            disabled={busy}
          >
            <ToggleButton value="polling" disabled={!s.pollingAvailable}>
              Polling
            </ToggleButton>
            <ToggleButton value="webhook" disabled={!s.webhookAvailable}>
              Webhook
            </ToggleButton>
          </ToggleButtonGroup>

          <Typography variant="body2" color="text.secondary">
            {s.ingestMode === 'polling'
              ? `Asking the Sentry API for new issues every ${s.pollIntervalMinutes} minutes. Needs no inbound network access.`
              : 'Sentry pushes issues to this app as they happen. Needs the webhook URL below set on the integration, and a publicly reachable host.'}
          </Typography>

          {!s.pollingAvailable && (
            <Alert severity="warning">
              Polling is unavailable: SENTRY_AUTH_TOKEN is not set.
            </Alert>
          )}
          {!s.webhookAvailable && (
            <Alert severity="warning">
              Webhook mode is unavailable: SENTRY_CLIENT_SECRET is not set.
            </Alert>
          )}
        </Stack>
      </Paper>

      {s.ingestMode === 'polling' && (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Typography variant="subtitle1">Polling</Typography>
            <Typography variant="body2" color="text.secondary">
              Interval: every {s.pollIntervalMinutes} minutes (POLL_INTERVAL_MINUTES).
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
      )}

      {s.ingestMode === 'webhook' && (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Typography variant="subtitle1">Webhook URL</Typography>
            <Typography variant="body2" color="text.secondary">
              Paste this into the Webhook URL field of the Sentry internal integration, and tick
              the <strong>Issue</strong> resource.
            </Typography>
            <Stack direction="row" spacing={1}>
              <TextField size="small" fullWidth value={webhookUrl} slotProps={{ input: { readOnly: true } }} />
              <Button
                onClick={() => {
                  void navigator.clipboard.writeText(webhookUrl)
                  show('copied')
                }}
              >
                Copy
              </Button>
            </Stack>
          </Stack>
        </Paper>
      )}

      {toast}
    </Stack>
  )
}
