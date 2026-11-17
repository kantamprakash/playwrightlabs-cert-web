import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { api, ApiError, formatDate, rupees } from '../../api'
import { Alert, Field } from '../../components/Field'
import { useAdminExams } from './AdminLayout'

type Coupon = {
  id: number
  code: string
  discountPercent: number
  examId: number | null
  examTitle: string | null
  maxUses: number | null
  usedCount: number
  validUntil: string | null
  active: boolean
  note: string | null
  createdAt: string
}

type OrderRow = {
  id: number
  buyerName: string
  buyerEmail: string
  examTitle: string
  retake: boolean
  listPricePaise: number
  discountPaise: number
  amountPaise: number
  couponCode: string | null
  status: 'CREATED' | 'PAID'
  razorpayPaymentId: string | null
  invoiceNo: string | null
  createdAt: string
  paidAt: string | null
}

type CouponForm = {
  code: string
  discountPercent: number
  examId: number | null
  maxUses: number | null
  validUntil: string
  active: boolean
  note: string
}

const EMPTY: CouponForm = { code: '', discountPercent: 20, examId: null, maxUses: null, validUntil: '', active: true, note: '' }

export function AdminSales() {
  const { data: orders, isPending } = useQuery({ queryKey: ['admin', 'orders'], queryFn: () => api<OrderRow[]>('/api/admin/orders') })
  // Simulated (mock) payments don't count as revenue.
  const paid = (orders ?? []).filter((o) => o.status === 'PAID' && !o.razorpayPaymentId?.startsWith('pay_mock_'))
  const revenue = paid.reduce((sum, o) => sum + o.amountPaise, 0)

  return (
    <div className="stack">
      <Coupons />

      <section className="stack">
        <div className="spread">
          <h2 style={{ margin: 0 }}>Orders</h2>
          <span className="faint">
            {paid.length} paid · {rupees(revenue / 100)} received (last 500 orders)
          </span>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          "Not paid" orders are checkouts where the payment window was opened but no payment arrived. Refunds are made
          from the Razorpay dashboard.
        </p>
        {isPending ? (
          <p className="muted">Loading…</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Date</th><th>Candidate</th><th>Exam</th><th>Amount</th><th>Coupon</th><th>Status</th><th>Invoice</th><th>Razorpay payment</th></tr>
              </thead>
              <tbody>
                {orders?.map((o) => (
                  <tr key={o.id}>
                    <td>{formatDate(o.paidAt ?? o.createdAt, true)}</td>
                    <td>{o.buyerName}<div className="faint">{o.buyerEmail}</div></td>
                    <td>{o.examTitle}{o.retake && ' (retake)'}</td>
                    <td>
                      {rupees(o.amountPaise / 100)}
                      {o.discountPaise > 0 && <div className="faint">list {rupees(o.listPricePaise / 100)}</div>}
                    </td>
                    <td>{o.couponCode ?? '—'}</td>
                    <td>
                      <span className={`badge ${o.status === 'PAID' ? 'green' : ''}`}>
                        {o.status === 'PAID'
                          ? o.razorpayPaymentId?.startsWith('pay_mock_') ? 'Test' : o.amountPaise ? 'Paid' : 'Free'
                          : 'Not paid'}
                      </span>
                    </td>
                    <td>{o.invoiceNo ?? '—'}</td>
                    <td><code>{o.razorpayPaymentId ?? '—'}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function Coupons() {
  const { data: coupons } = useQuery({ queryKey: ['admin', 'coupons'], queryFn: () => api<Coupon[]>('/api/admin/coupons') })
  const [editing, setEditing] = useState<Coupon | 'new' | null>(null)

  return (
    <section className="stack">
      <div className="spread">
        <h2 style={{ margin: 0 }}>Coupons</h2>
        {!editing && <button className="btn secondary small" onClick={() => setEditing('new')}>New coupon</button>}
      </div>
      <p className="muted" style={{ margin: 0 }}>
        Give course students a code for a discount, or a 100% code for free access. Codes are not case-sensitive.
      </p>
      {editing && <CouponEditor coupon={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />}
      {coupons && coupons.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Code</th><th>Discount</th><th>Exam</th><th>Used</th><th>Valid until</th><th>Note</th><th></th></tr>
            </thead>
            <tbody>
              {coupons.map((c) => (
                <tr key={c.id}>
                  <td>
                    <code>{c.code}</code> {!c.active && <span className="badge">Inactive</span>}
                  </td>
                  <td>{c.discountPercent}%</td>
                  <td>{c.examTitle ?? 'Any'}</td>
                  <td>{c.usedCount}{c.maxUses !== null && ` / ${c.maxUses}`}</td>
                  <td>{c.validUntil ? formatDate(c.validUntil) : '—'}</td>
                  <td>{c.note ?? ''}</td>
                  <td><button className="btn secondary small" onClick={() => setEditing(c)}>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function CouponEditor({ coupon, onDone }: { coupon: Coupon | null; onDone: () => void }) {
  const queryClient = useQueryClient()
  const { data: exams } = useAdminExams()
  const [form, setForm] = useState<CouponForm>(
    coupon
      ? {
          code: coupon.code,
          discountPercent: coupon.discountPercent,
          examId: coupon.examId,
          maxUses: coupon.maxUses,
          validUntil: coupon.validUntil ? coupon.validUntil.slice(0, 10) : '',
          active: coupon.active,
          note: coupon.note ?? '',
        }
      : EMPTY,
  )
  const save = useMutation({
    mutationFn: () => {
      // A date means "valid through the end of that day" in India.
      const json = { ...form, validUntil: form.validUntil ? new Date(`${form.validUntil}T23:59:59+05:30`).toISOString() : null }
      return coupon
        ? api(`/api/admin/coupons/${coupon.id}`, { method: 'PUT', json })
        : api('/api/admin/coupons', { method: 'POST', json })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'coupons'] })
      onDone()
    },
  })
  const fields = save.error instanceof ApiError ? save.error.fields : {}

  function submit(e: FormEvent) {
    e.preventDefault()
    save.mutate()
  }

  return (
    <form className="card" onSubmit={submit} style={{ maxWidth: 720 }}>
      <h3>{coupon ? `Edit ${coupon.code}` : 'New coupon'}</h3>
      {save.isError && <Alert kind="error">{save.error.message}</Alert>}
      <div className="grid">
        <Field label="Code" hint="e.g. BATCH-JAN" error={fields.code}>
          <input type="text" value={form.code} disabled={!!coupon} onChange={(e) => setForm({ ...form, code: e.target.value })} />
        </Field>
        <Field label="Discount (%)" error={fields.discountPercent}>
          <input type="number" min={1} max={100} value={form.discountPercent} onChange={(e) => setForm({ ...form, discountPercent: Number(e.target.value) })} />
        </Field>
        <Field label="Exam">
          <select value={form.examId ?? ''} onChange={(e) => setForm({ ...form, examId: e.target.value ? Number(e.target.value) : null })}>
            <option value="">Any exam</option>
            {exams?.filter((x) => x.kind === 'CERTIFICATION').map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
          </select>
        </Field>
        <Field label="Maximum uses" hint="Blank: unlimited." error={fields.maxUses}>
          <input type="number" min={1} value={form.maxUses ?? ''} onChange={(e) => setForm({ ...form, maxUses: e.target.value ? Number(e.target.value) : null })} />
        </Field>
        <Field label="Valid until" hint="Blank: no end date.">
          <input type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} />
        </Field>
        <Field label="Note" hint="Only admins see this." error={fields.note}>
          <input type="text" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </Field>
      </div>
      <label className="check" style={{ marginBottom: 16 }}>
        <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
        <span>Active</span>
      </label>
      <div className="row">
        <button className="btn" disabled={save.isPending}>Save</button>
        <button type="button" className="btn secondary" onClick={onDone}>Cancel</button>
      </div>
    </form>
  )
}
