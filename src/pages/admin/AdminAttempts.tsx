import { useQuery } from '@tanstack/react-query'
import { api, formatDate } from '../../api'

type AttemptRow = {
  id: number
  candidateEmail: string
  candidateName: string
  examTitle: string
  status: 'IN_PROGRESS' | 'COMPLETED'
  startedAt: string
  submittedAt: string | null
  scorePercent: number | null
  passed: boolean | null
  autoSubmitted: boolean
  tabSwitches: number
}

export function AdminAttempts() {
  const { data, isPending } = useQuery({ queryKey: ['admin', 'attempts'], queryFn: () => api<AttemptRow[]>('/api/admin/attempts') })
  if (isPending) return <p className="muted">Loading…</p>
  if (!data?.length) return <p className="muted">No attempts yet.</p>

  const completed = data.filter((a) => a.status === 'COMPLETED')
  const passed = completed.filter((a) => a.passed).length

  return (
    <div className="stack">
      <div className="facts" style={{ margin: 0 }}>
        <div className="card"><div className="stat">{data.length}</div><div className="stat-label">attempts</div></div>
        <div className="card"><div className="stat">{data.length - completed.length}</div><div className="stat-label">in progress</div></div>
        <div className="card">
          <div className="stat">{completed.length ? Math.round((passed * 100) / completed.length) : 0}%</div>
          <div className="stat-label">pass rate</div>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Candidate</th><th>Exam</th><th>Started</th><th>Submitted</th><th>Score</th><th>Result</th><th title="Times the candidate left the exam window">Left window</th></tr>
          </thead>
          <tbody>
            {data.map((a) => (
              <tr key={a.id}>
                <td>{a.candidateName}<div className="faint">{a.candidateEmail}</div></td>
                <td>{a.examTitle}</td>
                <td>{formatDate(a.startedAt, true)}</td>
                <td>{a.submittedAt ? formatDate(a.submittedAt, true) : '—'}{a.autoSubmitted && <div className="faint">time ran out</div>}</td>
                <td>{a.scorePercent != null ? `${a.scorePercent}%` : '—'}</td>
                <td>
                  {a.status === 'IN_PROGRESS' ? (
                    <span className="badge orange">In progress</span>
                  ) : a.passed ? (
                    <span className="badge green">Passed</span>
                  ) : (
                    <span className="badge red">Not passed</span>
                  )}
                </td>
                <td style={a.tabSwitches > 3 ? { color: 'var(--warn)', fontWeight: 600 } : undefined}>{a.tabSwitches}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
