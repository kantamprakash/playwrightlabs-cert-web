import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { api, bothPrices, price, rupees, type ExamSummary } from '../api'
import { useMe } from '../auth'

const SKILLS = [
  'User-facing locators: getByRole, getByLabel, getByText',
  'Web-first assertions that wait for the page',
  'Test structure, hooks and fixtures',
  'Signing in and testing flows end to end',
  'Catching real bugs, not just happy paths',
  'Tests in TypeScript or JavaScript, your choice',
]

export function Home() {
  const { data: me } = useMe()
  const { data: exams, isPending } = useQuery({ queryKey: ['exams'], queryFn: () => api<ExamSummary[]>('/api/exams') })
  const exam = exams?.find((e) => e.kind === 'LAB') ?? exams?.find((e) => e.kind === 'CERTIFICATION')
  const title = exam?.title ?? 'Playwright Certified Professional'
  const cta = me ? '/dashboard' : '/register'

  const steps = [
    {
      title: '1. Register and enrol',
      text: `Create an account and verify your email. Pay ${exam ? bothPrices(exam.priceInr, exam.priceUsd) : 'the exam fee'} online (UPI, card or net banking in India; international cards elsewhere), and choose TypeScript or JavaScript.`,
    },
    {
      title: '2. Book and take the lab',
      text: 'Choose a date and time that suits you. In your browser, write Playwright tests for a small online shop and run them as often as you need.',
    },
    {
      title: '3. Get certified',
      text: 'Your tests are run against the real shop and hidden broken versions of it. Pass and download a certificate with a QR code that employers can verify.',
    },
  ]

  const faqs = [
    {
      q: 'Do I need to take a Playwright course first?',
      a: 'No. The exam is open to anyone who can write Playwright tests. If you are a Playwright Labs student, ask your trainer for your discount code.',
    },
    {
      q: 'TypeScript or JavaScript?',
      a: 'Your choice. Pick one when you enrol and change it from your dashboard until you start. Both are graded the same way.',
    },
    {
      q: 'How is the lab graded?',
      a: 'For each task your tests must pass on the working shop. Then they run against hidden broken versions: 70 points for the bugs they catch, and up to 30 for good practice (no fixed waits, user-facing locators, web-first assertions).',
    },
    {
      q: 'What happens if I don’t pass?',
      a: exam
        ? `You see a score and feedback for every task so you know what to work on. You can book a retake ${exam.retakeCooldownDays} days later, for ${bothPrices(exam.retakePriceInr, exam.retakePriceUsd)}.`
        : 'You see a score and feedback for every task, and you can book a retake after a short wait.',
    },
    {
      q: 'Can I reschedule?',
      a: 'Yes. Change your exam time from your dashboard any time before you start the exam.',
    },
    {
      q: 'What do I need on the day?',
      a: 'A laptop or desktop with a recent Chrome, Edge or Firefox and a stable internet connection. You write and run your tests in the browser; nothing to install. Keep the practice shop open in another tab while you work.',
    },
    {
      q: 'How do employers check my certificate?',
      a: 'Every certificate has a unique credential ID and QR code. Anyone can confirm it on the Verify page of this site.',
    },
    {
      q: 'Can I pay from outside India?',
      a: exam?.priceUsd != null
        ? `Yes. Candidates outside India pay ${price(exam.priceUsd, 'USD')} by international card, with no Indian GST.`
        : 'Payment is in Indian rupees for now. Contact us if you are outside India.',
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
            Become a <span className="highlight">{title}</span> and prove you can write Playwright tests that catch real bugs.
          </h1>
          <p className="lead">
            {exam?.description ??
              'A hands-on lab: write real Playwright tests in your browser, graded on the bugs they catch, with a certificate that employers can verify instantly.'}
          </p>
          <div className="row">
            <Link className="btn lg" to={cta}>
              {exam ? `Enrol for ${bothPrices(exam.priceInr, exam.priceUsd)}` : me ? 'Go to your dashboard' : 'Register'}
            </Link>
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
            <Fact value={rupees(exam.priceInr)} label={exam.priceUsd == null ? 'incl. GST' : `incl. GST · ${price(exam.priceUsd, 'USD')} outside India`} />
            <Fact value={`${exam.questionCount}`} label="hands-on tasks" />
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
            <h2>What the lab tests</h2>
            <ul className="clean">
              {SKILLS.map((t) => <li key={t}>{t}</li>)}
            </ul>
          </div>
          <div className="feature">
            <h2>Exam format</h2>
            <pre><code>{`Tasks       ${exam?.questionCount ?? 3}, one Playwright test file each
Time        ${exam?.durationMinutes ?? 120} minutes, auto-submitted
Language    TypeScript or JavaScript
Pass mark   ${exam?.passPercent ?? 70}%
Result      task scores and feedback after grading
Retake      after ${exam?.retakeCooldownDays ?? 7} days${exam ? `, ${bothPrices(exam.retakePriceInr, exam.retakePriceUsd)}` : ''}`}</code></pre>
            <p>Each task asks you to test part of the Labs Shop: signing in, the cart, coupons and checkout. Run your tests against the shop as you go; your saved code is graded when you submit.</p>
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
