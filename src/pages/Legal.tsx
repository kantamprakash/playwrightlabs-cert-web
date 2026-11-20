import type { ReactNode } from 'react'
import { Link } from 'react-router'

// Razorpay checks that these pages exist before activating live payments.
// DRAFTS: review them (ideally with your CA or lawyer) and replace every [bracketed] value before going live.
const BUSINESS = 'Playwright Labs'
const EMAIL = 'certify@playwrightlabs.com'
const ADDRESS = '[Registered business address]'
const PHONE = '[Support phone number]'
const UPDATED = '17 November 2026'

function Page({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="container page prose">
      <h1>{title}</h1>
      <p className="faint">Last updated {UPDATED}</p>
      {children}
    </main>
  )
}

export function Terms() {
  return (
    <Page title="Terms and conditions">
      <p>
        These terms apply to the online certification exams offered by {BUSINESS} on this website. By registering or
        paying for an exam you agree to them.
      </p>
      <h2>Enrolment and access</h2>
      <p>
        Each payment buys one attempt at the exam named at checkout. After paying you choose a date and time for the
        exam from your dashboard. Access is valid for 180 days from payment; book and take the exam within that time.
      </p>
      <h2>Taking the exam</h2>
      <ul>
        <li>You must take the exam yourself, without help from anyone else.</li>
        <li>The exam is timed and submitted automatically when time runs out.</li>
        <li>The exam runs in full screen. Leaving the exam window is recorded and may be reviewed.</li>
        <li>
          Certification exams are proctored: your entire screen and your camera (with microphone) are recorded for the
          whole exam, pasting text copied from outside the exam is blocked, and leaving the exam tab or full screen is
          recorded. Take the exam alone, on one display, without phones, notes or other devices.
        </li>
        <li>Do not copy, share or publish exam questions.</li>
      </ul>
      <h2>Results and certificates</h2>
      <p>
        Results are shown when you submit. A certificate is issued when you reach the pass mark and, for a proctored
        exam, once an examiner has reviewed your session recording, usually within two working days. If the examiner
        finds the exam rules were broken, no certificate is issued and the attempt counts as not passed. {BUSINESS} may
        revoke a certificate if it finds the exam rules were broken; a revoked certificate shows as revoked on the
        public verification page.
      </p>
      <h2>Retakes</h2>
      <p>
        If you don't pass, you can buy a retake after the waiting period shown on your dashboard, at the retake price.
      </p>
      <h2>Pricing</h2>
      <p>
        Candidates in India pay in Indian rupees, including GST. Candidates outside India pay in US dollars, without
        Indian GST. Payments are processed by Razorpay; {BUSINESS} does not see or
        store your card or bank details.
      </p>
      <h2>Liability</h2>
      <p>
        If the exam can't be taken because of a fault on our side, we will let you rebook or refund you as described
        in the <Link to="/refund-policy">refund policy</Link>. We are not responsible for problems with your own
        device or internet connection.
      </p>
      <h2>Contact</h2>
      <p>Questions about these terms: <a href={`mailto:${EMAIL}`}>{EMAIL}</a>.</p>
    </Page>
  )
}

export function RefundPolicy() {
  return (
    <Page title="Refund and cancellation policy">
      <ul>
        <li>
          <strong>Before you start the exam:</strong> you can cancel within 7 days of payment for a full refund, as
          long as you have not started the exam. Email <a href={`mailto:${EMAIL}`}>{EMAIL}</a> with your invoice
          number.
        </li>
        <li>
          <strong>Rescheduling</strong> is free and unlimited from your dashboard until you start the exam, within
          the 180-day access period.
        </li>
        <li>
          <strong>Missed slot:</strong> if you miss your booked time, choose a new time from your dashboard. A missed
          slot is not refunded.
        </li>
        <li>
          <strong>After you start the exam</strong> the fee is not refundable, whatever the result.
        </li>
        <li>
          <strong>Technical problems on our side:</strong> if the exam failed because of our service, we will give you
          a new attempt or a full refund, whichever you prefer.
        </li>
      </ul>
      <p>
        Approved refunds are paid back to the original payment method through Razorpay within 5–7 working days.
      </p>
      <h2>Shipping</h2>
      <p>
        Everything we sell is delivered online: exam access appears on your dashboard as soon as payment is confirmed,
        and certificates are downloaded as PDFs. Nothing is shipped.
      </p>
    </Page>
  )
}

export function Privacy() {
  return (
    <Page title="Privacy policy">
      <p>This explains what {BUSINESS} collects through this certification site and why.</p>
      <h2>What we collect</h2>
      <ul>
        <li>Your name and email address, to run your account and print your certificate.</li>
        <li>Your exam bookings, answers, scores and the number of times you left the exam window.</li>
        <li>
          For proctored exams: a recording of your screen and of your camera and microphone during the exam, and a log
          of what the exam page noticed (leaving the tab or full screen, blocked pastes, extra displays). We record only
          while the exam is open, and only after you agree to it on the start page.
        </li>
        <li>Payment records: amount, date and Razorpay's payment reference. Card and bank details stay with Razorpay.</li>
        <li>Technical logs (such as IP address and browser) kept for security and troubleshooting.</li>
      </ul>
      <h2>How we use it</h2>
      <p>
        To run exams, issue and verify certificates, send emails about your exams and payments, issue invoices, and
        prevent cheating and fraud. Session recordings are watched only by our examiners, to check the exam rules were
        followed. We don't sell your data or use it for advertising.
      </p>
      <h2>What is public</h2>
      <p>
        Anyone with a credential ID can see the certificate holder's name, exam, issue date and whether it is valid.
        Nothing else about you is public.
      </p>
      <h2>How long we keep it</h2>
      <p>
        Certificates and the records behind them are kept so they can be verified. Session recordings are deleted 90
        days after the examiner's review. Invoices and payment records are
        kept for as long as tax law requires.
      </p>
      <h2>Your choices</h2>
      <p>
        Email <a href={`mailto:${EMAIL}`}>{EMAIL}</a> to see, correct or delete your personal data, or to take a
        certificate off public verification. Records that tax law requires us to keep, such as invoices, are kept for
        the required period.
      </p>
    </Page>
  )
}

export function Contact() {
  return (
    <Page title="Contact us">
      <p>For questions about exams, payments, invoices or certificates:</p>
      <ul>
        <li>Email: <a href={`mailto:${EMAIL}`}>{EMAIL}</a></li>
        <li>Phone: {PHONE}</li>
        <li>Address: {ADDRESS}</li>
      </ul>
      <p>We reply within two working days. For a payment question, include your invoice number or Razorpay payment reference.</p>
    </Page>
  )
}
