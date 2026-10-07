import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useEffect, useState } from 'react'
import { MAX_COOLDOWN_MINUTES } from '../../shared/types'
import { api, useApi } from '../api'
import { errorMessage, useToast } from '../useToast'

const BOUNDS = {
  pollIntervalMinutes: { min: 1, max: 1440 },
  alertCooldownMinutes: { min: 0, max: MAX_COOLDOWN_MINUTES },
  retentionDays: { min: 1, max: 3650 },
}

type Field = keyof typeof BOUNDS

export default function SettingsPage() {
  const settings = useApi(() => api.settings(), [])
  const { show, toast } = useToast()
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Record<Field, string>>({
    pollIntervalMinutes: '',
    alertCooldownMinutes: '',
    retentionDays: '',
  })

  useEffect(() => {
    if (!settings.data) return
    setForm({
      pollIntervalMinutes: String(settings.data.pollIntervalMinutes),
      alertCooldownMinutes: String(settings.data.alertCooldownMinutes),
      retentionDays: String(settings.data.retentionDays),
    })
  }, [settings.data])

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

  const parsed = (field: Field): number | null => {
    const value = Number(form[field])
    if (!Number.isInteger(value)) return null
    const { min, max } = BOUNDS[field]
    return value < min || value > max ? null : value
  }

  const values = {
    pollIntervalMinutes: parsed('pollIntervalMinutes'),
    alertCooldownMinutes: parsed('alertCooldownMinutes'),
    retentionDays: parsed('retentionDays'),
  }

  const valid =
    values.pollIntervalMinutes !== null &&
    values.alertCooldownMinutes !== null &&
    values.retentionDays !== null

  const changed =
    settings.data !== undefined &&
    (values.pollIntervalMinutes !== settings.data.pollIntervalMinutes ||
      values.alertCooldownMinutes !== settings.data.alertCooldownMinutes ||
      values.retentionDays !== settings.data.retentionDays)

  const save = async () => {
    if (!valid) return
    setSaving(true)
    try {
      await api.updateSettings({
        pollIntervalMinutes: values.pollIntervalMinutes as number,
        alertCooldownMinutes: values.alertCooldownMinutes as number,
        retentionDays: values.retentionDays as number,
      })
      show('settings saved')
      settings.reload()
    } catch (err) {
      show(errorMessage(err), 'error')
    } finally {
      setSaving(false)
    }
  }

  if (settings.loading || !settings.data) return <Skeleton variant="rectangular" height={200} />

  const s = settings.data

  const field = (name: Field, label: string, helperText: string) => (
    <TextField
      label={label}
      type="number"
      size="small"
      value={form[name]}
      error={form[name] !== '' && parsed(name) === null}
      helperText={helperText}
      onChange={(e) => setForm((f) => ({ ...f, [name]: e.target.value }))}
      inputProps={BOUNDS[name]}
      sx={{ maxWidth: 320 }}
    />
  )

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
            Asking the Sentry API for new issues on a timer; needs no inbound network access. The
            POLL_INTERVAL_MINUTES and ALERT_COOLDOWN_MINUTES env vars only seed these values when
            the database is first created — from then on they are edited here.
            <br />
            Last poll: {s.lastPollAt ? new Date(s.lastPollAt).toLocaleString() : 'never'}.
          </Typography>

          {field('pollIntervalMinutes', 'Poll interval (minutes)', '1–1440.')}
          {field(
            'alertCooldownMinutes',
            'Default re-alert cooldown (minutes)',
            'How long an issue stays quiet after alerting. 0 alerts on every poll that sees new events. A project can override this on the Projects page.',
          )}
          {field(
            'retentionDays',
            'History retention (days)',
            'Deliveries and alert history older than this are deleted from this app at the end of each poll. Nothing in Sentry is touched.',
          )}

          <Stack direction="row" spacing={1}>
            <Button variant="contained" onClick={save} disabled={saving || !valid || !changed}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
            <Button variant="outlined" onClick={pollNow} disabled={busy}>
              {busy ? 'Polling…' : 'Poll now'}
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {toast}
    </Stack>
  )
}
