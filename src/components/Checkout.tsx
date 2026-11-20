import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { post, rupees, type CheckoutResult, type LabLanguage, type Offer, type Quote } from '../api'
import { Alert } from './Field'
import { LanguagePicker } from './LanguagePicker'

type RazorpaySuccess = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }

type RazorpayOptions = {
  key: string
  amount: number
  currency: string
  order_id: string
  name: string
  description: string
  prefill: { name: string; email: string }
  theme: { color: string }
  handler: (r: RazorpaySuccess) => void
  modal: { ondismiss: () => void }
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void }
  }
}

/** Razorpay's checkout script, loaded only when someone is about to pay. */
function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('The payment window could not be loaded. Check your connection and try again.'))
    document.body.appendChild(script)
  })
}

/**
 * Price, coupon and payment for one certification. On success the dashboard refreshes and the new enrolment
 * appears under "Your exams", ready to book a time.
 */
export function Checkout({ offer, onDone, onCancel }: { offer: Offer; onDone: () => void; onCancel: () => void }) {
  const queryClient = useQueryClient()
  const slug = offer.exam.slug
  const isLab = offer.exam.kind === 'LAB'
  const hasLanguage = offer.exam.kind !== 'PRACTICE'
  const [language, setLanguage] = useState<LabLanguage>('TYPESCRIPT')
  const [code, setCode] = useState('')
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)
  // Test mode: the order waiting for the simulated payment step.
  const [mockOrder, setMockOrder] = useState<{ id: string; amountPaise: number } | null>(null)

  // The last valid price; a rejected coupon shows an error but keeps it.
  const [q, setQ] = useState<Quote>()
  const quote = useMutation({
    mutationFn: (couponCode: string) => post<Quote>(`/api/exams/${slug}/quote`, { couponCode }),
    onSuccess: setQ,
  })
  const { mutate: getQuote } = quote
  useEffect(() => getQuote(''), [getQuote])

  const finished = () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    queryClient.invalidateQueries({ queryKey: ['orders'] })
    onDone()
  }

  const checkout = useMutation({
    mutationFn: () => post<CheckoutResult>(`/api/exams/${slug}/checkout`, {
        couponCode: q?.couponCode ?? '',
        ...(hasLanguage ? { language } : {}),
      }),
    onSuccess: async (res) => {
      if (res.status === 'ENROLLED' || !res.payment) return finished()
      const p = res.payment
      setPayError(null)
      if (p.mock) {
        setMockOrder({ id: p.razorpayOrderId, amountPaise: p.amountPaise })
        return
      }
      try {
        await loadRazorpay()
      } catch (e) {
        setPayError((e as Error).message)
        return
      }
      setPaying(true)
      new window.Razorpay!({
        key: p.keyId,
        amount: p.amountPaise,
        currency: p.currency,
        order_id: p.razorpayOrderId,
        name: 'Playwright Labs',
        description: p.description,
        prefill: { name: p.buyerName, email: p.buyerEmail },
        theme: { color: '#1a7e1f' },
        handler: async (r) => {
          try {
            await post('/api/payments/confirm', {
              razorpayOrderId: r.razorpay_order_id,
              razorpayPaymentId: r.razorpay_payment_id,
              razorpaySignature: r.razorpay_signature,
            })
            finished()
          } catch (e) {
            setPayError(
              `${(e as Error).message} Your payment reference is ${r.razorpay_payment_id}. If access doesn't appear on your dashboard within a few minutes, contact us with that reference.`,
            )
          } finally {
            setPaying(false)
          }
        },
        modal: { ondismiss: () => setPaying(false) },
      }).open()
    },
  })

  const mockPay = useMutation({
    mutationFn: (orderId: string) => post('/api/payments/mock-pay', { razorpayOrderId: orderId }),
    onSuccess: finished,
  })

  const busy = checkout.isPending || paying || mockPay.isPending

  if (mockOrder) {
    return (
      <div className="stack">
        <Alert kind="warn">
          <strong>Test payment.</strong> Online payment is simulated for now: no money is taken and nothing is
          charged to you.
        </Alert>
        <div className="price-lines">
          <span className="total">Amount</span>
          <span className="total">{rupees(mockOrder.amountPaise / 100)}</span>
        </div>
        {mockPay.isError && <Alert kind="error">{mockPay.error.message}</Alert>}
        {payError && <Alert kind="error">{payError}</Alert>}
        <div className="row">
          <button className="btn" disabled={busy} onClick={() => mockPay.mutate(mockOrder.id)}>
            {mockPay.isPending ? 'Processing…' : 'Simulate successful payment'}
          </button>
          <button
            className="btn secondary"
            disabled={busy}
            onClick={() => setPayError('Payment failed (simulated). You were not charged; you can try again.')}
          >
            Simulate failed payment
          </button>
          <button className="btn secondary" disabled={busy} onClick={onCancel}>Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <div className="stack">
      {hasLanguage && (
        <LanguagePicker name={`language-${slug}`} value={language} onChange={setLanguage} disabled={busy} lab={isLab} />
      )}

      {q && (
        <div className="price-lines">
          <span>{q.retake ? 'Retake' : 'Certification exam'}</span>
          <span>{rupees(q.listPriceInr)}</span>
          {q.discountInr > 0 && (
            <>
              <span>Coupon {q.couponCode}</span>
              <span>−{rupees(q.discountInr)}</span>
            </>
          )}
          <span className="total">Total (incl. GST)</span>
          <span className="total">{rupees(q.totalInr)}</span>
        </div>
      )}

      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault()
          quote.mutate(code)
        }}
      >
        <label htmlFor={`coupon-${slug}`} className="faint" style={{ margin: 0 }}>Coupon code</label>
        <input
          id={`coupon-${slug}`}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Optional"
          style={{ maxWidth: 180 }}
          autoComplete="off"
        />
        <button className="btn secondary small" type="submit" disabled={!code.trim() || quote.isPending}>Apply</button>
      </form>

      {quote.isError && <Alert kind="error">{quote.error.message}</Alert>}
      {checkout.isError && <Alert kind="error">{checkout.error.message}</Alert>}
      {payError && <Alert kind="error">{payError}</Alert>}
      {q && q.totalInr > 0 && !q.onlinePaymentAvailable && (
        <Alert kind="warn">Online payment opens soon. Contact Playwright Labs to enrol in the meantime.</Alert>
      )}

      <div className="row">
        <button
          className="btn"
          disabled={!q || busy || (q.totalInr > 0 && !q.onlinePaymentAvailable)}
          onClick={() => checkout.mutate()}
        >
          {busy ? 'Processing…' : q && q.totalInr === 0 ? 'Enrol for free' : `Pay ${q ? rupees(q.totalInr) : ''}`}
        </button>
        <button className="btn secondary" disabled={busy} onClick={onCancel}>Cancel</button>
      </div>
      <p className="faint" style={{ margin: 0 }}>
        Payments are handled securely by Razorpay (UPI, cards, net banking). After paying, choose your exam time from
        this dashboard. See our <a href="/refund-policy" target="_blank">refund policy</a>.
      </p>
    </div>
  )
}
