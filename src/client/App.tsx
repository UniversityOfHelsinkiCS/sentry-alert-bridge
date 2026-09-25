import AppBar from '@mui/material/AppBar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Container from '@mui/material/Container'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import type { MeDto } from '../shared/types'
import { api, ApiError } from './api'
import DeliveriesPage from './pages/DeliveriesPage'
import DestinationsPage from './pages/DestinationsPage'
import LoginPage from './pages/LoginPage'
import RoutingPage from './pages/RoutingPage'
import SettingsPage from './pages/SettingsPage'

const TABS = [
  { label: 'Routing', path: '/' },
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

  // Any 401 from anywhere in the app drops us back to the login view.
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

  const activeTab = TABS.findIndex((t) => t.path === location.pathname)

  const logout = async () => {
    await api.logout().catch(() => undefined)
    setAuth('out')
    navigate('/')
  }

  return (
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
          <Button onClick={logout} size="small">
            Log out
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: 4, flexGrow: 1 }}>
        <Routes>
          <Route path="/" element={<RoutingPage />} />
          <Route path="/destinations" element={<DestinationsPage />} />
          <Route path="/deliveries" element={<DeliveriesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Container>

      <Box component="footer" sx={{ py: 2, textAlign: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          {me?.releaseVersion ?? 'dev'}
          {me?.gitSha ? ` · ${me.gitSha.slice(0, 7)}` : ''}
          {me?.staging ? ' · staging' : ''}
        </Typography>
      </Box>
    </Box>
  )
}
