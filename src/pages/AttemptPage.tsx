import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { api, ApiError, formatDate, post, put, type Attempt, type AttemptQuestion, type ReviewItem } from '../api'
import { Alert } from '../components/Field'
import { ThemeToggle } from '../components/Layout'

export function AttemptPage() {
  const { attemptId } = useParams()
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['attempt', attemptId],
    queryFn: () => api<Attempt>(`/api/attempts/${attemptId}`),
  })

  const { refetch } = query
  // Kept stable so the runner's save and timer effects aren't torn down on every render.
  const finished = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    refetch()
  }, [queryClient, refetch])

  if (query.isPending) return <main className="container page muted">Loading exam…</main>
  if (query.isError) {
    return (
      <main className="container page narrow">
        <Alert kind="error">{query.error.message}</Alert>
        <Link to="/dashboard" className="btn secondary">Back to dashboard</Link>
      </main>
    )
  }
  const attempt = query.data
  return attempt.status === 'COMPLETED' ? <ResultView attempt={attempt} /> : <ExamRunner attempt={attempt} onFinished={finished} />
}

// ---------------------------------------------------------------------------------------------

function ExamRunner({ attempt, onFinished }: { attempt: Attempt; onFinished: () => void }) {
  const id = attempt.id
  const questions = attempt.questions
  const flagsKey = `pwl-flags-${id}`

  // The server's clock is the source of truth; remember how far ours is off.
  const [clockOffset] = useState(() => Date.parse(attempt.serverTime) - Date.now())
  const deadline = Date.parse(attempt.deadlineAt)
  const [now, setNow] = useState(() => Date.now())
  const remaining = Math.max(0, Math.floor((deadline - (now + clockOffset)) / 1000))

  const [answers, setAnswers] = useState<Record<number, number[]>>(() =>
    Object.fromEntries(questions.map((q) => [q.id, q.selected])),
  )
  const [index, setIndex] = useState(0)
  const [flagged, setFlagged] = useState<number[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(flagsKey) ?? '[]')
    } catch {
      return []
    }
  })
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [focusLosses, setFocusLosses] = useState(attempt.tabSwitches)

  // Answers not yet confirmed by the server, saved one at a time in order.
  const pending = useRef(new Map<number, number[]>())
  const flushing = useRef<Promise<void> | null>(null)

  const flush = useCallback((): Promise<void> => {
    if (flushing.current) return flushing.current
    const run = async () => {
      try {
        while (pending.current.size) {
          const [questionId, optionIds] = pending.current.entries().next().value!
          setSaveState('saving')
          await put(`/api/attempts/${id}/answers`, { questionId, optionIds })
          if (pending.current.get(questionId) === optionIds) pending.current.delete(questionId)
        }
        setSaveState('saved')
      } catch (err) {
        if (err instanceof ApiError && err.code === 'ATTEMPT_CLOSED') {
          pending.current.clear()
          onFinished()
          return
        }
        setSaveState('error')
      }
    }
    flushing.current = run().finally(() => {
      flushing.current = null
    })
    return flushing.current
  }, [id, onFinished])

  const submit = useCallback(async () => {
    setSubmitting(true)
    await flush()
    try {
      await post(`/api/attempts/${id}/submit`)
    } catch {
      // Even if this fails, the server grades the attempt at the deadline.
    }
    try {
      localStorage.removeItem(flagsKey)
    } catch {
      // ignore
    }
    onFinished()
  }, [flush, id, flagsKey, onFinished])

  // Tick the clock.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // Submit automatically when time runs out.
  useEffect(() => {
    if (remaining === 0 && !submitting) submit()
  }, [remaining, submitting, submit])

  // Retry unsaved answers.
  useEffect(() => {
    if (saveState !== 'error') return
    const t = setTimeout(flush, 5000)
    return () => clearTimeout(t)
  }, [saveState, flush])

  // Record leaving the tab or window.
  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState !== 'hidden') return
      setFocusLosses((n) => n + 1)
      post(`/api/attempts/${id}/focus-lost`).catch(() => {})
    }
    document.addEventListener('visibilitychange', onHidden)
    return () => document.removeEventListener('visibilitychange', onHidden)
  }, [id])

  // Warn before closing or reloading the tab.
  useEffect(() => {
    if (submitting) return
    const onUnload = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [submitting])

  function choose(q: AttemptQuestion, optionId: number) {
    const current = answers[q.id] ?? []
    const next =
      q.type === 'SINGLE'
        ? [optionId]
        : current.includes(optionId)
          ? current.filter((x) => x !== optionId)
          : [...current, optionId]
    setAnswers({ ...answers, [q.id]: next })
    pending.current.set(q.id, next)
    flush()
  }

  function toggleFlag(questionId: number) {
    const next = flagged.includes(questionId) ? flagged.filter((x) => x !== questionId) : [...flagged, questionId]
    setFlagged(next)
    try {
      localStorage.setItem(flagsKey, JSON.stringify(next))
    } catch {
      // Flags are a convenience; losing them is harmless.
    }
  }

  const q = questions[index]
  const selected = answers[q.id] ?? []
  const unanswered = questions.filter((x) => !(answers[x.id]?.length)).length
  const minutes = Math.floor(remaining / 60)
  const seconds = remaining % 60

  return (
    <>
      <header className="exam-bar">
        <div className="container">
          <strong>{attempt.examTitle}</strong>
          <span className="faint" aria-live="polite" style={{ marginLeft: 'auto' }}>
            {saveState === 'saving' && 'Saving…'}
            {saveState === 'saved' && 'All answers saved'}
            {saveState === 'error' && <span style={{ color: 'var(--danger)' }}>Not saved, retrying…</span>}
          </span>
          <span className={`timer ${remaining < 300 ? 'low' : ''}`} aria-label="Time remaining">
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </span>
          <ThemeToggle />
        </div>
      </header>

      <main className="container page">
        {focusLosses > 0 && (
          <Alert kind="warn">
            You left the exam window {focusLosses} {focusLosses === 1 ? 'time' : 'times'}. This is recorded and reviewed with your result.
          </Alert>
        )}
        <div className="exam-layout">
          <section className="card">
            <div className="spread">
              <span className="faint">
                Question {index + 1} of {questions.length}
                {q.topic && <> · {q.topic}</>}
              </span>
              <button className="btn secondary small" onClick={() => toggleFlag(q.id)}>
                {flagged.includes(q.id) ? '★ Flagged' : '☆ Flag for review'}
              </button>
            </div>
            <h2 style={{ marginTop: 12, fontSize: '1.2rem' }}>{q.text}</h2>
            {q.type === 'MULTI' && <div className="badge orange">Select all that apply</div>}
            {q.codeSnippet && <pre>{q.codeSnippet}</pre>}
            <div className="options" role={q.type === 'SINGLE' ? 'radiogroup' : 'group'}>
              {q.options.map((o) => {
                const isSelected = selected.includes(o.id)
                return (
                  <label key={o.id} className={`option ${isSelected ? 'selected' : ''}`}>
                    <input
                      type={q.type === 'SINGLE' ? 'radio' : 'checkbox'}
                      name={`q-${q.id}`}
                      checked={isSelected}
                      onChange={() => choose(q, o.id)}
                    />
                    {looksLikeCode(o.text) ? <code>{o.text}</code> : <span>{o.text}</span>}
                  </label>
                )
              })}
            </div>
            <div className="spread" style={{ marginTop: 24 }}>
              <button className="btn secondary" disabled={index === 0} onClick={() => setIndex(index - 1)}>
                ← Previous
              </button>
              {index < questions.length - 1 ? (
                <button className="btn" onClick={() => setIndex(index + 1)}>Next →</button>
              ) : (
                <button className="btn" onClick={() => setConfirming(true)}>Review and submit</button>
              )}
            </div>
          </section>

          <aside className="card tight">
            <div className="spread" style={{ marginBottom: 12 }}>
              <strong>Questions</strong>
              <span className="faint">{questions.length - unanswered}/{questions.length} answered</span>
            </div>
            <div className="palette">
              {questions.map((x, i) => (
                <button
                  key={x.id}
                  className={[
                    answers[x.id]?.length ? 'answered' : '',
                    flagged.includes(x.id) ? 'flagged' : '',
                    i === index ? 'current' : '',
                  ].join(' ')}
                  onClick={() => setIndex(i)}
                  aria-label={`Question ${i + 1}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <div className="legend">
              <span style={{ color: 'var(--primary)' }}>■ answered</span>
              <span style={{ color: 'var(--warn)' }}>□ flagged</span>
            </div>
            <button className="btn block" style={{ marginTop: 16 }} onClick={() => setConfirming(true)}>
              Submit exam
            </button>
          </aside>
        </div>
      </main>

      {confirming && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <div className="card modal stack">
            <h2 id="confirm-title">Submit your exam?</h2>
            {unanswered > 0 ? (
              <Alert kind="warn">
                You have {unanswered} unanswered {unanswered === 1 ? 'question' : 'questions'}. Unanswered questions score zero.
              </Alert>
            ) : (
              <p className="muted">You have answered every question.</p>
            )}
            {flagged.length > 0 && <p className="muted">{flagged.length} question(s) are flagged for review.</p>}
            <p className="muted">
              {attempt.practice
                ? 'After submitting you will see the correct answers with explanations.'
                : 'You cannot change your answers after submitting.'}
            </p>
            <div className="row">
              <button className="btn" disabled={submitting} onClick={submit}>
                {submitting ? 'Submitting…' : 'Submit now'}
              </button>
              <button className="btn secondary" disabled={submitting} onClick={() => setConfirming(false)}>
                Keep working
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/** Options such as `page.getByRole('button')` read better in monospace; plain sentences don't. */
function looksLikeCode(text: string) {
  return /[(){}[\]=>`]|^\w+\.\w+|^npx /.test(text)
}

// ---------------------------------------------------------------------------------------------

function ResultView({ attempt }: { attempt: Attempt }) {
  const r = attempt.result!
  return (
    <>
      <header className="exam-bar">
        <div className="container">
          <Link to="/dashboard" className="brand">
            <img src="/logo-nav.png" alt="" />
            <span>Playwright Labs</span>
          </Link>
          <span style={{ marginLeft: 'auto' }} />
          <Link to="/dashboard">Dashboard</Link>
          <ThemeToggle />
        </div>
      </header>
      <main className="container page stack" style={{ maxWidth: 760 }}>
        <div className="card stack" style={{ textAlign: 'center' }}>
          <div className={`badge ${r.passed ? 'green' : 'red'}`} style={{ alignSelf: 'center' }}>
            {attempt.practice ? 'Practice test · ' : ''}{r.passed ? 'Passed' : 'Not passed'}
          </div>
          <h1>
            {attempt.practice
              ? r.passed ? 'Well done!' : 'Keep practising'
              : r.passed ? 'Congratulations!' : 'Thank you for taking the exam'}
          </h1>
          <p className="muted">
            {attempt.examTitle} · submitted {formatDate(r.submittedAt, true)}
            {r.autoSubmitted && ' (time ran out)'}
          </p>
          <div className="facts" style={{ margin: 0 }}>
            <div className="card"><div className="stat">{r.scorePercent}%</div><div className="stat-label">your score</div></div>
            <div className="card"><div className="stat">{r.correctCount}/{attempt.totalQuestions}</div><div className="stat-label">correct</div></div>
            <div className="card"><div className="stat">{attempt.passPercent}%</div><div className="stat-label">pass mark</div></div>
          </div>
          {r.certificateNo && (
            <div className="row" style={{ justifyContent: 'center' }}>
              <a className="btn" href={`/api/me/certificates/${r.certificateNo}/pdf`} download>
                {r.passed ? 'Download certificate' : 'Download certificate of participation'}
              </a>
              <Link className="btn secondary" to={`/verify/${r.certificateNo}`}>Public verification page</Link>
            </div>
          )}
          {attempt.practice ? (
            <div className="row" style={{ justifyContent: 'center' }}>
              <Link className="btn" to="/dashboard">Back to dashboard</Link>
              <a className="btn secondary" href="#review">Review your answers</a>
            </div>
          ) : !r.passed && (
            <p className="muted" style={{ marginBottom: 0 }}>
              The topic breakdown below shows where to focus. When your retake opens, you can book it
              from your <Link to="/dashboard">dashboard</Link>; the free practice test there is a good way to
              prepare.
              {r.certificateNo && ' Your certificate is saved in your dashboard, so you can download it again at any time.'}
            </p>
          )}
        </div>

        <div className="card">
          <h2>Score by topic</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Topic</th><th>Correct</th><th>Score</th></tr>
              </thead>
              <tbody>
                {r.topics.map((t) => (
                  <tr key={t.topic}>
                    <td>{t.topic}</td>
                    <td>{t.correct} / {t.total}</td>
                    <td>{Math.round((t.correct * 100) / t.total)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {r.review && (
          <section className="stack" id="review">
            <h2>Your answers</h2>
            {r.review.map((item) => <ReviewCard key={item.position} item={item} />)}
          </section>
        )}
      </main>
    </>
  )
}

function ReviewCard({ item }: { item: ReviewItem }) {
  return (
    <div className="card stack">
      <div className="spread">
        <span className="faint">
          Question {item.position}
          {item.topic && <> · {item.topic}</>}
        </span>
        <span className={`badge ${item.correct ? 'green' : 'red'}`}>{item.correct ? 'Correct' : 'Incorrect'}</span>
      </div>
      <h3 style={{ margin: 0 }}>{item.text}</h3>
      {item.codeSnippet && <pre style={{ margin: 0 }}>{item.codeSnippet}</pre>}
      <ul className="review-options">
        {item.options.map((o) => {
          const picked = item.selected.includes(o.id)
          return (
            <li key={o.id} className={o.correct ? 'right' : picked ? 'wrong' : ''}>
              <span aria-hidden="true">{o.correct ? '✓' : picked ? '✗' : '·'}</span>
              {looksLikeCode(o.text) ? <code>{o.text}</code> : <span>{o.text}</span>}
              {picked && <span className="faint"> (your answer)</span>}
            </li>
          )
        })}
      </ul>
      {item.explanation && <p className="muted" style={{ margin: 0 }}><strong>Why:</strong> {item.explanation}</p>}
    </div>
  )
}
