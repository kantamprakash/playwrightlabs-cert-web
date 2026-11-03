import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { post } from '../api'
import { Alert } from '../components/Field'
import { useDashboard } from './Dashboard'

export function StartExam() {
  const { entitlementId } = useParams()
  const navigate = useNavigate()
  const { data, isPending } = useDashboard()
  const [agreed, setAgreed] = useState(false)
  const start = useMutation({
    mutationFn: () => post<{ attemptId: number }>('/api/attempts', { entitlementId: Number(entitlementId) }),
    onSuccess: ({ attemptId }) => navigate(`/attempts/${attemptId}`, { replace: true }),
  })

  if (isPending) return <main className="container page muted">Loading…</main>
  const access = data?.exams.find((e) => e.entitlementId === Number(entitlementId))
  if (!access) return <Navigate to="/dashboard" replace />
  if (access.attemptId) return <Navigate to={`/attempts/${access.attemptId}`} replace />
  // The exam can only be started inside its booked slot; the dashboard explains why otherwise.
  if (access.state !== 'READY') return <Navigate to="/dashboard" replace />
  const exam = access.exam

  function begin() {
    // Must run inside the click handler: browsers only allow fullscreen from a user gesture.
    document.documentElement.requestFullscreen?.().catch(() => {})
    start.mutate()
  }

  return (
    <main className="container page" style={{ maxWidth: 720 }}>
      <div className="card stack">
        <h1>{exam.title}</h1>
        <div className="facts" style={{ margin: 0 }}>
          <div className="card"><div className="stat">{exam.questionCount}</div><div className="stat-label">questions</div></div>
          <div className="card"><div className="stat">{exam.durationMinutes} min</div><div className="stat-label">time limit</div></div>
          <div className="card"><div className="stat">{exam.passPercent}%</div><div className="stat-label">to pass</div></div>
        </div>
        <div>
          <h2>Before you start</h2>
          <ul className="clean muted">
            <li><strong>You get one attempt.</strong> Once started, the timer keeps running even if you close the browser.</li>
            <li>Your answers are saved as you go. If you lose connection, reopen the exam from your dashboard to continue.</li>
            <li>Some questions have more than one correct answer and say "Select all that apply". You must pick every correct option, and nothing else, to get the mark.</li>
            <li>The exam is submitted automatically when time runs out.</li>
            <li>The exam runs in full screen. Leaving the exam tab or window is recorded.</li>
            <li>Use a laptop or desktop with a stable internet connection, in a quiet place.</li>
          </ul>
        </div>
        {start.isError && <Alert kind="error">{start.error.message}</Alert>}
        <label className="check">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span>I understand that I have one attempt and that the timer starts as soon as I begin.</span>
        </label>
        <div className="row">
          <button className="btn" disabled={!agreed || start.isPending} onClick={begin}>
            {start.isPending ? 'Starting…' : 'Begin exam'}
          </button>
          <Link className="btn secondary" to="/dashboard">Not now</Link>
        </div>
      </div>
    </main>
  )
}
