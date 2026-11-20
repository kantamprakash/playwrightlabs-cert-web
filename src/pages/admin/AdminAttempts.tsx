import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api, formatDate, post } from '../../api'
import { Alert } from '../../components/Field'

type AttemptRow = {
  id: number
  candidateEmail: string
  candidateName: string
  examTitle: string
  examKind: 'CERTIFICATION' | 'PRACTICE' | 'LAB'
  status: 'IN_PROGRESS' | 'GRADING' | 'COMPLETED'
  startedAt: string
  submittedAt: string | null
  scorePercent: number | null
  passed: boolean | null
  autoSubmitted: boolean
  tabSwitches: number
}

type LabReview = {
  attemptId: number
  candidateEmail: string
  status: string
  scorePercent: number | null
  gradingError: string | null
  language: 'TYPESCRIPT' | 'JAVASCRIPT'
  tasks: { taskId: number; title: string; code: string; score: number | null; integrityIssue: string | null; feedback: string[] }[]
}

export function AdminAttempts() {
  const [reviewing, setReviewing] = useState<number | null>(null)
  const { data, isPending } = useQuery({ queryKey: ['admin', 'attempts'], queryFn: () => api<AttemptRow[]>('/api/admin/attempts') })
  if (isPending) return <p className="muted">Loading…</p>
  if (reviewing != null) return <LabReviewPanel attemptId={reviewing} onClose={() => setReviewing(null)} />
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
            <tr><th>Candidate</th><th>Exam</th><th>Started</th><th>Submitted</th><th>Score</th><th>Result</th><th title="Times the candidate left the exam window">Left window</th><th /></tr>
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
                  ) : a.status === 'GRADING' ? (
                    <span className="badge orange">Grading</span>
                  ) : a.passed ? (
                    <span className="badge green">Passed</span>
                  ) : (
                    <span className="badge red">Not passed</span>
                  )}
                </td>
                <td style={a.tabSwitches > 3 ? { color: 'var(--warn)', fontWeight: 600 } : undefined}>
                  {a.examKind === 'LAB' ? '—' : a.tabSwitches}
                </td>
                <td>{a.examKind === 'LAB' && a.status !== 'IN_PROGRESS' && (
                  <button className="btn secondary small" onClick={() => setReviewing(a.id)}>Review code</button>
                )}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** A lab submission: the candidate's code per task with its score, and regrading if the sandbox failed. */
function LabReviewPanel({ attemptId, onClose }: { attemptId: number; onClose: () => void }) {
  const queryClient = useQueryClient()
  const { data, isPending } = useQuery({
    queryKey: ['admin', 'lab-review', attemptId],
    queryFn: () => api<LabReview>(`/api/admin/attempts/${attemptId}/lab`),
  })
  const regrade = useMutation({
    mutationFn: () => post<LabReview>(`/api/admin/attempts/${attemptId}/lab/regrade`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin'] }),
  })
  if (isPending || !data) return <p className="muted">Loading…</p>
  return (
    <div className="stack">
      <div className="spread">
        <div>
          <h2 style={{ margin: 0 }}>Lab submission #{data.attemptId}</h2>
          <div className="faint">{data.candidateEmail} · {data.status} · {data.language === 'JAVASCRIPT' ? 'JavaScript' : 'TypeScript'}{data.scorePercent != null && ` · ${data.scorePercent}%`}</div>
        </div>
        <div className="row">
          <button className="btn secondary small" disabled={regrade.isPending || data.status === 'GRADING'} onClick={() => regrade.mutate()}>
            Regrade
          </button>
          <button className="btn secondary small" onClick={onClose}>Back to attempts</button>
        </div>
      </div>
      {data.gradingError && <Alert kind="error">Grading failed: {data.gradingError}</Alert>}
      {regrade.isError && <Alert kind="error">{regrade.error.message}</Alert>}
      {regrade.isSuccess && <Alert kind="ok">Queued for grading again.</Alert>}
      {data.tasks.map((t) => (
        <div className="card stack" key={t.taskId}>
          <div className="spread">
            <h3 style={{ margin: 0 }}>{t.title}</h3>
            {t.score != null && <span className="badge">{t.score} / 100</span>}
          </div>
          {t.integrityIssue && <Alert kind="error">Integrity: {t.integrityIssue}</Alert>}
          {t.feedback.length > 0 && <ul className="clean muted" style={{ margin: 0 }}>{t.feedback.map((f) => <li key={f}>{f}</li>)}</ul>}
          <pre className="lab-output" style={{ maxHeight: 420 }}>{t.code}</pre>
        </div>
      ))}
    </div>
  )
}
