import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { FullScreenLoader } from '../../components/ui/FullScreenLoader'
import { useAuth } from './useAuth'

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  if (status === 'loading') return <FullScreenLoader />
  if (status !== 'admin') return <Navigate to="/admin/login" replace />
  return children
}

export function RequireSeller({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  if (status === 'loading') return <FullScreenLoader />
  if (status !== 'seller') return <Navigate to="/vendedor/login" replace />
  return children
}

// Para pantallas que ambos roles pueden ver (ej. /terrenos, spec §51/§52).
export function RequireAnyRole({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  if (status === 'loading') return <FullScreenLoader />
  if (status === 'signed-out') return <Navigate to="/" replace />
  return children
}
