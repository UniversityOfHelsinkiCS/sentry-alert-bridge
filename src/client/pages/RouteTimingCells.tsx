import TableCell from '@mui/material/TableCell'
import TextField from '@mui/material/TextField'
import { useEffect, useState } from 'react'
import { MAX_COOLDOWN_MINUTES, type ProjectDto } from '../../shared/types'

function MinutesField({
  value,
  placeholder,
  title,
  disabled,
  onCommit,
}: {
  value: number | null
  placeholder: string
  title: string
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
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && commit()}
      inputProps={{ min: 0, max: MAX_COOLDOWN_MINUTES }}
      title={title}
    />
  )
}

export function RouteTimingCells({
  route,
  defaultCooldown,
  onCommit,
}: {
  route: ProjectDto['route']
  defaultCooldown: number | null
  onCommit: (cooldownMinutes: number | null, backoffCeilingMinutes: number | null) => void
}) {
  return (
    <>
      <TableCell>
        <MinutesField
          disabled={!route}
          value={route?.cooldownMinutes ?? null}
          placeholder={defaultCooldown === null ? '' : String(defaultCooldown)}
          title="Minutes an issue stays quiet after alerting. Blank uses the global default."
          onCommit={(minutes) => onCommit(minutes, route?.backoffCeilingMinutes ?? null)}
        />
      </TableCell>

      <TableCell>
        <MinutesField
          disabled={!route}
          value={route?.backoffCeilingMinutes ?? null}
          placeholder="off"
          title="Each re-alert doubles the cooldown, up to this many minutes. Blank turns backoff off."
          onCommit={(minutes) => onCommit(route?.cooldownMinutes ?? null, minutes)}
        />
      </TableCell>
    </>
  )
}
