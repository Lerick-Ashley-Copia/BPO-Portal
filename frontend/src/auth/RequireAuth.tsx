import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import type { Role } from './types'

interface RequireAuthProps {
  children: ReactNode
  roles?: Role[]
}

export function RequireAuth({ children, roles }: RequireAuthProps) {
  const { user, loading } = useAuth()

  if (loading) return null

  if (!user) return <Navigate to="/login" replace />

  if (roles && !roles.some((role) => user.roles.includes(role))) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
