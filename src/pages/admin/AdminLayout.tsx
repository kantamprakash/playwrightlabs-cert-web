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
  published: boolean
  activeQuestions: number
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
      </nav>
      <Outlet />
    </main>
  )
}
