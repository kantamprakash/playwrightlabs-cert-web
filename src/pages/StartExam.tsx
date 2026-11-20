import { useMutation } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { post } from '../api'
import { Alert } from '../components/Field'
import { ProctoringRules, SecurityCheck } from '../components/Proctoring'
import { proctor } from '../proctoring'
import { useDashboard } from './Dashboard'

export function StartExam() {
  const { entitlementId } = useParams()
  const navigate = useNavigate()
  const { data, isPending } = useDashboard()
  const [agreed, setAgreed] = useState(false)
  const [consent, setConsent] = useState(false)
  const [checked, setChecked] = useState(false)
  const [fullscreenError, setFullscreenError] = useState<string | null>(null)
  const started = useRef(false)
  const start = useMutation({
    mutationFn: () => post<{ attemptId: number }>('/api/attempts', { entitlementId: Number(entitlementId) }),
    onSuccess: ({ attemptId }) => {
      started.current = true
      navigate(`/attempts/${attemptId}`, { replace: true })
    },
  })
  // Leaving without starting turns the camera and screen share off again.
  useEffect(() => () => {
    if (!started.current) proctor.release()
  }, [])

  if (isPending) return <main className="container page muted">Loading…</main>
  const access = data?.exams.find((e) => e.entitlementId === Number(entitlementId))
  if (!access) return <Navigate to="/dashboard" replace />
  if (access.attemptId) return <Navigate to={`/attempts/${access.attemptId}`} replace />
  // The exam can only be started inside its booked slot; the dashboard explains why otherwise.
  if (access.state !== 'READY') return <Navigate to="/dashboard" replace />
  const exam = access.exam

  const lab = exam.kind === 'LAB'
  const proctored = exam.proctored

  async function begin() {
    // Must run inside the click handler: browsers only allow fullscreen from a user gesture. An unproctored lab
    // doesn't use full screen, because candidates open the practice app in another tab; a proctored lab embeds it.
    if (proctored) {
      setFullscreenError(null)
      try {
        await proctor.enterFullscreen()
      } catch {
        setFullscreenError('Allow full screen to start the exam.')
        return
      }
    } else if (!lab) {
      document.documentElement.requestFullscreen?.().catch(() => {})
    }
    start.mutate()
  }

  return (
    <main className="container page" style={{ maxWidth: 720 }}>
      <div className="card stack">
        <h1>{exam.title}</h1>
        <div className="facts" style={{ margin: 0 }}>
          <div className="card"><div className="stat">{exam.questionCount}</div><div className="stat-label">{lab ? 'tasks' : 'questions'}</div></div>
          <div className="card"><div className="stat">{exam.durationMinutes} min</div><div className="stat-label">time limit</div></div>
          <div className="card"><div className="stat">{exam.passPercent}%</div><div className="stat-label">to pass</div></div>
        </div>
        <div>
          <h2>Before you start</h2>
          {lab ? (
          <ul className="clean muted">
            <li><strong>This uses your attempt.</strong> Once started, the timer keeps running even if you close the browser.</li>
            <li>Each task describes requirements of a small online shop, the practice app. Write Playwright tests that check them.</li>
            <li>{proctored ? 'Explore the practice app inside the exam page (the “Practice app” tab).' : 'Open the practice app in another tab to explore it.'} Use "Run tests" to run a task's tests against it as often as your run allowance lets you.</li>
            <li>When you submit (or time runs out), your tests must pass on the working app, and they score for each hidden broken version of the app they catch, plus points for good practice: user-facing locators, web-first assertions and no fixed waits.</li>
            <li>Only @playwright/test can be imported, and tests may only drive the browser and the page.</li>
            <li>Your code is saved as you type.</li>
          </ul>
          ) : (
          <ul className="clean muted">
            <li><strong>This uses your attempt.</strong> Once started, the timer keeps running even if you close the browser.</li>
            <li>Your answers are saved as you go. If you lose connection, reopen the exam from your dashboard to continue.</li>
            <li>Some questions have more than one correct answer and say "Select all that apply". You must pick every correct option, and nothing else, to get the mark.</li>
            <li>The exam is submitted automatically when time runs out.</li>
            <li>The exam runs in full screen. Leaving the exam tab or window is recorded.</li>
            <li>Use a laptop or desktop with a stable internet connection, in a quiet place.</li>
          </ul>
          )}
        </div>
        {proctored && (
          <>
            <div>
              <h2>Exam rules and recording</h2>
              <ProctoringRules />
            </div>
            <label className="check">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>I agree to the exam rules and to my screen, camera and microphone being recorded for this exam and reviewed by an examiner.</span>
            </label>
            {consent && <SecurityCheck onReady={setChecked} />}
          </>
        )}
        {start.isError && <Alert kind="error">{start.error.message}</Alert>}
        {fullscreenError && <Alert kind="error">{fullscreenError}</Alert>}
        <label className="check">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span>I understand that starting uses this attempt and that the timer starts as soon as I begin.</span>
        </label>
        <div className="row">
          <button className="btn" disabled={!agreed || start.isPending || (proctored && !(consent && checked))} onClick={begin}>
            {start.isPending ? 'Starting…' : proctored ? 'Begin exam in full screen' : 'Begin exam'}
          </button>
          <Link className="btn secondary" to="/dashboard">Not now</Link>
        </div>
      </div>
    </main>
  )
}
