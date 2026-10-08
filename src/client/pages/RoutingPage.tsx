import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Collapse from '@mui/material/Collapse'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
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
import { Fragment, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { MAX_COOLDOWN_MINUTES } from '../../shared/types'
import { compilePatterns, matchRecap } from '../../shared/recap'
import type {
  DestinationDto,
  IssueVerdict,
  ProjectDto,
  ProjectIssueDto,
  ProjectIssuesDto,
} from '../../shared/types'
import { api, useApi, type UseApi } from '../api'
import { useOrg, useOrgState } from '../OrgContext'
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
  recap: {
    label: 'recap',
    color: 'default',
    why: 'Matches a recap rule, so it waits for this project’s next recap instead of alerting.',
  },
  unknown: {
    label: 'no last seen',
    color: 'warning',
    why: 'Sentry returned no usable lastSeen, so there is nothing to compare.',
  },
}

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

function isValidRegex(pattern: string): boolean {
  try {
    new RegExp(pattern)
    return true
  } catch {
    return false
  }
}

function EditableList({
  title,
  values,
  emptyText,
  addLabel,
  blank,
  helper,
  onChange,
  renderField,
}: {
  title: string
  values: string[]
  emptyText: string
  addLabel: string
  blank: string
  helper: ReactNode
  onChange: (values: string[]) => void
  renderField: (value: string, onValue: (next: string) => void) => ReactNode
}) {
  const replace = (index: number, next: string) =>
    onChange(values.map((value, i) => (i === index ? next : value)))

  return (
    <Stack spacing={1}>
      <Typography variant="subtitle2">{title}</Typography>

      {values.length === 0 && (
        <Typography variant="caption" color="text.secondary">
          {emptyText}
        </Typography>
      )}

      {values.map((value, index) => (
        <Stack key={index} direction="row" spacing={1} alignItems="center">
          {renderField(value, (next) => replace(index, next))}
          <Button
            size="small"
            color="inherit"
            onClick={() => onChange(values.filter((_, i) => i !== index))}
          >
            Remove
          </Button>
        </Stack>
      ))}

      <Box>
        <Button size="small" onClick={() => onChange([...values, blank])}>
          {addLabel}
        </Button>
      </Box>

      <Typography variant="caption" color="text.secondary">
        {helper}
      </Typography>
    </Stack>
  )
}

