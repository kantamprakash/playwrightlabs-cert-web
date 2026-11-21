import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { api, bothPrices, price, rupees, type ExamSummary } from '../api'
import { useMe } from '../auth'

const SKILLS = [
  'Locators and auto-waiting',
  'Web-first assertions',
  'Actions, navigation, frames and page events',
  'Test structure, hooks and fixtures',
  'Configuration, projects, retries, timeouts and parallel runs',
  'Network mocking and API testing',
  'Authentication and browser contexts',
  'Debugging, traces, screenshots and the CLI',
]

export function Home() {
  const { data: me } = useMe()
  const { data: exams, isPending } = useQuery({ queryKey: ['exams'], queryFn: () => api<ExamSummary[]>('/api/exams') })
  const exam = exams?.find((e) => e.kind === 'CERTIFICATION') ?? exams?.find((e) => e.kind === 'LAB')
  const title = exam?.title ?? 'Playwright Certified Professional'
  const cta = me ? '/dashboard' : '/register'

  const steps = [
    {
      title: '1. Register and enrol',
      text: `Create an account and verify your email. Pay ${exam ? bothPrices(exam.priceInr, exam.priceUsd) : 'the exam fee'} online (UPI, card or net banking in India; international cards elsewhere), and choose TypeScript or JavaScript.`,
    },
    {
      title: '2. Book and take the exam',
      text: `Choose a date and time that suits you. Answer ${exam?.questionCount ?? 40} multiple-choice questions in ${exam?.durationMinutes ?? 90} minutes, online, with your camera on.`,
    },
    {
      title: '3. Get certified',
      text: 'See your score by topic as soon as you submit. Once an examiner has reviewed your session, download a certificate with a QR code that employers can verify.',
    },
  ]

  const faqs = [
    {
      q: 'Do I need to take a Playwright course first?',
      a: 'No. The exam is open to anyone who knows Playwright Test. If you are a Playwright Labs student, ask your trainer for your discount code.',
    },
    {
      q: 'TypeScript or JavaScript?',
      a: 'Your choice. Pick one when you enrol and change it from your dashboard until you start. The few questions that only apply to TypeScript are left out if you choose JavaScript.',
    },
    {
      q: 'How is the exam scored?',
      a: `Every question is worth one mark, and there is no negative marking. Questions that say “Select all that apply” have more than one correct answer: pick all of them, and nothing else, to get the mark. You need ${exam?.passPercent ?? 70}% to pass.`,
    },
    {
      q: 'What happens if I don’t pass?',
      a: exam
        ? `You see your score for every topic, so you know what to work on. You can book a retake ${exam.retakeCooldownDays} days later, for ${bothPrices(exam.retakePriceInr, exam.retakePriceUsd)}, and you get questions you haven’t seen before.`
        : 'You see your score for every topic, and you can book a retake after a short wait.',
    },
    {
      q: 'Can I reschedule?',
      a: 'Yes. Change your exam time from your dashboard any time before you start the exam.',
    },
    {
      q: 'What do I need on the day?',
      a: 'A laptop or desktop with one display, a webcam and microphone, a recent Chrome, Edge or Firefox and a stable internet connection, in a quiet room. Nothing to install.',
    },
    {
      q: 'Is the exam proctored?',
      a: 'Yes. With your agreement, your screen and camera are recorded while the exam is open, and the exam runs in full screen. Switching tabs, pasting text from outside the exam and extra displays are recorded or blocked. An examiner reviews the recording before your certificate is issued, usually within two working days. Recordings are deleted 90 days after the review.',
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
            Become a <span className="highlight">{title}</span> and prove you know Playwright Test inside out.
          </h1>
          <p className="lead">
            {exam?.description ??
              'A proctored online exam on Playwright Test, with a certificate that employers can verify instantly.'}
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
            <Fact value={`${exam.questionCount}`} label={exam.kind === 'LAB' ? 'hands-on tasks' : 'questions'} />
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
              {SKILLS.map((t) => <li key={t}>{t}</li>)}
            </ul>
          </div>
          <div className="feature">
            <h2>Exam format</h2>
            <pre><code>{`Questions   ${exam?.questionCount ?? 40}, multiple choice, drawn at random
Time        ${exam?.durationMinutes ?? 90} minutes, auto-submitted
Language    TypeScript or JavaScript
Pass mark   ${exam?.passPercent ?? 70}%
Proctored   screen and camera recorded
Result      score by topic when you submit
Retake      after ${exam?.retakeCooldownDays ?? 7} days${exam ? `, ${bothPrices(exam.retakePriceInr, exam.retakePriceUsd)}` : ''}`}</code></pre>
            <p>Every candidate gets a different mix of easy, medium and hard questions across all the topics. About half ask you to choose the right Playwright code; the rest are about how Playwright behaves.</p>
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
