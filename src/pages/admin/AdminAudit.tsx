import { useQuery } from '@tanstack/react-query'
import { api, formatDate } from '../../api'

type AuditRow = {
  id: number
  actorEmail: string | null
  action: string
  target: string | null
  details: string | null
  createdAt: string
}

/** The last 500 admin actions and payments, newest first. */
export function AdminAudit() {
  const { data, isPending } = useQuery({ queryKey: ['admin', 'audit'], queryFn: () => api<AuditRow[]>('/api/admin/audit') })

  if (isPending) return <p className="muted">Loading…</p>
  return (
    <div className="stack">
      <p className="muted" style={{ margin: 0 }}>
        Who changed exams, questions, coupons, access and certificates, and every payment received.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>When</th><th>Who</th><th>Action</th><th>On</th><th>Details</th></tr>
          </thead>
          <tbody>
            {data?.map((e) => (
              <tr key={e.id}>
                <td>{formatDate(e.createdAt, true)}</td>
                <td>{e.actorEmail ?? <span className="faint">system</span>}</td>
                <td><code>{e.action}</code></td>
                <td>{e.target}</td>
                <td>{e.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
