import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import {
  api, formatDate, formatDateTime, labLanguage, post, put, rupees,
  type Dashboard as DashboardData, type ExamAccess, type LabLanguage, type ExamSummary, type Offer, type OrderView, type PracticeResult,
} from '../api'
import { useMe } from '../auth'
import { Checkout } from '../components/Checkout'
import { Alert } from '../components/Field'
import { LanguagePicker } from '../components/LanguagePicker'
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
  const { data: orders } = useQuery({ queryKey: ['orders'], queryFn: () => api<OrderView[]>('/api/me/orders') })
  const invoices = (orders ?? []).filter((o) => o.invoiceNo)

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
          {data.exams.length > 0 && (
            <section className="stack">
              <h2>Your exams</h2>
              {data.exams.map((e) => (
                <ExamCard key={e.entitlementId} access={e} serverTime={data.serverTime} minNotice={data.minScheduleNoticeMinutes} />
              ))}
            </section>
          )}

          {data.offers.length > 0 && (
            <section className="stack">
              <h2>{data.offers.some((o) => o.retake) ? 'Book again' : 'Get certified'}</h2>
              {data.offers.map((o) => <OfferCard key={o.exam.id} offer={o} />)}
            </section>
          )}

          {data.practiceTests.length > 0 && (
            <section className="stack">
              <h2>Practice</h2>
              {data.practiceTests.map((p) => <PracticeCard key={p.id} exam={p} results={data.practiceResults} />)}
            </section>
          )}

          {data.exams.length === 0 && data.offers.length === 0 && (
            <div className="card">
              <h3>No exams are open yet</h3>
              <p className="muted" style={{ margin: 0 }}>
                The Playwright Certified Professional exam opens soon. <a href={`${MAIN_SITE}/contact.html`}>Contact Playwright Labs</a> if
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

          {invoices.length > 0 && (
            <section className="stack">
              <h2>Payments</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Date</th><th>Item</th><th>Amount</th><th>Invoice</th></tr>
                  </thead>
                  <tbody>
                    {invoices.map((o) => (
                      <tr key={o.id}>
                        <td>{formatDate(o.paidAt)}</td>
                        <td>{o.examTitle}{o.retake && ' (retake)'}</td>
                        <td>{rupees(o.amountPaise / 100)}</td>
                        <td><a href={`/api/me/orders/${o.id}/invoice`} download>{o.invoiceNo}</a></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </main>
  )
}

function OfferCard({ offer }: { offer: Offer }) {
  const [buying, setBuying] = useState(false)
  const { exam } = offer
  const waiting = offer.availableFrom !== null || offer.lockedReason !== null

  return (
    <div className="card stack">
      <div className="spread">
        <div>
          <h3 style={{ marginBottom: 4 }}>{exam.title}{offer.retake && ' – retake'}</h3>
          <div className="faint">
            {exam.questionCount} {exam.kind === 'LAB' ? 'hands-on tasks' : 'questions'} · {exam.durationMinutes} minutes · Pass mark {exam.passPercent}%
          </div>
          {offer.lockedReason && <div style={{ color: 'var(--warn)', marginTop: 4 }}>{offer.lockedReason}</div>}
          {offer.availableFrom && (
            <div style={{ color: 'var(--warn)', marginTop: 4 }}>
              Your retake opens on {formatDate(offer.availableFrom)}. Use the practice test to prepare.
            </div>
          )}
        </div>
        {!buying && (
          <div className="row">
            <span className="badge">{rupees(offer.priceInr)} incl. GST</span>
            <button className="btn" disabled={waiting} onClick={() => setBuying(true)}>
              {offer.retake ? 'Book retake' : 'Enrol now'}
            </button>
          </div>
        )}
      </div>
      {!offer.retake && <p className="muted" style={{ margin: 0 }}>{exam.description}</p>}
      {buying && <Checkout offer={offer} onDone={() => setBuying(false)} onCancel={() => setBuying(false)} />}
    </div>
  )
}

function PracticeCard({ exam, results }: { exam: ExamSummary; results: PracticeResult[] }) {
  const navigate = useNavigate()
  const start = useMutation({
    mutationFn: () => post<{ attemptId: number }>(`/api/attempts/practice/${exam.slug}`),
    onSuccess: ({ attemptId }) => navigate(`/attempts/${attemptId}`),
  })
  const mine = results.filter((r) => r.examTitle === exam.title)
  const open = mine.find((r) => r.status === 'IN_PROGRESS')

  return (
    <div className="card stack">
      <div className="spread">
        <div>
          <h3 style={{ marginBottom: 4 }}>{exam.title}</h3>
          <div className="faint">
            Free · {exam.questionCount} questions · {exam.durationMinutes} minutes · answers and explanations at the end
          </div>
        </div>
        <button className="btn secondary" disabled={start.isPending} onClick={() => start.mutate()}>
          {open ? 'Resume practice' : mine.length ? 'Practise again' : 'Start practice test'}
        </button>
      </div>
      {start.isError && <Alert kind="error">{start.error.message}</Alert>}
      {mine.some((r) => r.status === 'COMPLETED') && (
        <div className="faint">
          Recent scores:{' '}
          {mine.filter((r) => r.status === 'COMPLETED').slice(0, 5).map((r, i) => (
            <span key={r.attemptId}>
              {i > 0 && ', '}
              <Link to={`/attempts/${r.attemptId}`}>{r.scorePercent}%</Link>
            </span>
          ))}
        </div>
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
  const [changingLanguage, setChangingLanguage] = useState(false)
  const changeLanguage = useMutation({
    mutationFn: (language: LabLanguage) => put(`/api/me/enrolments/${a.entitlementId}/language`, { language }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
  })

  return (
    <div className="card stack">
      <div className="spread">
        <div>
          <h3 style={{ marginBottom: 4 }}>{a.exam.title}</h3>
          <div className="faint">
            {a.exam.questionCount} {a.exam.kind === 'LAB' ? 'hands-on tasks' : 'questions'} · {a.exam.durationMinutes} minutes · Pass mark {a.exam.passPercent}%
          </div>
          {a.labLanguage && (
            <div style={{ marginTop: 4 }}>
              {a.exam.kind === 'LAB' ? 'Tests in' : 'Exam language:'} <strong>{labLanguage(a.labLanguage).label}</strong>
              {canSchedule && !changingLanguage && (
                <>
                  {' · '}
                  <button className="link-button" onClick={() => setChangingLanguage(true)}>Change</button>
                </>
              )}
            </div>
          )}
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
            {a.state === 'GRADING' && <Link className="btn secondary small" to={`/attempts/${a.attemptId}`}>Grading…</Link>}
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
      {changingLanguage && canSchedule && a.labLanguage && (
        <div className="stack">
          <LanguagePicker
            name={`language-${a.entitlementId}`}
            value={a.labLanguage}
            onChange={(l) => changeLanguage.mutate(l)}
            disabled={changeLanguage.isPending}
            lab={a.exam.kind === 'LAB'}
          />
          {changeLanguage.isError && <Alert kind="error">{changeLanguage.error.message}</Alert>}
          <div className="row">
            <button className="btn secondary small" onClick={() => { changeLanguage.reset(); setChangingLanguage(false) }}>Done</button>
          </div>
        </div>
      )}
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
