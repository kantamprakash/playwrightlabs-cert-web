import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { api, rupees, type ExamSummary } from '../api'
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

export function Home() {
  const { data: me } = useMe()
  const { data: exams, isPending } = useQuery({ queryKey: ['exams'], queryFn: () => api<ExamSummary[]>('/api/exams') })
  const exam = exams?.find((e) => e.kind === 'CERTIFICATION')
  const practice = exams?.find((e) => e.kind === 'PRACTICE')
  const title = exam?.title ?? 'Playwright Certified Tester'
  const cta = me ? '/dashboard' : '/register'

  const steps = [
    {
      title: '1. Register and enrol',
      text: `Create an account and verify your email. Pay ${exam ? rupees(exam.priceInr) : 'the exam fee'} online by UPI, card or net banking${practice ? ', or start with the free practice test' : ''}.`,
    },
    {
      title: '2. Book and take the exam',
      text: 'Choose a date and time that suits you. The exam runs online in your browser; answers save as you go.',
    },
    {
      title: '3. Get certified',
      text: 'See your result and topic breakdown straight away. Pass and download a certificate with a QR code that employers can verify.',
    },
  ]

  const faqs = [
    {
      q: 'Do I need to take a Playwright course first?',
      a: 'No. The exam is open to anyone. If you are a Playwright Labs student, ask your trainer for your discount code.',
    },
    {
      q: 'What happens if I don’t pass?',
      a: exam
        ? `You see a score for every topic so you know what to work on. You can book a retake ${exam.retakeCooldownDays} days later, for ${rupees(exam.retakePriceInr)}.`
        : 'You see a score for every topic so you know what to work on, and you can book a retake after a short wait.',
    },
    {
      q: 'Can I reschedule?',
      a: 'Yes. Change your exam time from your dashboard any time before you start the exam.',
    },
    {
      q: 'What do I need on the day?',
      a: 'A laptop or desktop with a recent Chrome, Edge or Firefox, a stable internet connection and a quiet room. The exam runs in full screen and leaving the exam window is recorded.',
    },
    {
      q: 'How do employers check my certificate?',
      a: 'Every certificate has a unique credential ID and QR code. Anyone can confirm it on the Verify page of this site.',
    },
    {
      q: 'Do I get an invoice?',
      a: 'Yes. Your invoice is emailed to you and can be downloaded from your dashboard at any time.',
    },
  ]

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
            <Link className="btn lg" to={cta}>
              {exam ? `Enrol for ${rupees(exam.priceInr)}` : me ? 'Go to your dashboard' : 'Register'}
            </Link>
            {practice && (
              <Link className="btn secondary lg" to={cta}>Try the free practice test</Link>
            )}
            {!me && <Link className="btn secondary lg" to="/login">Sign in</Link>}
          </div>
        </div>
      </section>

      <main className="container page" style={{ display: 'flex', flexDirection: 'column', gap: 48 }}>
        <div className="features">
          {steps.map((s) => (
            <div className="feature" key={s.title}>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </div>
          ))}
        </div>

        {isPending ? null : exam ? (
          <div className="facts" style={{ margin: 0 }}>
            <Fact value={rupees(exam.priceInr)} label="incl. GST" />
            <Fact value={`${exam.questionCount}`} label="questions" />
            <Fact value={`${exam.durationMinutes} min`} label="time limit" />
            <Fact value={`${exam.passPercent}%`} label="to pass" />
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
Result      instant, with a topic breakdown
Retake      after ${exam?.retakeCooldownDays ?? 7} days${exam ? `, ${rupees(exam.retakePriceInr)}` : ''}`}</code></pre>
            <p>Questions with more than one answer say "Select all that apply". You need every correct option, and nothing else, to get the mark.</p>
          </div>
        </div>

        <div className="faq">
          <h2>Questions</h2>
          {faqs.map((f) => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>

        <div className="card spread">
          <div>
            <h2 style={{ marginBottom: 4 }}>Hiring? Check a certificate</h2>
            <p className="muted" style={{ margin: 0 }}>Enter the credential ID or scan the QR code on the certificate.</p>
          </div>
          <Link className="btn secondary" to="/verify">Verify a certificate</Link>
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
