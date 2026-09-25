import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import Paper from '@mui/material/Paper'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useState } from 'react'
import type { DestinationDto } from '../../shared/types'
import { api, useApi } from '../api'
import { errorMessage, useToast } from '../useToast'
import { OutcomeChip } from './DeliveriesPage'

export default function DestinationsPage() {
  const destinations = useApi(() => api.destinations(), [])
  const { show, toast } = useToast()

  const [adding, setAdding] = useState(false)
  const [label, setLabel] = useState('')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<DestinationDto | null>(null)
  const [testing, setTesting] = useState<number | null>(null)

  const add = async () => {
    setAddError(null)
    try {
      await api.addDestination(label.trim(), webhookUrl.trim())
      setAdding(false)
      setLabel('')
      setWebhookUrl('')
      destinations.reload()
      show('destination added')
    } catch (err) {
      setAddError(errorMessage(err))
    }
  }

  const test = async (id: number) => {
    setTesting(id)
    try {
      await api.testDestination(id)
      show('test alert sent — check the channel')
      destinations.reload()
    } catch (err) {
      show(errorMessage(err), 'error')
      destinations.reload()
    } finally {
      setTesting(null)
    }
  }

  const remove = async (destination: DestinationDto) => {
    try {
      await api.deleteDestination(destination.id)
      show('destination deleted')
      destinations.reload()
    } catch (err) {
      show(errorMessage(err), 'error')
    } finally {
      setPendingDelete(null)
    }
  }

  if (destinations.loading) return <Skeleton variant="rectangular" height={280} />

  const rows = destinations.data ?? []

  return (
    <Stack spacing={3}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
        <Box>
          <Typography variant="h5">Destinations</Typography>
          <Typography variant="body2" color="text.secondary">
            One Slack incoming webhook per channel. The URL is never shown again — replace the
            destination to change it.
          </Typography>
        </Box>
        <Button variant="contained" onClick={() => setAdding(true)}>
          Add destination
        </Button>
      </Stack>

      {destinations.error && <Alert severity="error">{destinations.error}</Alert>}

      <Paper variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Label</TableCell>
              <TableCell>Webhook</TableCell>
              <TableCell>Last delivery</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={4}>
                  <Typography variant="body2" color="text.secondary">
                    No destinations yet.
                  </Typography>
                </TableCell>
              </TableRow>
            )}

            {rows.map((d) => (
              <TableRow key={d.id} hover>
                <TableCell>{d.label}</TableCell>
                <TableCell>
                  <Typography variant="caption" fontFamily="monospace">
                    {d.webhookUrl}
                  </Typography>
                </TableCell>
                <TableCell>
                  {d.lastOutcome ? (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <OutcomeChip outcome={d.lastOutcome} />
                      <Typography variant="caption" color="text.secondary">
                        {d.lastDeliveryAt && new Date(d.lastDeliveryAt).toLocaleString()}
                      </Typography>
                    </Stack>
                  ) : (
                    <Chip size="small" variant="outlined" label="never used" />
                  )}
                </TableCell>
                <TableCell align="right">
                  <Button size="small" onClick={() => test(d.id)} disabled={testing === d.id}>
                    {testing === d.id ? 'Sending…' : 'Test'}
                  </Button>
                  <Button size="small" color="error" onClick={() => setPendingDelete(d)}>
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={adding} onClose={() => setAdding(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add a Slack destination</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {addError && <Alert severity="error">{addError}</Alert>}
            <TextField
              label="Label"
              placeholder="#backend-alerts"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              fullWidth
              autoFocus
            />
            <TextField
              label="Slack incoming webhook URL"
              type="password"
              helperText="From Slack: Incoming Webhooks → Add New Webhook to Workspace. Never shown again."
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAdding(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={add}
            disabled={label.trim().length === 0 || webhookUrl.trim().length === 0}
          >
            Add
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={pendingDelete !== null} onClose={() => setPendingDelete(null)}>
        <DialogTitle>Delete {pendingDelete?.label}?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            The webhook URL is deleted with it and cannot be recovered. If any project still routes
            here, the delete is refused — reroute those projects first.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingDelete(null)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => pendingDelete && remove(pendingDelete)}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {toast}
    </Stack>
  )
}
