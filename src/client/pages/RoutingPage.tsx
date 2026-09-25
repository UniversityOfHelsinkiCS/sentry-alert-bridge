import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Collapse from '@mui/material/Collapse'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight'
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
import { Fragment, useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { IssueVerdict, ProjectDto, ProjectIssuesDto } from '../../shared/types'
import { api, useApi } from '../api'
import { errorMessage, useToast } from '../useToast'

const UNROUTED = ''

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
  unknown: {
    label: 'no last seen',
    color: 'warning',
    why: 'Sentry returned no usable lastSeen, so there is nothing to compare.',
  },
}

/**
 * What the poller sees for one project, straight from Sentry, with the reason
 * each issue would or would not produce an alert. This is the answer to "I made
 * an error and nothing arrived".
 */
function IssueDebugPanel({ slug }: { slug: string }) {
  const [state, setState] = useState<ProjectIssuesDto | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    setState(null)
    setError(null)
    api
      .projectIssues(slug)
      .then((data) => live && setState(data))
      .catch((err) => live && setError(errorMessage(err)))
    return () => {
      live = false
    }
  }, [slug])

  if (error) return <Alert severity="error">{error}</Alert>
  if (!state) return <Skeleton variant="rectangular" height={80} />

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="caption" color="text.secondary" component="div">
        What Sentry returns for <code>is:unresolved</code>. An issue alerts when it has been seen
        again since the last alert. Events before{' '}
        <strong>{new Date(state.alertsFrom).toLocaleString()}</strong> are history and never
        alert, and after an alert an issue stays quiet for {state.cooldownMinutes} min.
      </Typography>

      {state.issues.length === 0 ? (
        <Typography variant="body2" sx={{ mt: 1 }}>
          Sentry returned no unresolved issues for this project.
        </Typography>
      ) : (
        <Table size="small" sx={{ mt: 1 }}>
          <TableHead>
            <TableRow>
              <TableCell>Issue</TableCell>
              <TableCell>First seen</TableCell>
              <TableCell>Last seen</TableCell>
              <TableCell>Last alerted</TableCell>
              <TableCell align="right">Verdict</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {state.issues.map((issue) => (
              <TableRow key={issue.id}>
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
                <TableCell align="right">
                  <Chip
                    size="small"
                    label={VERDICTS[issue.verdict].label}
                    color={VERDICTS[issue.verdict].color}
                    title={VERDICTS[issue.verdict].why}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Box>
  )
}

export default function RoutingPage() {
  const projects = useApi(() => api.projects(), [])
  const destinations = useApi(() => api.destinations(), [])
  const { show, toast } = useToast()
  const [newSlug, setNewSlug] = useState('')
  const [params] = useSearchParams()
  const [expanded, setExpanded] = useState<string | null>(null)

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
              <TableCell width={120} />
              <TableCell>Project</TableCell>
              <TableCell width="30%">Destination</TableCell>
              <TableCell align="center">Enabled</TableCell>
              <TableCell align="right">Last seen</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5}>
                  <Typography variant="body2" color="text.secondary">
                    No projects known yet.
                  </Typography>
                </TableCell>
              </TableRow>
            )}

            {rows.map((project) => (
              <Fragment key={project.slug}>
              <TableRow
                selected={project.slug === highlight}
                hover
              >
                <TableCell>
                  {/* Only routed projects are polled, so only they have
                      anything to explain. */}
                  {project.route && (
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={
                        expanded === project.slug ? (
                          <KeyboardArrowDownIcon fontSize="small" />
                        ) : (
                          <KeyboardArrowRightIcon fontSize="small" />
                        )
                      }
                      onClick={() =>
                        setExpanded(expanded === project.slug ? null : project.slug)
                      }
                    >
                      Debug
                    </Button>
                  )}
                </TableCell>

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

              <TableRow>
                <TableCell colSpan={5} sx={{ py: 0, border: 0 }}>
                  <Collapse in={expanded === project.slug} unmountOnExit>
                    <IssueDebugPanel slug={project.slug} />
                  </Collapse>
                </TableCell>
              </TableRow>
              </Fragment>
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
