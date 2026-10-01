import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { OrgDto } from '../shared/types'

const STORAGE_KEY = 'sentry-alert-bridge.org'

interface OrgState {
  orgs: OrgDto[]
  org: string | null
  setOrg: (slug: string) => void
  reloadOrgs: () => void
  loading: boolean
}

const OrgContext = createContext<OrgState | null>(null)

function stored(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function remember(slug: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, slug)
  } catch {
  }
}

export function OrgProvider({
  orgs,
  loading,
  reloadOrgs,
  children,
}: {
  orgs: OrgDto[]
  loading: boolean
  reloadOrgs: () => void
  children: ReactNode
}) {
  const [org, setOrgState] = useState<string | null>(stored)

  useEffect(() => {
    if (orgs.length === 0) return
    if (org !== null && orgs.some((o) => o.slug === org)) return
    const next = orgs[0]
    if (next) setOrgState(next.slug)
  }, [orgs, org])

  const value = useMemo<OrgState>(
    () => ({
      orgs,
      org: orgs.length === 0 ? null : org,
      loading,
      reloadOrgs,
      setOrg: (slug: string) => {
        setOrgState(slug)
        remember(slug)
      },
    }),
    [orgs, org, loading, reloadOrgs],
  )

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>
}

export function useOrgState(): OrgState {
  const value = useContext(OrgContext)
  if (!value) throw new Error('useOrgState must be used inside an OrgProvider')
  return value
}

export function useOrg(): string {
  const { org } = useOrgState()
  return org ?? ''
}
