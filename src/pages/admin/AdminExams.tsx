import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { api, ApiError } from '../../api'
import { Alert, Field } from '../../components/Field'
import { useAdminExams, type AdminExam } from './AdminLayout'

type ExamForm = Omit<AdminExam, 'id' | 'activeQuestions'>

const EMPTY: ExamForm = {
  slug: '',
  title: '',
  description: '',
  durationMinutes: 60,
  questionCount: 40,
  passPercent: 70,
  priceInr: 0,
  published: false,
}

export function AdminExams() {
  const { data: exams, isPending } = useAdminExams()
  const [editing, setEditing] = useState<AdminExam | 'new' | null>(null)

  if (isPending) return <p className="muted">Loading…</p>
  if (editing) return <ExamEditor exam={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />

  return (
    <div className="stack">
      <div className="spread">
        <p className="muted" style={{ margin: 0 }}>
          An exam can only be published once its bank has at least as many active questions as it asks per attempt.
        </p>
        <button className="btn secondary small" onClick={() => setEditing('new')}>New exam</button>
      </div>
      {exams?.map((e) => (
        <div className="card spread" key={e.id}>
          <div>
            <h3 style={{ marginBottom: 4 }}>
              {e.title} <span className={`badge ${e.published ? 'green' : ''}`}>{e.published ? 'Published' : 'Draft'}</span>
            </h3>
            <div className="faint">
              {e.questionCount} questions per attempt · {e.durationMinutes} min · pass {e.passPercent}% · ₹{e.priceInr}
            </div>
            <div className={e.activeQuestions < e.questionCount ? '' : 'faint'} style={e.activeQuestions < e.questionCount ? { color: 'var(--warn)' } : undefined}>
              {e.activeQuestions} active questions in the bank
              {e.activeQuestions < e.questionCount && ` (needs ${e.questionCount - e.activeQuestions} more to publish)`}
            </div>
          </div>
          <button className="btn secondary small" onClick={() => setEditing(e)}>Edit</button>
        </div>
      ))}
    </div>
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
        <Field label="Price (₹)" hint="Used once payments go live." error={fields.priceInr}>
          <input type="number" min={0} value={form.priceInr} onChange={num('priceInr')} />
        </Field>
      </div>
      <label className="check" style={{ marginBottom: 16 }}>
        <input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} />
        <span>Published: candidates with access can start this exam</span>
      </label>
      <div className="row">
        <button className="btn" disabled={save.isPending}>Save</button>
        <button type="button" className="btn secondary" onClick={onDone}>Cancel</button>
      </div>
    </form>
  )
}
