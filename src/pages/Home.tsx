import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { api, type ExamSummary } from '../api'
import { useMe } from '../auth'

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

const STEPS = [
  { title: 'Enrol and book a slot', text: 'Create an account, verify your email and enrol from your dashboard. Pick the date and time that suits you. Enrolment is free for now.' },
  { title: 'Take the exam online', text: 'A timed, multiple-choice exam on real Playwright Test skills. Answers save as you go. You get one attempt, so choose a quiet time.' },
  { title: 'Get certified', text: 'Pass and download your certificate straight away. Each one has a QR code and a public page where employers can verify it.' },
]

export function Home() {
  const { data: me } = useMe()
  const { data: exams, isPending } = useQuery({ queryKey: ['exams'], queryFn: () => api<ExamSummary[]>('/api/exams') })
  const exam = exams?.[0]
  const title = exam?.title ?? 'Playwright Certified Tester'

  return (
    <>
      <section className="hero-band">
        <div className="container">
          <div className="eyebrow">Playwright Labs Certification</div>
          <h1>
            Become a <span className="highlight">{title}</span> and prove you can build reliable end-to-end tests.
          </h1>
          <p className="lead">
            {exam?.description ??
              'An online exam on hands-on Playwright skills, with a certificate that employers can verify instantly.'}
          </p>
          <div className="row">
            {me ? (
              <Link className="btn lg" to="/dashboard">{exam ? 'Enrol from your dashboard' : 'Go to your dashboard'}</Link>
            ) : (
              <>
                <Link className="btn lg" to="/register">Register to enrol</Link>
                <Link className="btn secondary lg" to="/login">Sign in</Link>
              </>
            )}
            <Link className="btn secondary lg" to="/verify">Verify a certificate</Link>
          </div>
        </div>
      </section>

      <main className="container page" style={{ display: "flex", flexDirection: "column", gap: 48 }}>
        <div className="features">
          {STEPS.map((s) => (
            <div className="feature" key={s.title}>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </div>
          ))}
        </div>

        {isPending ? null : exam ? (
          <div className="facts" style={{ margin: 0 }}>
            <Fact value={`${exam.questionCount}`} label="questions" />
            <Fact value={`${exam.durationMinutes} min`} label="time limit" />
            <Fact value={`${exam.passPercent}%`} label="to pass" />
            <Fact value="1" label="attempt per enrolment" />
          </div>
        ) : (
          <div className="alert warn" style={{ margin: 0 }}>
            The exam opens soon. Register now and we will let you know when enrolment starts.
          </div>
        )}

        <div className="features">
          <div className="feature">
            <h2>What the exam covers</h2>
            <ul className="clean">
              {TOPICS.map((t) => <li key={t}>{t}</li>)}
            </ul>
          </div>
          <div className="feature">
            <h2>Exam format</h2>
            <pre><code>{`Questions   ${exam?.questionCount ?? 40}, single and multiple choice
Time        ${exam?.durationMinutes ?? 60} minutes, auto-submitted
Pass mark   ${exam?.passPercent ?? 70}%
Attempts    1 per enrolment
Result      instant, with a topic breakdown`}</code></pre>
            <p>Questions with more than one answer say "Select all that apply". You need every correct option, and nothing else, to get the mark.</p>
          </div>
        </div>
      </main>
    </>
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
