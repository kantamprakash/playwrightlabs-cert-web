import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { api, ApiError, rupees } from '../../api'
import { Alert, Field } from '../../components/Field'
import { useAdminExams, type AdminExam } from './AdminLayout'

type ExamForm = Omit<AdminExam, 'id' | 'activeQuestions' | 'problem'>

const EMPTY: ExamForm = {
  slug: '',
  title: '',
  description: '',
  durationMinutes: 60,
  questionCount: 40,
  passPercent: 70,
  priceInr: 0,
  retakePriceInr: null,
  retakeCooldownDays: 7,
  kind: 'CERTIFICATION',
  published: false,
}

type Difficulty = 'EASY' | 'MEDIUM' | 'HARD'
type DifficultyStock = { difficulty: Difficulty; activeQuestions: number; quota: number | null; byTopic: Record<string, number> }
type Blueprint = { difficulties: DifficultyStock[]; problem: string | null }
const LABEL: Record<Difficulty, string> = { EASY: 'Easy', MEDIUM: 'Medium', HARD: 'Hard' }

export function AdminExams() {
  const { data: exams, isPending } = useAdminExams()
  const [editing, setEditing] = useState<AdminExam | 'new' | null>(null)
  const [blueprintFor, setBlueprintFor] = useState<AdminExam | null>(null)

  if (isPending) return <p className="muted">Loading…</p>
  if (editing) return <ExamEditor exam={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />
  if (blueprintFor) return <BlueprintEditor exam={blueprintFor} onDone={() => setBlueprintFor(null)} />

  return (
    <div className="stack">
      <PaymentStatus />
      <div className="spread">
        <p className="muted" style={{ margin: 0 }}>
          An exam can be published once its question bank (and blueprint, if it has one) can fill every attempt.
        </p>
        <button className="btn secondary small" onClick={() => setEditing('new')}>New exam</button>
      </div>
      {exams?.map((e) => (
        <div className="card spread" key={e.id}>
          <div>
            <h3 style={{ marginBottom: 4 }}>
              {e.title}{' '}
              <span className={`badge ${e.published ? 'green' : ''}`}>{e.published ? 'Published' : 'Draft'}</span>{' '}
              {e.kind === 'PRACTICE' && <span className="badge orange">Practice</span>}
            </h3>
            <div className="faint">
              {e.questionCount} questions per attempt · {e.durationMinutes} min · pass {e.passPercent}%
              {e.kind === 'CERTIFICATION' && (
                <> · {rupees(e.priceInr)} · retake {rupees(e.retakePriceInr ?? e.priceInr)} after {e.retakeCooldownDays} days</>
              )}
            </div>
            <div className="faint">{e.activeQuestions} active questions in the bank</div>
            {e.problem && <div style={{ color: 'var(--warn)' }}>{e.problem}</div>}
          </div>
          <div className="row">
            <button className="btn secondary small" onClick={() => setBlueprintFor(e)}>Blueprint</button>
            <button className="btn secondary small" onClick={() => setEditing(e)}>Edit</button>
          </div>
        </div>
      ))}
    </div>
  )
}

function PaymentStatus() {
  const { data } = useQuery({
    queryKey: ['admin', 'payment-status'],
    queryFn: () => api<{ onlinePayments: boolean; mock: boolean; gstInvoices: boolean }>('/api/admin/payment-status'),
  })
  if (!data) return null
  if (data.mock) {
    return (
      <Alert kind="warn">
        Mock payments are on (PAYMENTS_MOCK): checkouts are simulated, no money is taken, and receipts are numbered
        MOCK-…. Turn this off before real candidates enrol.
      </Alert>
    )
  }
  if (!data.onlinePayments) {
    return (
      <Alert kind="warn">
        Online payment is off: set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to turn it on. Until then, paid exams can
        only be unlocked with a 100% coupon or by granting access.
      </Alert>
    )
  }
  return (
    <Alert kind="ok">
      Online payment is on. Invoices are issued as {data.gstInvoices ? 'GST tax invoices' : 'payment receipts (no GSTIN set)'}.
    </Alert>
  )
}

function ExamEditor({ exam, onDone }: { exam: AdminExam | null; onDone: () => void }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<ExamForm>(exam ? { ...exam } : EMPTY)
  const save = useMutation({
    mutationFn: () =>
      exam
        ? api(`/api/admin/exams/${exam.id}`, { method: 'PUT', json: form })
        : api('/api/admin/exams', { method: 'POST', json: form }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'exams'] })
      queryClient.invalidateQueries({ queryKey: ['exams'] })
      onDone()
    },
  })
  const fields = save.error instanceof ApiError ? save.error.fields : {}
  const num = (key: keyof ExamForm) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: Number(e.target.value) })
  const practice = form.kind === 'PRACTICE'

  function submit(e: FormEvent) {
    e.preventDefault()
    save.mutate()
  }

  return (
    <form className="card" onSubmit={submit} style={{ maxWidth: 720 }}>
      <h2>{exam ? 'Edit exam' : 'New exam'}</h2>
      {save.isError && <Alert kind="error">{save.error.message}</Alert>}
      <Field label="Title" error={fields.title}>
        <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      </Field>
      <Field label="Slug" hint="Used in URLs, e.g. playwright-certified-tester." error={fields.slug}>
        <input type="text" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
      </Field>
      <Field label="Description" error={fields.description}>
        <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </Field>
      <Field label="Type" hint="Practice tests are free, start at once, show answers afterwards and never issue a certificate.">
        <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as ExamForm['kind'] })}>
          <option value="CERTIFICATION">Certification exam</option>
          <option value="PRACTICE">Practice test</option>
        </select>
      </Field>
      <div className="grid">
        <Field label="Duration (minutes)" error={fields.durationMinutes}>
          <input type="number" min={5} value={form.durationMinutes} onChange={num('durationMinutes')} />
        </Field>
        <Field label="Questions per attempt" error={fields.questionCount}>
          <input type="number" min={1} value={form.questionCount} onChange={num('questionCount')} />
        </Field>
        <Field label="Pass mark (%)" error={fields.passPercent}>
          <input type="number" min={1} max={100} value={form.passPercent} onChange={num('passPercent')} />
        </Field>
        {!practice && (
          <>
            <Field label="Price (₹, incl. GST)" error={fields.priceInr}>
              <input type="number" min={0} value={form.priceInr} onChange={num('priceInr')} />
            </Field>
            <Field label="Retake price (₹)" hint="Blank: same as the price." error={fields.retakePriceInr}>
              <input
                type="number"
                min={0}
                value={form.retakePriceInr ?? ''}
                onChange={(e) => setForm({ ...form, retakePriceInr: e.target.value === '' ? null : Number(e.target.value) })}
              />
            </Field>
            <Field label="Days before a retake" error={fields.retakeCooldownDays}>
              <input type="number" min={0} max={365} value={form.retakeCooldownDays} onChange={num('retakeCooldownDays')} />
            </Field>
          </>
        )}
      </div>
      <label className="check" style={{ marginBottom: 16 }}>
        <input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} />
        <span>Published: {practice ? 'candidates can start this practice test' : 'candidates can buy and take this exam'}</span>
      </label>
      <div className="row">
        <button className="btn" disabled={save.isPending}>Save</button>
        <button type="button" className="btn secondary" onClick={onDone}>Cancel</button>
      </div>
    </form>
  )
}

