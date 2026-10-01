import Alert from '@mui/material/Alert'
import AppBar from '@mui/material/AppBar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Container from '@mui/material/Container'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Tab from '@mui/material/Tab'
import Skeleton from '@mui/material/Skeleton'
import Tabs from '@mui/material/Tabs'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import type { MeDto } from '../shared/types'
import { api, ApiError, useApi } from './api'
import { OrgProvider, useOrgState } from './OrgContext'
import DeliveriesPage from './pages/DeliveriesPage'
import DestinationsPage from './pages/DestinationsPage'
import LoginPage from './pages/LoginPage'
import OrgsPage from './pages/OrgsPage'
import RoutingPage from './pages/RoutingPage'
import SettingsPage from './pages/SettingsPage'

const TABS = [
  { label: 'Routing', path: '/' },
  { label: 'Organisations', path: '/orgs' },
  { label: 'Destinations', path: '/destinations' },
  { label: 'Deliveries', path: '/deliveries' },
  { label: 'Settings', path: '/settings' },
]

type AuthState = 'checking' | 'in' | 'out'

export default function App() {
  const [auth, setAuth] = useState<AuthState>('checking')
  const [me, setMe] = useState<MeDto | null>(null)
  const location = useLocation()
  const navigate = useNavigate()

  const check = useCallback(() => {
    api
      .me()
      .then((value) => {
        setMe(value)
        setAuth('in')
      })
      .catch((err: unknown) => {
        setAuth(err instanceof ApiError && err.isUnauthorized ? 'out' : 'out')
      })
  }, [])

  useEffect(check, [check])

  useEffect(() => {
    const onUnauthorized = () => setAuth('out')
    window.addEventListener('unauthorized', onUnauthorized)
    return () => window.removeEventListener('unauthorized', onUnauthorized)
  }, [])

  if (auth === 'checking') return null

  if (auth === 'out') {
    return (
      <LoginPage
        onSuccess={() => {
          setAuth('checking')
          check()
        }}
      />
    )
  }

  return (
    <AppShell me={me} onLoggedOut={() => setAuth('out')} />
  )
}

function OrgPicker() {
  const { orgs, org, setOrg } = useOrgState()
  if (orgs.length === 0) return null

  return (
    <Select
      size="small"
      value={org ?? ''}
      onChange={(e) => setOrg(e.target.value)}
      sx={{ minWidth: 180 }}
    >
      {orgs.map((o) => (
        <MenuItem key={o.slug} value={o.slug}>
          {o.name ?? o.slug}
        </MenuItem>
      ))}
    </Select>
  )
}

function OrgGate({ children }: { children: ReactNode }) {
  const { org, orgs, loading } = useOrgState()
  const location = useLocation()

  if (loading) return <Skeleton variant="rectangular" height={320} />

  if (orgs.length === 0 && location.pathname !== '/orgs') {
    return (
      <Alert severity="info" action={<Button component={Link} to="/orgs">Add one</Button>}>
        No Sentry organisation is configured yet. Everything else in this app is scoped to one.
      </Alert>
    )
  }

  if (org === null && location.pathname !== '/orgs') return null

  return <>{children}</>
}

function AppShell({ me, onLoggedOut }: { me: MeDto | null; onLoggedOut: () => void }) {
  const location = useLocation()
  const navigate = useNavigate()
  const orgs = useApi(() => api.orgs(), [])

  const activeTab = TABS.findIndex((t) => t.path === location.pathname)

  const logout = async () => {
    await api.logout().catch(() => undefined)
    onLoggedOut()
    navigate('/')
  }

  return (
    <OrgProvider
      orgs={orgs.data ?? []}
      loading={orgs.loading}
      reloadOrgs={orgs.reload}
    >
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar sx={{ gap: 2 }}>
          <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
            Sentry alert bridge
          </Typography>
          <Tabs value={activeTab === -1 ? false : activeTab} sx={{ flexGrow: 1 }}>
            {TABS.map((tab) => (
              <Tab key={tab.path} label={tab.label} component={Link} to={tab.path} />
            ))}
          </Tabs>
          <OrgPicker />
          <Button onClick={logout} size="small">
            Log out
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: 4, flexGrow: 1 }}>
        <OrgGate>
        <Routes>
          <Route path="/" element={<RoutingPage />} />
          <Route path="/destinations" element={<DestinationsPage />} />
          <Route path="/deliveries" element={<DeliveriesPage />} />
          <Route path="/orgs" element={<OrgsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </OrgGate>
      </Container>

      <Box component="footer" sx={{ py: 2, textAlign: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          {me?.releaseVersion ?? 'dev'}
          {me?.gitSha ? ` · ${me.gitSha.slice(0, 7)}` : ''}
          {me?.staging ? ' · staging' : ''}
        </Typography>
      </Box>
    </Box>
    </OrgProvider>
  )
}
