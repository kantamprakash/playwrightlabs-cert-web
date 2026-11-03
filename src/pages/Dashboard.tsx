import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { api, formatDate, type Dashboard as DashboardData, type ExamAccess } from '../api'
import { useMe } from '../auth'
import { Alert } from '../components/Field'
import { MAIN_SITE } from '../components/Layout'

export function useDashboard() {
  return useQuery({ queryKey: ['dashboard'], queryFn: () => api<DashboardData>('/api/me/dashboard') })
}

export function Dashboard() {
  const { data: me } = useMe()
  const { data, isPending, error } = useDashboard()

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
          <section className="stack">
            <h2>Your exams</h2>
            {data.exams.length === 0 ? (
              <div className="card">
                <h3>You are not enrolled in an exam yet</h3>
                <p className="muted">
                  Online payment is coming soon. Until then, <a href={`${MAIN_SITE}/contact.html`}>contact Playwright Labs</a> to
                  enrol using the email address <strong>{me?.email}</strong>. Your exam will appear here as soon as access is granted.
                </p>
              </div>
            ) : (
              data.exams.map((e) => <ExamCard key={e.entitlementId} access={e} />)
            )}
          </section>

          {data.certificates.length > 0 && (
            <section className="stack">
              <h2>Your certificates</h2>
              {data.certificates.map((c) => (
                <div className="card spread" key={c.certNo}>
                  <div>
                    <h3 style={{ marginBottom: 4 }}>{c.examTitle}</h3>
                    <div className="faint">
                      {c.certNo} · Issued {formatDate(c.issuedAt)} · Score {c.scorePercent}%
                    </div>
                  </div>
                  {c.revoked ? (
                    <span className="badge red">Revoked</span>
                  ) : (
                    <div className="row">
                      <a className="btn" href={`/api/me/certificates/${c.certNo}/pdf`}>Download PDF</a>
                      <Link className="btn secondary" to={`/verify/${c.certNo}`}>Public link</Link>
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

function ExamCard({ access: a }: { access: ExamAccess }) {
  return (
    <div className="card spread">
      <div>
        <h3 style={{ marginBottom: 4 }}>{a.exam.title}</h3>
        <div className="faint">
          {a.exam.questionCount} questions · {a.exam.durationMinutes} minutes · Pass mark {a.exam.passPercent}%
        </div>
        {a.state === 'AVAILABLE' && <div className="faint">Take it before {formatDate(a.expiresAt)}</div>}
      </div>
      <div className="row">
        {a.state === 'AVAILABLE' && <Link className="btn" to={`/start/${a.entitlementId}`}>Start exam</Link>}
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
    </div>
  )
}