/** Questions per difficulty for each attempt. Leave every level at 0 to draw from the whole bank. */
function BlueprintEditor({ exam, onDone }: { exam: AdminExam; onDone: () => void }) {
  const queryClient = useQueryClient()
  const { data, isPending } = useQuery({
    queryKey: ['admin', 'blueprint', exam.id],
    queryFn: () => api<Blueprint>(`/api/admin/exams/${exam.id}/blueprint`),
  })
  const [counts, setCounts] = useState<Partial<Record<Difficulty, number>> | null>(null)
  const values: Partial<Record<Difficulty, number>> =
    counts ?? Object.fromEntries((data?.difficulties ?? []).map((d) => [d.difficulty, d.quota ?? 0]))
  const total = Object.values(values).reduce((a, b) => a + (b ?? 0), 0)

  const save = useMutation({
    mutationFn: () =>
      api<Blueprint>(`/api/admin/exams/${exam.id}/blueprint`, {
        method: 'PUT',
        json: { difficulties: Object.entries(values).map(([difficulty, questionCount]) => ({ difficulty, questionCount })) },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'exams'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'blueprint', exam.id] })
      onDone()
    },
  })

  if (isPending) return <p className="muted">Loading…</p>

  return (
    <div className="card stack" style={{ maxWidth: 760 }}>
      <h2>Blueprint: {exam.title}</h2>
      <p className="muted" style={{ margin: 0 }}>
        How many questions of each level every attempt draws. Within each level the questions are spread across
        topics, and a retake gets questions the candidate hasn't seen when the bank has enough. For a different
        paper per candidate, keep about three times as many active questions per level as each attempt uses.
      </p>
      {save.isError && <Alert kind="error">{save.error.message}</Alert>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Level</th><th>Active questions</th><th>Topics</th><th>Per attempt</th></tr>
          </thead>
          <tbody>
            {data?.difficulties.map((d) => {
              const n = values[d.difficulty] ?? 0
              return (
                <tr key={d.difficulty}>
                  <td>{LABEL[d.difficulty]}</td>
                  <td style={n > 0 && d.activeQuestions < n * 3 ? { color: 'var(--warn)' } : undefined}>
                    {d.activeQuestions}
                    {n > 0 && d.activeQuestions < n * 3 && ' (low: candidates will often share questions)'}
                  </td>
                  <td className="faint">{Object.keys(d.byTopic).length}</td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      max={d.activeQuestions}
                      value={n}
                      onChange={(e) => setCounts({ ...values, [d.difficulty]: Number(e.target.value) })}
                      style={{ maxWidth: 90 }}
                      aria-label={`${LABEL[d.difficulty]} questions per attempt`}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div style={{ color: total === 0 || total === exam.questionCount ? undefined : 'var(--warn)' }}>
        {total === 0 ? 'No blueprint: random draw from the whole bank.' : `Total ${total} of ${exam.questionCount} questions per attempt.`}
      </div>
      <div className="row">
        <button className="btn" disabled={save.isPending || (total !== 0 && total !== exam.questionCount)} onClick={() => save.mutate()}>
          Save blueprint
        </button>
        <button className="btn secondary" onClick={onDone}>Cancel</button>
      </div>
    </div>
  )
}
