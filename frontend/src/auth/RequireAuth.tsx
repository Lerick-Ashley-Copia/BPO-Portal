import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import type { Role } from './types'

interface RequireAuthProps {
  children: ReactNode
  roles?: Role[]
}

export function RequireAuth({ children, roles }: RequireAuthProps) {
  const { user, loading, effectiveRoles } = useAuth()

  if (loading) return null

  if (!user) return <Navigate to="/login" replace />

  // Route-level role checks honor the simulated "view as" role too, so
  // navigating directly to an admin-only URL while previewing a lower
  // role redirects away just like the hidden nav item implies it would.
  if (roles && !roles.some((role) => effectiveRoles.includes(role))) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
