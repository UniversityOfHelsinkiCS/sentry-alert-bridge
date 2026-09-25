import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Select from '@mui/material/Select'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Switch from '@mui/material/Switch'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { ProjectDto } from '../../shared/types'
import { api, useApi } from '../api'
import { errorMessage, useToast } from '../useToast'

const UNROUTED = ''

export default function RoutingPage() {
  const projects = useApi(() => api.projects(), [])
  const destinations = useApi(() => api.destinations(), [])
  const { show, toast } = useToast()
  const [newSlug, setNewSlug] = useState('')
  const [params] = useSearchParams()

  // Deliveries page deep-links here with ?project=<slug> to highlight a row.
  const highlight = params.get('project')

  const save = async (project: ProjectDto, destinationId: number | null, enabled: boolean) => {
    try {
      const updated =
        destinationId === null
          ? await api.clearRoute(project.slug)
          : await api.setRoute(project.slug, destinationId, enabled)
      projects.setData(updated)
      show(destinationId === null ? `${project.slug} unrouted` : `${project.slug} saved`)
    } catch (err) {
      show(errorMessage(err), 'error')
      projects.reload()
    }
  }

  const addProject = async (event: FormEvent) => {
    event.preventDefault()
    try {
      projects.setData(await api.addProject(newSlug.trim()))
      setNewSlug('')
      show('project added')
    } catch (err) {
      show(errorMessage(err), 'error')
    }
  }

  if (projects.loading || destinations.loading) {
    return <Skeleton variant="rectangular" height={320} />
  }

  const rows = projects.data ?? []
  const dests = destinations.data ?? []

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5">Routing</Typography>
        <Typography variant="body2" color="text.secondary">
          Which Slack destination each Sentry project's new issues go to. Projects appear here
          automatically as they are polled or send a webhook.
        </Typography>
      </Box>

      {projects.error && <Alert severity="error">{projects.error}</Alert>}

      {dests.length === 0 && (
        <Alert severity="info">
          No Slack destinations yet — <Link to="/destinations">add one</Link> before routing
          anything.
        </Alert>
      )}

      <Paper variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Project</TableCell>
              <TableCell width="30%">Destination</TableCell>
              <TableCell align="center">Enabled</TableCell>
              <TableCell align="right">Last seen</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={4}>
                  <Typography variant="body2" color="text.secondary">
                    No projects known yet.
                  </Typography>
                </TableCell>
              </TableRow>
            )}

            {rows.map((project) => (
              <TableRow
                key={project.slug}
                selected={project.slug === highlight}
                hover
              >
                <TableCell>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2">{project.name ?? project.slug}</Typography>
                    {project.name && (
                      <Typography variant="caption" color="text.secondary">
                        {project.slug}
                      </Typography>
                    )}
                    {!project.route && <Chip size="small" label="needs routing" />}
                  </Stack>
                </TableCell>

                <TableCell>
                  <Select
                    size="small"
                    fullWidth
                    displayEmpty
                    value={project.route ? String(project.route.destinationId) : UNROUTED}
                    onChange={(e) =>
                      save(
                        project,
                        e.target.value === UNROUTED ? null : Number(e.target.value),
                        project.route?.enabled ?? true,
                      )
                    }
                  >
                    <MenuItem value={UNROUTED}>
                      <em>Not routed</em>
                    </MenuItem>
                    {dests.map((d) => (
                      <MenuItem key={d.id} value={String(d.id)}>
                        {d.label}
                      </MenuItem>
                    ))}
                  </Select>
                </TableCell>

                <TableCell align="center">
                  <Switch
                    size="small"
                    disabled={!project.route}
                    checked={project.route?.enabled ?? false}
                    onChange={(e) =>
                      project.route && save(project, project.route.destinationId, e.target.checked)
                    }
                  />
                </TableCell>

                <TableCell align="right">
                  <Typography variant="caption" color="text.secondary">
                    {new Date(project.lastSeenAt).toLocaleString()}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack component="form" onSubmit={addProject} direction="row" spacing={2} alignItems="center">
          <TextField
            size="small"
            label="Add a project slug"
            value={newSlug}
            onChange={(e) => setNewSlug(e.target.value)}
            helperText="Only needed for a project that has not been seen yet"
          />
          <Button type="submit" disabled={newSlug.trim().length === 0}>
            Add
          </Button>
        </Stack>
      </Paper>

      {toast}
    </Stack>
  )
}
