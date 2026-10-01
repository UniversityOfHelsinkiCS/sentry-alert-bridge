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
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useState } from 'react'
import type { OrgDto } from '../../shared/types'
import { api } from '../api'
import { useOrgState } from '../OrgContext'
import { errorMessage, useToast } from '../useToast'

export default function OrgsPage() {
  const { orgs, reloadOrgs } = useOrgState()
  const { show, toast } = useToast()

  const [editing, setEditing] = useState<OrgDto | 'new' | null>(null)
  const [slug, setSlug] = useState('')
  const [name, setName] = useState('')
  const [authToken, setAuthToken] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<OrgDto | null>(null)
  const [testing, setTesting] = useState<string | null>(null)

  const openAdd = () => {
    setFormError(null)
    setSlug('')
    setName('')
    setAuthToken('')
    setBaseUrl('')
    setEditing('new')
  }

  const openEdit = (org: OrgDto) => {
    setFormError(null)
    setSlug(org.slug)
    setName(org.name ?? '')
    setAuthToken('')
    setBaseUrl(org.baseUrl ?? '')
    setEditing(org)
  }

  const save = async () => {
    if (!editing) return
    setFormError(null)
    const input = {
      name: name.trim() === '' ? null : name.trim(),
      baseUrl: baseUrl.trim() === '' ? null : baseUrl.trim(),
      ...(authToken.trim() === '' ? {} : { authToken: authToken.trim() }),
    }

    try {
      if (editing === 'new') {
        await api.addOrg({ slug: slug.trim(), ...input })
      } else {
        await api.updateOrg(editing.slug, input)
      }
      setEditing(null)
      reloadOrgs()
      show(editing === 'new' ? 'organisation added' : 'organisation updated')
    } catch (err) {
      setFormError(errorMessage(err))
    }
  }

  const test = async (org: OrgDto) => {
    setTesting(org.slug)
    try {
      const result = await api.testOrg(org.slug)
      show(`${org.slug}: Sentry returned ${result.projects} projects`)
    } catch (err) {
      show(errorMessage(err), 'error')
    } finally {
      setTesting(null)
    }
  }

  const remove = async (org: OrgDto) => {
    try {
      await api.deleteOrg(org.slug)
      reloadOrgs()
      show('organisation deleted')
    } catch (err) {
      show(errorMessage(err), 'error')
    } finally {
      setPendingDelete(null)
    }
  }

  const canSave =
    editing === 'new'
      ? slug.trim().length > 0 && authToken.trim().length > 0
      : editing !== null

  return (
    <Stack spacing={3}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
        <Box>
          <Typography variant="h5">Organisations</Typography>
          <Typography variant="body2" color="text.secondary">
            One Sentry organisation per row, each with its own auth token. Everything else in this
            app is scoped to the organisation picked in the bar above.
          </Typography>
        </Box>
        <Button variant="contained" onClick={openAdd}>
          Add organisation
        </Button>
      </Stack>

      <Paper variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Slug</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Sentry</TableCell>
              <TableCell align="right">Projects</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {orgs.length === 0 && (
              <TableRow>
                <TableCell colSpan={5}>
                  <Typography variant="body2" color="text.secondary">
                    No organisations yet — add one to start polling.
                  </Typography>
                </TableCell>
              </TableRow>
            )}

            {orgs.map((org) => (
              <TableRow key={org.slug} hover>
                <TableCell>{org.slug}</TableCell>
                <TableCell>{org.name ?? '—'}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="caption" fontFamily="monospace">
                      {org.baseUrl ?? 'default'}
                    </Typography>
                    {!org.hasToken && <Chip size="small" color="error" label="no token" />}
                  </Stack>
                </TableCell>
                <TableCell align="right">{org.projectCount}</TableCell>
                <TableCell align="right">
                  <Button size="small" onClick={() => openEdit(org)}>
                    Edit
                  </Button>
                  <Button
                    size="small"
                    onClick={() => test(org)}
                    disabled={testing === org.slug}
                  >
                    {testing === org.slug ? 'Testing…' : 'Test'}
                  </Button>
                  <Button size="small" color="error" onClick={() => setPendingDelete(org)}>
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
          {editing === 'new' ? 'Add a Sentry organisation' : `Edit ${editing?.slug ?? ''}`}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {formError && <Alert severity="error">{formError}</Alert>}
            <TextField
              label="Organisation slug"
              placeholder="sentry"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              disabled={editing !== 'new'}
              helperText={
                editing === 'new'
                  ? 'As it appears in the Sentry URL.'
                  : 'The slug cannot be changed; delete and re-add instead.'
              }
              fullWidth
              autoFocus
            />
            <TextField
              label="Display name (optional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
            />
            <TextField
              label="Auth token"
              value={authToken}
              onChange={(e) => setAuthToken(e.target.value)}
              helperText={
                editing === 'new'
                  ? 'An internal integration token with issue read and event:write.'
                  : 'Token stored — leave blank to keep the current one.'
              }
              fullWidth
            />
            <TextField
              label="Sentry base URL (optional)"
              placeholder="https://toska.it.helsinki.fi"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              helperText="Leave blank to use SENTRY_BASE_URL."
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)}>Cancel</Button>
          <Button variant="contained" onClick={save} disabled={!canSave}>
            {editing === 'new' ? 'Add' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={pendingDelete !== null} onClose={() => setPendingDelete(null)}>
        <DialogTitle>Delete {pendingDelete?.slug}?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            The stored auth token is deleted with it. If the organisation still has routed projects
            or destinations, the delete is refused — remove those first.
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
