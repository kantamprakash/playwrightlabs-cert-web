import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { api, formatDate, formatDateTime, post, put, type Dashboard as DashboardData, type ExamAccess, type ExamSummary } from '../api'
import { useMe } from '../auth'
import { Alert } from '../components/Field'
import { MAIN_SITE } from '../components/Layout'
import { SchedulePicker } from '../components/SchedulePicker'

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api<DashboardData>('/api/me/dashboard'),
    // Keeps states such as "scheduled" -> "ready" current while the page stays open.
    refetchInterval: 60_000,
  })
}

export function Dashboard() {
  const { data: me } = useMe()
  const { data, isPending, error } = useDashboard()
  const { data: exams } = useQuery({ queryKey: ['exams'], queryFn: () => api<ExamSummary[]>('/api/exams') })
  // Each exam can be enrolled in once; after that it shows under "Your exams" instead.
  const notEnrolled = (exams ?? []).filter((x) => !data?.exams.some((e) => e.exam.id === x.id))

  return (
    <main className="container page stack">
      <div>
        <h1>Welcome, {me?.fullName.split(' ')[0]}</h1>
        <p className="muted">Your exams and certificates.</p>
      </div>

      {error && <Alert kind="error">{error.message}</Alert>}
      {isPending && <p className="muted">Loading…</p>}

      {data && (
        <>
          {notEnrolled.length > 0 && (
            <section className="stack">
              <h2>Available certifications</h2>
              {notEnrolled.map((exam) => <EnrolCard key={exam.id} exam={exam} minNotice={data.minScheduleNoticeMinutes} />)}
            </section>
          )}

          {data.exams.length > 0 && (
            <section className="stack">
              <h2>Your exams</h2>
              {data.exams.map((e) => (
                <ExamCard key={e.entitlementId} access={e} serverTime={data.serverTime} minNotice={data.minScheduleNoticeMinutes} />
              ))}
            </section>
          )}

          {data.exams.length === 0 && exams?.length === 0 && (
            <div className="card">
              <h3>No exams are open yet</h3>
              <p className="muted" style={{ margin: 0 }}>
                The Playwright Certified Tester exam opens soon. <a href={`${MAIN_SITE}/contact.html`}>Contact Playwright Labs</a> if
                you have questions.
              </p>
            </div>
          )}

          {data.certificates.length > 0 && (
            <section className="stack">
              <h2>Your certificates</h2>
              {data.certificates.map((c) => (
                <div className="card spread" key={c.certNo}>
                  <div>
                    <div style={{ marginBottom: 6 }}>
                      {c.certified
                        ? <span className="badge green">Certificate of Achievement</span>
                        : <span className="badge">Certificate of Participation</span>}
                    </div>
                    <h3 style={{ marginBottom: 4 }}>{c.examTitle}</h3>
                    <div className="faint">
                      Credential ID {c.certNo} · Issued {formatDate(c.issuedAt)} · Score {c.scorePercent}%
                    </div>
                  </div>
                  {c.revoked ? (
                    <span className="badge red">Revoked</span>
                  ) : (
                    <div className="row">
                      <a className="btn" href={`/api/me/certificates/${c.certNo}/pdf`} download>Download certificate (PDF)</a>
                      <Link className="btn secondary" to={`/verify/${c.certNo}`}>Public verification link</Link>
                    </div>
                  )}
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </main>
  )
}

function EnrolCard({ exam, minNotice }: { exam: ExamSummary; minNotice: number }) {
  const queryClient = useQueryClient()
  const [choosing, setChoosing] = useState(false)
  const enrol = useMutation({
    mutationFn: (scheduledAt: string) => post<{ entitlementId: number }>(`/api/exams/${exam.slug}/enrol`, { scheduledAt }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
  })

  return (
    <div className="card stack">
      <div className="spread">
        <div>
          <h3 style={{ marginBottom: 4 }}>{exam.title}</h3>
          <div className="faint">
            {exam.questionCount} questions · {exam.durationMinutes} minutes · Pass mark {exam.passPercent}% · One attempt
          </div>
        </div>
        {!choosing && (
          <div className="row">
            <span className="badge green">Free enrolment</span>
            <button className="btn" onClick={() => setChoosing(true)}>Enrol now</button>
          </div>
        )}
      </div>
      <p className="muted" style={{ margin: 0 }}>{exam.description}</p>
      {choosing && (
        <SchedulePicker
          minNoticeMinutes={minNotice}
          submitLabel="Confirm enrolment"
          pending={enrol.isPending}
          error={enrol.error?.message}
          onSubmit={(at) => enrol.mutate(at)}
          onCancel={() => { enrol.reset(); setChoosing(false) }}
        />
      )}
    </div>
  )
}

function ExamCard({ access: a, serverTime, minNotice }: { access: ExamAccess; serverTime: string; minNotice: number }) {
  const queryClient = useQueryClient()
  const [choosing, setChoosing] = useState(false)
  const book = useMutation({
    mutationFn: (scheduledAt: string) => put(`/api/me/enrolments/${a.entitlementId}/schedule`, { scheduledAt }),
    onSuccess: () => {
      setChoosing(false)
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
  const canSchedule = a.state === 'NOT_SCHEDULED' || a.state === 'SCHEDULED' || a.state === 'MISSED' || a.state === 'READY'

  return (
    <div className="card stack">
      <div className="spread">
        <div>
          <h3 style={{ marginBottom: 4 }}>{a.exam.title}</h3>
          <div className="faint">
            {a.exam.questionCount} questions · {a.exam.durationMinutes} minutes · Pass mark {a.exam.passPercent}%
          </div>
          {a.state === 'NOT_SCHEDULED' && <div className="faint">Book a time before {formatDate(a.expiresAt)}</div>}
          {(a.state === 'SCHEDULED' || a.state === 'READY') && (
            <div style={{ marginTop: 4 }}>
              Scheduled for <strong>{formatDateTime(a.scheduledAt)}</strong>
            </div>
          )}
          {a.state === 'READY' && (
            <div style={{ color: 'var(--primary)' }}>Your exam is open. Start by {formatDateTime(a.startWindowEndsAt)}.</div>
          )}
          {a.state === 'MISSED' && (
            <div style={{ color: 'var(--warn)' }}>
              You missed your start time ({formatDateTime(a.scheduledAt)}). Choose a new time to take the exam.
            </div>
          )}
        </div>
        {!choosing && (
          <div className="row">
            {a.state === 'NOT_SCHEDULED' && <button className="btn" onClick={() => setChoosing(true)}>Choose exam time</button>}
            {a.state === 'MISSED' && <button className="btn" onClick={() => setChoosing(true)}>Choose a new time</button>}
            {a.state === 'SCHEDULED' && (
              <>
                <button className="btn secondary" onClick={() => setChoosing(true)}>Reschedule</button>
                <button className="btn" disabled title="Available at your scheduled time">Start exam</button>
              </>
            )}
            {a.state === 'READY' && <Link className="btn" to={`/start/${a.entitlementId}`}>Start exam</Link>}
            {a.state === 'IN_PROGRESS' && <Link className="btn" to={`/attempts/${a.attemptId}`}>Resume exam</Link>}
            {a.state === 'EXPIRED' && <span className="badge">Access expired</span>}
            {a.state === 'COMPLETED' && (
              <>
                <span className={`badge ${a.passed ? 'green' : 'red'}`}>
                  {a.passed ? 'Passed' : 'Not passed'} · {a.scorePercent}%
                </span>
                <Link className="btn secondary small" to={`/attempts/${a.attemptId}`}>View result</Link>
              </>
            )}
          </div>
        )}
      </div>
      {a.state === 'SCHEDULED' && !choosing && (
        <Countdown label="Your exam starts in" to={a.scheduledAt!} serverTime={serverTime} />
      )}
      {a.state === 'READY' && <Countdown label="Time left to start" to={a.startWindowEndsAt!} serverTime={serverTime} urgent />}
      {choosing && canSchedule && (
        <SchedulePicker
          minNoticeMinutes={minNotice}
          latest={a.expiresAt}
          initial={a.scheduledAt}
          submitLabel={a.state === 'NOT_SCHEDULED' ? 'Book this time' : 'Save new time'}
          pending={book.isPending}
          error={book.error?.message}
          onSubmit={(at) => book.mutate(at)}
          onCancel={() => { book.reset(); setChoosing(false) }}
        />
      )}
    </div>
  )
}

/**
 * Live countdown in days, hours, minutes and seconds, counted on the server's clock so a wrong computer
 * clock doesn't mislead the candidate. Refreshes the dashboard when it reaches zero (e.g. to unlock Start).
 */
function Countdown({ label, to, serverTime, urgent = false }: { label: string; to: string; serverTime: string; urgent?: boolean }) {
  const queryClient = useQueryClient()
  const [offset] = useState(() => Date.parse(serverTime) - Date.now())
  const [now, setNow] = useState(() => Date.now())
  const remaining = Date.parse(to) - (now + offset)
  const due = remaining <= 0

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (due) queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }, [due, queryClient])

  const s = Math.max(0, Math.floor(remaining / 1000))
  const units = [
    { value: Math.floor(s / 86400), label: 'days' },
    { value: Math.floor((s % 86400) / 3600), label: 'hours' },
    { value: Math.floor((s % 3600) / 60), label: 'minutes' },
    { value: s % 60, label: 'seconds' },
  ]

  return (
    <div className={`countdown ${urgent ? 'urgent' : ''}`} role="timer" aria-live="off">
      <div className="countdown-label">{due ? 'Opening…' : label}</div>
      <div className="countdown-units">
        {units.map((u) => (
          <div className="countdown-unit" key={u.label}>
            <span className="countdown-value">{String(u.value).padStart(2, '0')}</span>
            <span className="countdown-name">{u.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
