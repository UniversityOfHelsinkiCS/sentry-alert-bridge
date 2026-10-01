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
import { useOrg } from '../OrgContext'
import { errorMessage, useToast } from '../useToast'
import { OutcomeChip } from './DeliveriesPage'

export default function DestinationsPage() {
  const org = useOrg()
  const destinations = useApi(() => api.destinations(org), [org])
  const { show, toast } = useToast()

  const [editing, setEditing] = useState<DestinationDto | 'new' | null>(null)
  const [label, setLabel] = useState('')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<DestinationDto | null>(null)
  const [testing, setTesting] = useState<number | null>(null)

  const openAdd = () => {
    setFormError(null)
    setLabel('')
    setWebhookUrl('')
    setEditing('new')
  }

  const openEdit = (destination: DestinationDto) => {
    setFormError(null)
    setLabel(destination.label)
    setWebhookUrl(destination.webhookUrl)
    setEditing(destination)
  }

  const save = async () => {
    if (!editing) return
    setFormError(null)
    try {
      if (editing === 'new') {
        await api.addDestination(org, label.trim(), webhookUrl.trim())
      } else {
        await api.updateDestination(editing.id, label.trim(), webhookUrl.trim())
      }
      setEditing(null)
      setLabel('')
      setWebhookUrl('')
      destinations.reload()
      show(editing === 'new' ? 'destination added' : 'destination updated')
    } catch (err) {
      setFormError(errorMessage(err))
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
            One Slack incoming webhook per channel. Both the label and the URL can be edited
            later without disturbing the projects routed here.
          </Typography>
        </Box>
        <Button variant="contained" onClick={openAdd}>
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
                  <Button size="small" onClick={() => openEdit(d)}>
                    Edit
                  </Button>
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

      <Dialog open={editing !== null} onClose={() => setEditing(null)} fullWidth maxWidth="sm">
        <DialogTitle>
          {editing === 'new' ? 'Add a Slack destination' : `Edit ${editing?.label ?? ''}`}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {formError && <Alert severity="error">{formError}</Alert>}
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
              helperText="From Slack: Incoming Webhooks → Add New Webhook to Workspace."
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={save}
            disabled={label.trim().length === 0 || webhookUrl.trim().length === 0}
          >
            {editing === 'new' ? 'Add' : 'Save'}
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
