import { javascript } from '@codemirror/lang-javascript'
import CodeMirror from '@uiw/react-codemirror'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { api, ApiError, labLanguage, post, put, type Attempt, type LabRun, type LabTask } from '../api'
import { Alert } from '../components/Field'
import { ThemeToggle } from '../components/Layout'

// Built once per language, so the editor isn't reconfigured on every render.
const EDITOR = {
  TYPESCRIPT: [javascript({ typescript: true })],
  JAVASCRIPT: [javascript()],
}

/**
 * The hands-on lab: one test file per task, written in the browser, run against the practice app with
 * "Run tests", and graded in the sandbox after submission. Unlike the multiple-choice exam it doesn't force full
 * screen or record leaving the tab, because candidates need the practice app open in another tab.
 */
export function LabRunner({ attempt, onFinished }: { attempt: Attempt; onFinished: () => void }) {
  const lab = attempt.lab!
  const language = labLanguage(lab.language ?? 'TYPESCRIPT')
  const [active, setActive] = useState(lab.tasks[0]?.id)
  const [code, setCode] = useState<Record<number, string>>(() => Object.fromEntries(lab.tasks.map((t) => [t.id, t.code])))
  const [runs, setRuns] = useState<Record<number, LabRun | null>>(() => Object.fromEntries(lab.tasks.map((t) => [t.id, t.lastRun])))
  const [runsLeft, setRunsLeft] = useState(lab.practiceRunsLeft)
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved')
  const [runError, setRunError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const dirty = useRef(new Set<number>())
  const remaining = useRemaining(attempt)
  const task = lab.tasks.find((t) => t.id === active) as LabTask
  const run = runs[active]
  const running = run?.status === 'QUEUED' || run?.status === 'RUNNING'

  async function save(taskId: number) {
    if (!dirty.current.has(taskId)) return
    dirty.current.delete(taskId)
    setSaveState('saving')
    try {
      await put(`/api/attempts/${attempt.id}/lab/${taskId}`, { code: code[taskId] })
      setSaveState(dirty.current.size ? 'saving' : 'saved')
    } catch (e) {
      dirty.current.add(taskId)
      setSaveState('error')
      if (e instanceof ApiError && e.code === 'ATTEMPT_CLOSED') onFinished()
    }
  }

  // Autosave shortly after typing stops.
  useEffect(() => {
    if (!dirty.current.size) return
    const t = setTimeout(() => dirty.current.forEach((id) => save(id)), 800)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  // Follow a queued or running test run until it finishes.
  useEffect(() => {
    if (!running || !run) return
    const t = setInterval(async () => {
      const next = await api<LabRun>(`/api/attempts/${attempt.id}/lab/runs/${run.id}`).catch(() => null)
      if (next) setRuns((r) => ({ ...r, [next.taskId!]: next }))
    }, 2000)
    return () => clearInterval(t)
  }, [running, run, attempt.id])

  // Time's up: the server grades the saved code; show the grading screen.
  useEffect(() => {
    if (remaining <= 0) onFinished()
  }, [remaining, onFinished])

  async function runTests() {
    setRunError(null)
    dirty.current.add(active)
    await save(active)
    try {
      const started = await post<LabRun>(`/api/attempts/${attempt.id}/lab/${active}/runs`)
      setRuns((r) => ({ ...r, [active]: started }))
      setRunsLeft((n) => Math.max(0, n - 1))
    } catch (e) {
      setRunError((e as Error).message)
    }
  }

  async function submit() {
    setSubmitting(true)
    await Promise.all([...dirty.current].map((id) => save(id)))
    try {
      await post(`/api/attempts/${attempt.id}/submit`)
    } finally {
      onFinished()
    }
  }

  const minutes = Math.floor(Math.max(0, remaining) / 60)
  const seconds = Math.max(0, remaining) % 60

  return (
    <>
      <header className="exam-bar">
        <div className="container">
          <strong>{attempt.examTitle}</strong>
          <span className="faint" aria-live="polite" style={{ marginLeft: 'auto' }}>
            {saveState === 'saving' && 'Saving…'}
            {saveState === 'saved' && 'All code saved'}
            {saveState === 'error' && <span style={{ color: 'var(--danger)' }}>Not saved, retrying…</span>}
          </span>
          <span className={`timer ${remaining < 300 ? 'low' : ''}`} aria-label="Time remaining">
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </span>
          <ThemeToggle />
        </div>
      </header>

      <main className="container page lab-layout">
        <aside className="card tight stack">
          <strong>Tasks</strong>
          <nav className="lab-tasks" aria-label="Tasks">
            {lab.tasks.map((t, i) => (
              <button
                key={t.id}
                className={t.id === active ? 'current' : ''}
                aria-current={t.id === active ? 'true' : undefined}
                onClick={() => {
                  save(active)
                  setActive(t.id)
                }}
              >
                <span>{i + 1}. {t.title}</span>
                {runs[t.id]?.status === 'DONE' && (
                  <span className={`badge ${runs[t.id]!.passed ? 'green' : 'red'}`}>{runs[t.id]!.passed ? 'passing' : 'failing'}</span>
                )}
              </button>
            ))}
          </nav>
          <a className="btn secondary block" href={lab.practiceAppUrl} target="_blank" rel="noreferrer">
            Open the practice app ↗
          </a>
          <p className="faint" style={{ margin: 0 }}>
            Your tests run with baseURL set to the practice app, so use relative paths such as page.goto('login.html').
            Chromium only. Only @playwright/test can be imported{language.value === 'JAVASCRIPT' ? ', with import (not require)' : ''}.
          </p>
          <button className="btn block" onClick={() => setConfirming(true)}>Submit lab</button>
        </aside>

        <section className="stack">
          <div className="card">
            <h2 style={{ marginTop: 0 }}>{task.title}</h2>
            <div className="lab-instructions">{task.instructions}</div>
          </div>

          <div className="card tight stack">
            <div className="spread">
              <span className="row" style={{ gap: 8 }}>
                <code>{task.key}.spec.{language.extension}</code>
                <span className="badge">{language.label}</span>
              </span>
              <div className="row">
                <span className="faint">{runsLeft} test runs left</span>
                <button className="btn" disabled={running || runsLeft === 0} onClick={runTests}>
                  {running ? 'Running…' : 'Run tests'}
                </button>
              </div>
            </div>
            <div className="lab-editor">
              <CodeMirror
                value={code[active]}
                height="420px"
                extensions={EDITOR[language.value]}
                basicSetup={{ tabSize: 2 }}
                onChange={(value) => {
                  dirty.current.add(active)
                  setCode((c) => ({ ...c, [active]: value }))
                }}
                aria-label={`Test code for ${task.title}`}
              />
            </div>
            {runError && <Alert kind="error">{runError}</Alert>}
          </div>

          {run && <RunResult run={run} />}
        </section>
      </main>

      {confirming && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="lab-confirm-title">
          <div className="card modal stack">
            <h2 id="lab-confirm-title">Submit your lab?</h2>
            <p className="muted">
              Your saved code for every task will be graded: first on the working practice app, then against hidden broken
              versions of it. Grading usually takes a few minutes. You can't change your code after submitting.
            </p>
            <div className="row">
              <button className="btn" disabled={submitting} onClick={submit}>{submitting ? 'Submitting…' : 'Submit now'}</button>
              <button className="btn secondary" disabled={submitting} onClick={() => setConfirming(false)}>Keep working</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function RunResult({ run }: { run: LabRun }) {
  if (run.status === 'QUEUED' || run.status === 'RUNNING') {
    return <div className="card tight muted" role="status">{run.status === 'QUEUED' ? 'Waiting for a free test runner…' : 'Running your tests…'}</div>
  }
  if (run.status === 'ERROR') {
    return <Alert kind="error">{run.errors[0] ?? 'The test run failed to start. Please try again.'}</Alert>
  }
  return (
    <div className="card tight stack" role="status">
      <strong style={{ color: run.passed ? 'var(--primary)' : 'var(--danger)' }}>
        {run.passed ? `All ${run.total} tests passed on the practice app` : `${run.failed} of ${run.total} tests failed`}
      </strong>
      {run.errors.map((e, i) => <pre key={i} className="lab-output">{e}</pre>)}
      <ul className="review-options">
        {run.tests.map((t, i) => (
          <li key={i} className={t.status === 'passed' ? 'right' : t.status === 'skipped' ? '' : 'wrong'}>
            <span aria-hidden="true">{t.status === 'passed' ? '✓' : t.status === 'skipped' ? '–' : '✗'}</span>
            <div style={{ minWidth: 0 }}>
              <div>{t.title}</div>
              {t.error && <pre className="lab-output">{t.error}</pre>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Seconds left, on the server's clock. */
function useRemaining(attempt: Attempt) {
  const [offset] = useState(() => Date.parse(attempt.serverTime) - Date.now())
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  return Math.floor((Date.parse(attempt.deadlineAt) - (now + offset)) / 1000)
}

/** Shown after submission while the sandbox grades the lab. */
export function LabGrading({ attempt, onRefresh }: { attempt: Attempt; onRefresh: () => void }) {
  useEffect(() => {
    const t = setInterval(onRefresh, 5000)
    return () => clearInterval(t)
  }, [onRefresh])
  return (
    <main className="container page narrow stack" style={{ maxWidth: 640 }}>
      <div className="card stack" style={{ textAlign: 'center' }}>
        <h1>Grading your lab…</h1>
        <p className="muted">
          Your tests for {attempt.examTitle} are running against the practice app and its hidden broken versions. This
          usually takes a few minutes; you can leave this page and we'll email you the result.
        </p>
        {attempt.lab?.gradingProblem && <Alert kind="warn">{attempt.lab.gradingProblem}</Alert>}
        <Link className="btn secondary" to="/dashboard" style={{ alignSelf: 'center' }}>Back to dashboard</Link>
      </div>
    </main>
  )
}
