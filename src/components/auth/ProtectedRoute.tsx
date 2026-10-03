import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { Logo } from '../ui/Logo'
import type { UserRole } from '../../lib/types'

interface ProtectedRouteProps {
  allowedRoles?: UserRole[]
}

function LoadingScreen() {
  return (
    <div className="field-pattern flex min-h-screen flex-col items-center justify-center gap-4">
      <Logo size="md" />
      <p className="text-sm text-soil-500">Loading your farm...</p>
    </div>
  )
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { session, profile, loading, isPasswordRecovery } = useAuth()

  if (loading) return <LoadingScreen />

  if (isPasswordRecovery) {
    return <Navigate to="/reset-password" replace />
  }

  if (!session || !profile) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}

export function RoleRedirect() {
  const { profile, loading, isPasswordRecovery } = useAuth()

  if (loading) return <LoadingScreen />

  if (isPasswordRecovery) {
    return <Navigate to="/reset-password" replace />
  }

  if (!profile) {
    return <Navigate to="/login" replace />
  }

  if (profile.role === 'superadmin') {
    return <Navigate to="/superadmin" replace />
  }

  return <Navigate to="/app" replace />
}
