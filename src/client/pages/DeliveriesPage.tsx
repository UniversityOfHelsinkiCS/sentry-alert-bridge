import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Link from '@mui/material/Link'
import Paper from '@mui/material/Paper'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import { Link as RouterLink } from 'react-router-dom'
import type { DeliveryOutcome } from '../../shared/types'
import { api, useApi } from '../api'

const OUTCOME_COLOR: Record<DeliveryOutcome, 'success' | 'error' | 'default' | 'warning'> = {
  sent: 'success',
  failed: 'error',
  unrouted: 'warning',
}

export function OutcomeChip({ outcome }: { outcome: DeliveryOutcome }) {
  return <Chip size="small" label={outcome} color={OUTCOME_COLOR[outcome]} variant="outlined" />
}

export default function DeliveriesPage() {
  const deliveries = useApi(() => api.deliveries(100), [])

  if (deliveries.loading) return <Skeleton variant="rectangular" height={320} />

  const rows = deliveries.data ?? []

  return (
    <Stack spacing={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
        <Box>
          <Typography variant="h5">Deliveries</Typography>
          <Typography variant="body2" color="text.secondary">
            The last 100 issues this bridge handled, whichever mode they arrived by.
          </Typography>
        </Box>
        <Button onClick={deliveries.reload}>Refresh</Button>
      </Stack>

      {deliveries.error && <Alert severity="error">{deliveries.error}</Alert>}

      <Paper variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Time</TableCell>
              <TableCell>Project</TableCell>
              <TableCell>Issue</TableCell>
              <TableCell>Destination</TableCell>
              <TableCell>Outcome</TableCell>
              <TableCell>Detail</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography variant="body2" color="text.secondary">
                    Nothing delivered yet.
                  </Typography>
                </TableCell>
              </TableRow>
            )}

            {rows.map((d) => (
              <TableRow key={d.id} hover>
                <TableCell>
                  <Typography variant="caption">
                    {new Date(d.receivedAt).toLocaleString()}
                  </Typography>
                </TableCell>
                <TableCell>{d.projectSlug ?? '—'}</TableCell>
                <TableCell sx={{ maxWidth: 320 }}>
                  {d.issueUrl ? (
                    <Link href={d.issueUrl} target="_blank" rel="noreferrer" variant="body2">
                      {d.issueTitle}
                    </Link>
                  ) : (
                    <Typography variant="body2" noWrap title={d.issueTitle ?? ''}>
                      {d.issueTitle ?? '—'}
                    </Typography>
                  )}
                  <Typography variant="caption" color="text.secondary">
                    via {d.source}
                  </Typography>
                </TableCell>
                <TableCell>{d.destinationLabel ?? '—'}</TableCell>
                <TableCell>
                  <OutcomeChip outcome={d.outcome} />
                </TableCell>
                <TableCell sx={{ maxWidth: 260 }}>
                  {d.outcome === 'unrouted' && d.projectSlug ? (
                    <Button
                      size="small"
                      component={RouterLink}
                      to={`/?project=${encodeURIComponent(d.projectSlug)}`}
                    >
                      Route this project
                    </Button>
                  ) : (
                    <Typography variant="caption" color="text.secondary">
                      {d.detail ?? ''}
                    </Typography>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Stack>
  )
}