function useRecapForm(org: string, project: ProjectDto, onSaved: (p: ProjectDto[]) => void) {
  const [patterns, setPatterns] = useState<string[]>(project.route?.recapPatterns ?? [])
  const [times, setTimes] = useState<string[]>(project.route?.recapTimes ?? [])
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)

  const clean = (values: string[]) => values.map((v) => v.trim()).filter((v) => v !== '')

  const save = async (onDone: () => void) => {
    setFormError(null)
    setSaving(true)
    try {
      onSaved(await api.setRouteRecap(org, project.slug, clean(patterns), clean(times)))
      onDone()
    } catch (err) {
      setFormError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const sendNow = async () => {
    setFormError(null)
    setSending(true)
    try {
      const result = await api.sendRecapNow(org, project.slug)
      setFormError(
        result.sent
          ? `sent a recap with ${result.issues} issues`
          : 'nothing is queued for this project yet',
      )
    } catch (err) {
      setFormError(errorMessage(err))
    } finally {
      setSending(false)
    }
  }

  return {
    patterns,
    setPatterns,
    times,
    setTimes,
    formError,
    saving,
    sending,
    save,
    sendNow,
    valid: clean(patterns).every(isValidRegex),
  }
}

function PatternsField({
  values,
  onChange,
}: {
  values: string[]
  onChange: (values: string[]) => void
}) {
  return (
    <EditableList
      title="Patterns"
      values={values}
      onChange={onChange}
      emptyText="No patterns yet — every issue alerts immediately."
      addLabel="Add pattern"
      blank=""
      helper={
        <>
          Case-insensitive and unanchored, so <code>Timeout</code> matches anywhere in the title
          or culprit.
        </>
      }
      renderField={(value, onValue) => (
        <TextField
          size="small"
          fullWidth
          value={value}
          placeholder="^Timeout"
          error={value.trim() !== '' && !isValidRegex(value.trim())}
          onChange={(e) => onValue(e.target.value)}
        />
      )}
    />
  )
}

function TimesField({
  values,
  onChange,
  timezone,
}: {
  values: string[]
  onChange: (values: string[]) => void
  timezone: string | null
}) {
  return (
    <EditableList
      title="Times"
      values={values}
      onChange={onChange}
      emptyText="No times yet — matched issues stay queued until you add one."
      addLabel="Add time"
      blank="09:00"
      helper={`Read in ${timezone ?? 'the server time zone'}, set on the Organisations page.`}
      renderField={(value, onValue) => (
        <TextField
          size="small"
          type="time"
          value={value}
          onChange={(e) => onValue(e.target.value)}
          sx={{ maxWidth: 160 }}
        />
      )}
    />
  )
}

function PreviewRow({ issue, pattern }: { issue: ProjectIssueDto; pattern: string }) {
  return (
    <Stack direction="row" spacing={1} alignItems="baseline">
      <Typography variant="body2" sx={{ flexGrow: 1, wordBreak: 'break-word' }}>
        {issue.title}
      </Typography>
      <Chip size="small" variant="outlined" label={pattern} />
    </Stack>
  )
}

function RecapPreview({
  patterns,
  issues,
}: {
  patterns: string[]
  issues: UseApi<ProjectIssuesDto>
}) {
  if (issues.loading) return <Skeleton variant="rectangular" height={80} />
  if (issues.error) return <Alert severity="warning">{issues.error}</Alert>

  const all = issues.data?.issues ?? []
  const compiled = compilePatterns(patterns.map((p) => p.trim()).filter((p) => p !== ''))
  const matched = all
    .map((issue) => ({ issue, pattern: matchRecap(issue, compiled) }))
    .filter((row): row is { issue: ProjectIssueDto; pattern: string } => row.pattern !== null)

  return (
    <Stack spacing={1}>
      <Typography variant="subtitle2">Preview</Typography>

      <Typography variant="body2" color="text.secondary">
        {matched.length} of {all.length} current {all.length === 1 ? 'issue' : 'issues'} match.
      </Typography>

      <Stack spacing={1} sx={{ maxHeight: 220, overflowY: 'auto' }}>
        {matched.map((row) => (
          <PreviewRow key={row.issue.id} issue={row.issue} pattern={row.pattern} />
        ))}
      </Stack>

      <Typography variant="caption" color="text.secondary">
        These are the project's current open issues in Sentry, not what is queued for the next
        recap.
      </Typography>
    </Stack>
  )
}

function RecapDialog({
  org,
  project,
  timezone,
  onClose,
  onSaved,
}: {
  org: string
  project: ProjectDto
  timezone: string | null
  onClose: () => void
  onSaved: (projects: ProjectDto[]) => void
}) {
  const form = useRecapForm(org, project, onSaved)
  const issues = useApi(() => api.projectIssues(org, project.slug), [org, project.slug])

  return (
    <Dialog open fullWidth maxWidth="sm" onClose={onClose}>
      <DialogTitle>Recap for {project.name ?? project.slug}</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Issues whose title or culprit matches any of these patterns are not alerted on
            immediately. They are collected and delivered as one message at each time below.
          </Typography>

          {form.formError && <Alert severity="info">{form.formError}</Alert>}

          <PatternsField values={form.patterns} onChange={form.setPatterns} />

          <RecapPreview patterns={form.patterns} issues={issues} />

          <TimesField values={form.times} onChange={form.setTimes} timezone={timezone} />

          <RecapQueueNote count={project.route?.recapQueuedCount ?? 0} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={form.sendNow} disabled={form.sending || !project.route}>
          {form.sending ? 'Sending…' : 'Send recap now'}
        </Button>
        <Box sx={{ flexGrow: 1 }} />
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => form.save(onClose)} disabled={form.saving || !form.valid}>
          {form.saving ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function RecapQueueNote({ count }: { count: number }) {
  if (count === 0) return null

  return (
    <Typography variant="body2" color="text.secondary">
      {count} {count === 1 ? 'issue is' : 'issues are'} queued right now.
    </Typography>
  )
}

function CooldownField({
  value,
  placeholder,
  disabled,
  onCommit,
}: {
  value: number | null
  placeholder: number | null
  disabled: boolean
  onCommit: (minutes: number | null) => void
}) {
  const [draft, setDraft] = useState(value === null ? '' : String(value))

  useEffect(() => {
    setDraft(value === null ? '' : String(value))
  }, [value])

  const commit = () => {
    const trimmed = draft.trim()
    if (trimmed === '') {
      if (value !== null) onCommit(null)
      return
    }
    const minutes = Number(trimmed)
    if (!Number.isInteger(minutes) || minutes < 0 || minutes > MAX_COOLDOWN_MINUTES) {
      setDraft(value === null ? '' : String(value))
      return
    }
    if (minutes !== value) onCommit(minutes)
  }

  return (
    <TextField
      size="small"
      type="number"
      fullWidth
      disabled={disabled}
      value={draft}
      placeholder={placeholder === null ? '' : String(placeholder)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && commit()}
      inputProps={{ min: 0, max: MAX_COOLDOWN_MINUTES }}
      title="Minutes an issue stays quiet after alerting. Blank uses the global default."
    />
  )
}

interface ProjectRowProps {
  org: string
  project: ProjectDto
  dests: DestinationDto[]
  defaultCooldown: number | null
  highlighted: boolean
  expanded: boolean
  onToggleDebug: () => void
  onOpenRecap: () => void
  onSave: (
    project: ProjectDto,
    destinationId: number | null,
    enabled: boolean,
    cooldownMinutes?: number | null,
  ) => void
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

function ProjectRow(props: ProjectRowProps) {
  const { org, project, dests, defaultCooldown, expanded, onSave } = props
  const route = project.route

  return (
    <Fragment>
      <TableRow selected={props.highlighted} hover>
        <TableCell>
          <DebugToggle shown={route !== null} expanded={expanded} onToggle={props.onToggleDebug} />
        </TableCell>

        <TableCell>
          <ProjectName project={project} />
        </TableCell>

        <TableCell>
          <DestinationSelect project={project} dests={dests} onSave={onSave} />
        </TableCell>

        <TableCell>
          <CooldownField
            disabled={!route}
            value={route?.cooldownMinutes ?? null}
            placeholder={defaultCooldown}
            onCommit={(minutes) =>
              route && onSave(project, route.destinationId, route.enabled, minutes)
            }
          />
        </TableCell>

        <TableCell>
          <RecapCell route={route} onOpen={props.onOpenRecap} />
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
        <TableCell colSpan={7} sx={{ py: 0, border: 0 }}>
          <Collapse in={expanded} unmountOnExit>
            <IssueDebugPanel org={org} slug={project.slug} />
          </Collapse>
        </TableCell>
      </TableRow>
    </Fragment>
  )
}

export default function RoutingPage() {
  const org = useOrg()
  const { orgs } = useOrgState()
  const projects = useApi(() => api.projects(org), [org])
  const destinations = useApi(() => api.destinations(org), [org])
  const settings = useApi(() => api.settings(), [])
  const { show, toast } = useToast()
  const [newSlug, setNewSlug] = useState('')
  const [params] = useSearchParams()
  const [expanded, setExpanded] = useState<string | null>(null)
  const [recapFor, setRecapFor] = useState<ProjectDto | null>(null)

  const highlight = params.get('project')

  const save = async (
    project: ProjectDto,
    destinationId: number | null,
    enabled: boolean,
    cooldownMinutes: number | null = project.route?.cooldownMinutes ?? null,
  ) => {
    try {
      const updated =
        destinationId === null
          ? await api.clearRoute(org, project.slug)
          : await api.setRoute(org, project.slug, destinationId, enabled, cooldownMinutes)
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
      projects.setData(await api.addProject(org, newSlug.trim()))
      setNewSlug('')
      show('project added')
    } catch (err) {
      show(errorMessage(err), 'error')
    }
  }

  if (projects.loading || destinations.loading || settings.loading) {
    return <Skeleton variant="rectangular" height={320} />
  }

  const rows = projects.data ?? []
  const dests = destinations.data ?? []
  const defaultCooldown = settings.data?.alertCooldownMinutes ?? null
  const timezone = orgs.find((o) => o.slug === org)?.timezone ?? null

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

      {recapFor && (
        <RecapDialog
          org={org}
          project={recapFor}
          timezone={timezone}
          onClose={() => setRecapFor(null)}
          onSaved={(updated) => {
            projects.setData(updated)
            show('recap settings saved')
          }}
        />
      )}

      <Paper variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell width={120} />
              <TableCell>Project</TableCell>
              <TableCell width="30%">Destination</TableCell>
              <TableCell width={150}>Cooldown</TableCell>
              <TableCell width={150}>Recap</TableCell>
              <TableCell align="center">Enabled</TableCell>
              <TableCell align="right">Last seen</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7}>
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
                onToggleDebug={() =>
                  setExpanded(expanded === project.slug ? null : project.slug)
                }
                onOpenRecap={() => setRecapFor(project)}
                onSave={save}
              />
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
