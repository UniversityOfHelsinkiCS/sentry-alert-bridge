import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useCallback, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { compilePatterns, matchRecap } from '../../shared/recap'
import type { ProjectDto, ProjectIssueDto, ProjectIssuesDto } from '../../shared/types'
import { api, useApi, type UseApi } from '../api'
import { useOrg, useOrgState } from '../OrgContext'
import { errorMessage, useToast } from '../useToast'
import { AddProjectForm } from './AddProjectForm'
import { ProjectTable } from './ProjectTable'

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

export default function RoutingPage() {
  const org = useOrg()
  const { orgs } = useOrgState()
  const projects = useApi(() => api.projects(org), [org])
  const destinations = useApi(() => api.destinations(org), [org])
  const settings = useApi(() => api.settings(), [])
  const { show, toast } = useToast()
  const [params] = useSearchParams()
  const [expanded, setExpanded] = useState<string | null>(null)
  const [recapFor, setRecapFor] = useState<ProjectDto | null>(null)

  const highlight = params.get('project')

  const toggleDebug = useCallback(
    (slug: string) => setExpanded((current) => (current === slug ? null : slug)),
    [],
  )

  const save = async (
    project: ProjectDto,
    destinationId: number | null,
    enabled: boolean,
    cooldownMinutes: number | null = project.route?.cooldownMinutes ?? null,
    backoffCeilingMinutes: number | null = project.route?.backoffCeilingMinutes ?? null,
  ) => {
    try {
      const updated =
        destinationId === null
          ? await api.clearRoute(org, project.slug)
          : await api.setRoute(
              org,
              project.slug,
              destinationId,
              enabled,
              cooldownMinutes,
              backoffCeilingMinutes,
            )
      projects.setData(updated)
      show(destinationId === null ? `${project.slug} unrouted` : `${project.slug} saved`)
    } catch (err) {
      show(errorMessage(err), 'error')
      projects.reload()
    }
  }

  const addProject = async (slug: string) => {
    try {
      projects.setData(await api.addProject(org, slug))
      show('project added')
      return true
    } catch (err) {
      show(errorMessage(err), 'error')
      return false
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

      <ProjectTable
        org={org}
        rows={rows}
        dests={dests}
        defaultCooldown={defaultCooldown}
        highlight={highlight}
        expanded={expanded}
        onToggleDebug={toggleDebug}
        onOpenRecap={setRecapFor}
        onSave={save}
      />

      <AddProjectForm onAdd={addProject} />

      {toast}
    </Stack>
  )
}
