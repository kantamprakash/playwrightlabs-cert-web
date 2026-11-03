import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { api, type ExamSummary } from '../api'
import { useMe } from '../auth'
import { MAIN_SITE } from '../components/Layout'

const TOPICS = [
  'Locators and auto-waiting',
  'Web-first assertions',
  'Fixtures and test structure',
  'Configuration and projects',
  'Network mocking and API testing',
  'Authentication and storage state',
  'Debugging: Trace Viewer, UI mode, Inspector',
  'Parallelism, retries and CI',
]

export function Home() {
  const { data: me } = useMe()
  const { data: exams, isPending } = useQuery({ queryKey: ['exams'], queryFn: () => api<ExamSummary[]>('/api/exams') })
  const exam = exams?.[0]

  return (
    <main className="container page">
      <section className="hero">
        <div className="eyebrow">Playwright Labs Certification</div>
        <h1>{exam?.title ?? 'Playwright Certified Tester'}</h1>
        <p className="muted" style={{ maxWidth: 720, fontSize: '1.1rem' }}>
          {exam?.description ??
            'Prove your hands-on Playwright skills with an online exam and earn a certificate that employers can verify instantly.'}
        </p>
        <div className="row">
          {me ? (
            <Link className="btn" to="/dashboard">Go to your dashboard</Link>
          ) : (
            <>
              <Link className="btn" to="/register">Create your account</Link>
              <Link className="btn secondary" to="/login">Sign in</Link>
            </>
          )}
        </div>
      </section>

      {isPending ? null : exam ? (
        <div className="facts">
          <Fact value={`${exam.questionCount}`} label="questions" />
          <Fact value={`${exam.durationMinutes} min`} label="time limit" />
          <Fact value={`${exam.passPercent}%`} label="to pass" />
          <Fact value="1" label="attempt per enrolment" />
        </div>
      ) : (
        <div className="alert warn" style={{ marginTop: 24 }}>
          The exam opens soon. Register now and we will let you know when enrolment starts.
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        <section className="card">
          <h2>What the exam covers</h2>
          <ul className="clean muted">
            {TOPICS.map((t) => <li key={t}>{t}</li>)}
          </ul>
        </section>
        <section className="card">
          <h2>How it works</h2>
          <ol className="muted" style={{ paddingLeft: 20, margin: 0 }}>
            <li>Create an account and verify your email.</li>
            <li>Enrol in the exam. <a href={`${MAIN_SITE}/contact.html`}>Contact us</a> to enrol while online payments are being set up.</li>
            <li>Take the timed, multiple-choice exam online. You have one attempt, so pick a quiet time.</li>
            <li>Pass and download your certificate instantly. Each one has a QR code and a public verification link.</li>
          </ol>
        </section>
      </div>
    </main>
  )
}

function Fact({ value, label }: { value: string; label: string }) {
  return (
    <div className="card">
      <div className="stat">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}
