import { useMutation, useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { api, formatDate, post } from '../../api'
import { Alert, Field } from '../../components/Field'
import { useAdminExams } from './AdminLayout'

type UserRow = { id: number; email: string; fullName: string; role: string; emailVerified: boolean; createdAt: string }

export function AdminAccess() {
  const { data: exams } = useAdminExams()
  const [grant, setGrant] = useState({ email: '', examId: 0, note: '' })
  const examId = grant.examId || exams?.[0]?.id || 0
  const [search, setSearch] = useState('')

  const users = useQuery({
    queryKey: ['admin', 'users', search],
    queryFn: () => api<UserRow[]>(`/api/admin/users?q=${encodeURIComponent(search)}`),
  })
  const give = useMutation({
    mutationFn: () => post<{ entitlementId: number; expiresAt: string }>('/api/admin/entitlements', { ...grant, examId }),
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    give.mutate()
  }

  return (
    <div className="stack">
      <form className="card" onSubmit={submit} style={{ maxWidth: 720 }}>
        <h2>Grant exam access</h2>
        <p className="muted">
          Until online payments go live, enrol candidates here after they pay you. They get one attempt and an email telling them
          the exam is ready. The candidate must register first.
        </p>
        {give.isError && <Alert kind="error">{give.error.message}</Alert>}
        {give.isSuccess && (
          <Alert kind="ok">Access granted to {grant.email}. It is valid until {formatDate(give.data.expiresAt)}.</Alert>
        )}
        <div className="grid">
          <Field label="Candidate email">
            <input type="email" required value={grant.email} onChange={(e) => { give.reset(); setGrant({ ...grant, email: e.target.value }) }} />
          </Field>
          <Field label="Exam">
            <select value={examId} onChange={(e) => setGrant({ ...grant, examId: Number(e.target.value) })}>
              {exams?.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Note (optional)" hint="For example the payment reference or invoice number.">
          <input type="text" maxLength={80} value={grant.note} onChange={(e) => setGrant({ ...grant, note: e.target.value })} />
        </Field>
        <button className="btn" disabled={give.isPending}>Grant access</button>
      </form>

      <section className="stack">
        <div className="spread">
          <h2 style={{ margin: 0 }}>Registered users</h2>
          <input type="search" placeholder="Search name or email" value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 280 }} />
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Name</th><th>Email</th><th>Verified</th><th>Role</th><th>Registered</th><th /></tr>
            </thead>
            <tbody>
              {users.data?.map((u) => (
                <tr key={u.id}>
                  <td>{u.fullName}</td>
                  <td>{u.email}</td>
                  <td>{u.emailVerified ? 'Yes' : <span className="badge orange">No</span>}</td>
                  <td>{u.role === 'ADMIN' ? 'Admin' : 'Candidate'}</td>
                  <td>{formatDate(u.createdAt)}</td>
                  <td>
                    {u.role !== 'ADMIN' && (
                      <button className="btn secondary small" onClick={() => { give.reset(); setGrant({ ...grant, email: u.email }); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
                        Grant access
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
