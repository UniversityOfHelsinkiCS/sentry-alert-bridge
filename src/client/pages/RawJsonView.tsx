import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import type { SentryDebugDto } from '../../shared/types'

interface Props {
  result: SentryDebugDto
  onCopy: (text: string) => void
}

function summarise(body: unknown): string {
  if (Array.isArray(body)) return `array · ${body.length} entries`
  if (body === null) return 'null'
  if (typeof body === 'object') return `object · ${Object.keys(body).length} keys`
  return typeof body
}

export default function RawJsonView({ result, onCopy }: Props) {
  const json = JSON.stringify(result.body, null, 2)

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Box>
          <Typography variant="subtitle2" sx={{ fontFamily: 'monospace' }}>
            GET {result.path}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {summarise(result.body)}
          </Typography>
        </Box>
        <Button size="small" onClick={() => onCopy(json)}>
          Copy JSON
        </Button>
      </Stack>

      <Box
        component="pre"
        sx={{
          m: 0,
          p: 2,
          maxHeight: '60vh',
          overflow: 'auto',
          fontFamily: 'monospace',
          fontSize: 13,
          lineHeight: 1.5,
          bgcolor: 'action.hover',
          borderRadius: 1,
          whiteSpace: 'pre',
        }}
      >
        {json}
      </Box>
    </Paper>
  )
}
