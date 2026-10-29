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
import Typography from '@mui/material/Typography'
import { Fragment, memo, useEffect, useState } from 'react'
import type { DestinationDto, ProjectDto, ProjectIssuesDto } from '../../shared/types'
import { api } from '../api'
import { errorMessage } from '../useToast'
import { IssueDebugTable } from './IssueDebugTable'
import { RouteTimingCells } from './RouteTimingCells'

const UNROUTED = ''

export type SaveRoute = (
  project: ProjectDto,
  destinationId: number | null,
  enabled: boolean,
  cooldownMinutes?: number | null,
  backoffCeilingMinutes?: number | null,
) => void

function IssueDebugPanel({ org, slug }: { org: string; slug: string }) {
  const [state, setState] = useState<ProjectIssuesDto | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    setState(null)
    setError(null)
    api
      .projectIssues(org, slug)
      .then((data) => live && setState(data))
      .catch((err) => live && setError(errorMessage(err)))
    return () => {
      live = false
    }
  }, [org, slug])

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
        <IssueDebugTable issues={state.issues} />
      )}
    </Box>
  )
}

type RouteInfo = NonNullable<ProjectDto['route']>

function recapSummary(route: RouteInfo): string {
  const rules = `${route.recapPatterns.length} ${route.recapPatterns.length === 1 ? 'rule' : 'rules'}`
  if (route.recapTimes.length === 0) return `${rules} · no times`
  return `${rules} · ${route.recapTimes.join(', ')}`
}

function RecapCell({ route, onOpen }: { route: RouteInfo | null; onOpen: () => void }) {
  if (!route) {
    return (
      <Typography variant="caption" color="text.secondary">
        —
      </Typography>
    )
  }

  const configured = route.recapPatterns.length > 0 || route.recapTimes.length > 0

  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Button size="small" variant="text" onClick={onOpen} sx={{ textTransform: 'none' }}>
        {configured ? recapSummary(route) : 'Set up'}
      </Button>
      {route.recapQueuedCount > 0 && (
        <Chip size="small" color="info" label={route.recapQueuedCount} />
      )}
    </Stack>
  )
}

interface ProjectRowProps {
  org: string
  project: ProjectDto
  dests: DestinationDto[]
  defaultCooldown: number | null
  highlighted: boolean
  expanded: boolean
  onToggleDebug: (slug: string) => void
  onOpenRecap: (project: ProjectDto) => void
  onSave: SaveRoute
}

function DebugToggle({ shown, expanded, onToggle }: { shown: boolean; expanded: boolean; onToggle: () => void }) {
  if (!shown) return null

  return (
    <Button
      size="small"
      variant="outlined"
      startIcon={
        expanded ? (
          <KeyboardArrowDownIcon fontSize="small" />
        ) : (
          <KeyboardArrowRightIcon fontSize="small" />
        )
      }
      onClick={onToggle}
    >
      Debug
    </Button>
  )
}

function ProjectName({ project }: { project: ProjectDto }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Typography variant="body2">{project.name ?? project.slug}</Typography>
      {project.name && project.name !== project.slug && (
        <Typography variant="caption" color="text.secondary">
          {project.slug}
        </Typography>
      )}
      {!project.route && <Chip size="small" label="needs routing" />}
    </Stack>
  )
}

function DestinationSelect({
  project,
  dests,
  onSave,
}: Pick<ProjectRowProps, 'project' | 'dests' | 'onSave'>) {
  return (
    <Select
      size="small"
      fullWidth
      displayEmpty
      value={project.route ? String(project.route.destinationId) : UNROUTED}
      onChange={(e) =>
        onSave(
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
  )
}

const ProjectRow = memo(function ProjectRow(props: ProjectRowProps) {
  const { org, project, dests, defaultCooldown, expanded, onSave } = props
  const route = project.route

  return (
    <Fragment>
      <TableRow selected={props.highlighted} hover>
        <TableCell>
          <DebugToggle
            shown={route !== null}
            expanded={expanded}
            onToggle={() => props.onToggleDebug(project.slug)}
          />
        </TableCell>

        <TableCell>
          <ProjectName project={project} />
        </TableCell>

        <TableCell>
          <DestinationSelect project={project} dests={dests} onSave={onSave} />
        </TableCell>

        <RouteTimingCells
          route={route}
          defaultCooldown={defaultCooldown}
          onCommit={(cooldownMinutes, backoffCeilingMinutes) =>
            route &&
            onSave(project, route.destinationId, route.enabled, cooldownMinutes, backoffCeilingMinutes)
          }
        />

        <TableCell>
          <RecapCell route={route} onOpen={() => props.onOpenRecap(project)} />
        </TableCell>

        <TableCell align="center">
          <Switch
            size="small"
            disabled={!route}
            checked={route?.enabled ?? false}
            onChange={(e) => route && onSave(project, route.destinationId, e.target.checked)}
          />
        </TableCell>

        <TableCell align="right">
          <Typography variant="caption" color="text.secondary">
            {new Date(project.lastSeenAt).toLocaleString()}
          </Typography>
        </TableCell>
      </TableRow>

      <TableRow>
        <TableCell colSpan={8} sx={{ py: 0, border: 0 }}>
          <Collapse in={expanded} unmountOnExit>
            <IssueDebugPanel org={org} slug={project.slug} />
          </Collapse>
        </TableCell>
      </TableRow>
    </Fragment>
  )
})

export function ProjectTable({
  org,
  rows,
  dests,
  defaultCooldown,
  highlight,
  expanded,
  onToggleDebug,
  onOpenRecap,
  onSave,
}: Omit<ProjectRowProps, 'project' | 'highlighted' | 'expanded'> & {
  rows: ProjectDto[]
  highlight: string | null
  expanded: string | null
}) {
  return (
    <Paper variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell width={120} />
            <TableCell>Project</TableCell>
            <TableCell width="30%">Destination</TableCell>
            <TableCell width={150}>Cooldown</TableCell>
            <TableCell width={150}>Backoff ceiling</TableCell>
            <TableCell width={150}>Recap</TableCell>
            <TableCell align="center">Enabled</TableCell>
            <TableCell align="right">Last seen</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={8}>
                <Typography variant="body2" color="text.secondary">
                  No projects known yet.
                </Typography>
              </TableCell>
            </TableRow>
          )}

          {rows.map((project) => (
            <ProjectRow
              key={project.slug}
              org={org}
              project={project}
              dests={dests}
              defaultCooldown={defaultCooldown}
              highlighted={project.slug === highlight}
              expanded={expanded === project.slug}
              onToggleDebug={onToggleDebug}
              onOpenRecap={onOpenRecap}
              onSave={onSave}
            />
          ))}
        </TableBody>
      </Table>
    </Paper>
  )
}
