import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useState, type FormEvent } from 'react'
import { api } from '../api'

export default function LoginPage({ onSuccess }: { onSuccess: () => void }) {
  const [token, setToken] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.login(token)
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        p: 2,
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 420 }}>
        <CardContent component="form" onSubmit={submit}>
          <Stack spacing={2.5}>
            <Typography variant="h5">Sentry alert bridge</Typography>
            <Typography variant="body2" color="text.secondary">
              Internal tool. Enter the shared access token to continue.
            </Typography>

            {error && <Alert severity="error">{error}</Alert>}

            <TextField
              label="Access token"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              autoFocus
              fullWidth
              autoComplete="current-password"
            />

            <Button type="submit" variant="contained" disabled={busy || token.length === 0}>
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  )
}
