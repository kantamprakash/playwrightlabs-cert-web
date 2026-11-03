import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { api, ApiError, type User } from './api'

/** The signed-in user, or null when signed out. */
export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        return await api<User>('/api/auth/me')
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null
        throw err
      }
    },
    staleTime: 60_000,
  })
}

export function RequireAuth({ admin = false, children }: { admin?: boolean; children: ReactNode }) {
  const { data: me, isPending } = useMe()
  const location = useLocation()
  if (isPending) return <div className="container page muted">Loading…</div>
  if (!me) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />
  if (admin && me.role !== 'ADMIN') return <Navigate to="/dashboard" replace />
  return children
}
