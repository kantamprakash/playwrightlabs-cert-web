import { useQuery } from '@tanstack/react-query'
import { NavLink, Outlet } from 'react-router'
import { api } from '../../api'

export type AdminExam = {
  id: number
  slug: string
  title: string
  description: string
  durationMinutes: number
  questionCount: number
  passPercent: number
  priceInr: number
  retakePriceInr: number | null
  retakeCooldownDays: number
  kind: 'CERTIFICATION' | 'PRACTICE' | 'LAB'
  prerequisiteExamId: number | null
  published: boolean
  activeQuestions: number
  /** Why attempts can't be drawn yet (too few questions, or the blueprint doesn't fit); null when ready. */
  problem: string | null
}

export function useAdminExams() {
  return useQuery({ queryKey: ['admin', 'exams'], queryFn: () => api<AdminExam[]>('/api/admin/exams') })
}

export function AdminLayout() {
  return (
    <main className="container page">
      <h1>Admin</h1>
      <nav className="tabs">
        <NavLink to="/admin" end>Exams</NavLink>
        <NavLink to="/admin/questions">Question bank</NavLink>
        <NavLink to="/admin/access">Candidates &amp; access</NavLink>
        <NavLink to="/admin/attempts">Attempts</NavLink>
        <NavLink to="/admin/certificates">Certificates</NavLink>
        <NavLink to="/admin/sales">Orders &amp; coupons</NavLink>
        <NavLink to="/admin/audit">Audit log</NavLink>
      </nav>
      <Outlet />
    </main>
  )
}
