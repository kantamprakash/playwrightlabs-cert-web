import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { api, ApiError, labLanguage, type LabLanguage } from '../../api'
import { Alert, Field } from '../../components/Field'
import { useAdminExams } from './AdminLayout'

type Difficulty = 'EASY' | 'MEDIUM' | 'HARD'
const DIFFICULTY_LABEL: Record<Difficulty, string> = { EASY: 'Easy', MEDIUM: 'Medium', HARD: 'Hard' }

type Option = { id?: number; text: string; correct: boolean }
type Question = {
  id: number
  type: 'SINGLE' | 'MULTI'
  topic: string | null
  difficulty: Difficulty
  text: string
  codeSnippet: string | null
  /** Only drawn for candidates taking the exam in this language; null for every language. */
  language: LabLanguage | null
  explanation: string | null
  active: boolean
  options: Option[]
}
type QuestionForm = Omit<Question, 'id'>

const NEW_QUESTION: QuestionForm = {
  type: 'SINGLE',
  topic: '',
  difficulty: 'MEDIUM',
  text: '',
  codeSnippet: '',
  language: null,
  explanation: '',
  active: true,
  options: [
    { text: '', correct: true },
    { text: '', correct: false },
    { text: '', correct: false },
    { text: '', correct: false },
  ],
}

const CSV_TEMPLATE =
  'type,topic,difficulty,question,code,option_a,option_b,option_c,option_d,option_e,option_f,correct,explanation\n' +
  'SINGLE,Locators,EASY,"Which locator is most resilient for a Submit button?",,"page.getByRole(\'button\', { name: \'Submit\' })","page.locator(\'.btn-1\')","page.locator(\'//div[3]/button\')",,,,A,"Role locators match what users see."\n' +
  'MULTI,Configuration,MEDIUM,"Which are valid `use` options? (Select all that apply)",,baseURL,trace,testDir,,,,A;B,"testDir is top-level."\n'

export function AdminQuestions() {
  const { data: exams } = useAdminExams()
  const [examId, setExamId] = useState<number | null>(null)
  const selectedExam = examId ?? exams?.[0]?.id ?? null
  const [editing, setEditing] = useState<Question | 'new' | null>(null)
  const [filter, setFilter] = useState('')
  const [level, setLevel] = useState<Difficulty | ''>('')

  const { data: questions, isPending } = useQuery({
    queryKey: ['admin', 'questions', selectedExam],
    queryFn: () => api<Question[]>(`/api/admin/exams/${selectedExam}/questions`),
    enabled: selectedExam != null,
  })

  if (!exams) return <p className="muted">Loading…</p>
  if (editing && selectedExam != null) {
    return <QuestionEditor examId={selectedExam} question={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />
  }

  const shown = (questions ?? []).filter(
    (q) =>
      (!level || q.difficulty === level) &&
      (!filter || (q.text + ' ' + (q.topic ?? '')).toLowerCase().includes(filter.toLowerCase())),
  )
  const active = questions?.filter((q) => q.active) ?? []
  const count = (d: Difficulty) => active.filter((q) => q.difficulty === d).length

  return (
    <div className="stack">
      <div className="row">
        {exams.length > 1 && (
          <select value={selectedExam ?? ''} onChange={(e) => setExamId(Number(e.target.value))} style={{ maxWidth: 320 }}>
            {exams.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
          </select>
        )}
        <input type="search" placeholder="Search questions" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ maxWidth: 280 }} />
        <select value={level} onChange={(e) => setLevel(e.target.value as Difficulty | '')} style={{ maxWidth: 160 }} aria-label="Difficulty">
          <option value="">All levels</option>
          <option value="EASY">Easy</option>
          <option value="MEDIUM">Medium</option>
          <option value="HARD">Hard</option>
        </select>
        <span className="faint">
          {active.length} active ({count('EASY')} easy · {count('MEDIUM')} medium · {count('HARD')} hard) / {questions?.length ?? 0} total
        </span>
        <button className="btn small" style={{ marginLeft: 'auto' }} onClick={() => setEditing('new')}>Add question</button>
      </div>

      {selectedExam != null && <CsvImport examId={selectedExam} />}

      {isPending ? (
        <p className="muted">Loading…</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>#</th><th>Question</th><th>Topic</th><th>Level</th><th>Type</th><th>Status</th><th /></tr>
            </thead>
            <tbody>
              {shown.map((q) => (
                <tr key={q.id} style={q.active ? undefined : { opacity: 0.55 }}>
                  <td className="faint">{q.id}</td>
                  <td>
                    {q.text}
                    {q.language && <> <span className="badge">{labLanguage(q.language).label} only</span></>}
                  </td>
                  <td>{q.topic ?? '—'}</td>
                  <td>{DIFFICULTY_LABEL[q.difficulty]}</td>
                  <td>{q.type === 'SINGLE' ? 'Single' : 'Multiple'}</td>
                  <td>{q.active ? <span className="badge green">Active</span> : <span className="badge">Retired</span>}</td>
                  <td><button className="btn secondary small" onClick={() => setEditing(q)}>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function CsvImport({ examId }: { examId: number }) {
  const queryClient = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const upload = useMutation({
    mutationFn: () => {
      const body = new FormData()
      body.append('file', file!)
      return api<{ imported: number; errors: string[] }>(`/api/admin/exams/${examId}/questions/import`, { method: 'POST', body })
    },
    onSuccess: (res) => {
      if (res.imported) queryClient.invalidateQueries({ queryKey: ['admin'] })
    },
  })

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([CSV_TEMPLATE], { type: 'text/csv' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: 'questions-template.csv' })
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <details className="card tight">
      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Bulk import from CSV</summary>
      <div className="stack" style={{ marginTop: 12 }}>
        <p className="faint" style={{ margin: 0 }}>
          Columns: type (SINGLE or MULTI), topic, difficulty (EASY, MEDIUM or HARD; blank is MEDIUM), question, code, option_a … option_f, correct (letters, e.g. B or A;C), explanation. Optional: language (TYPESCRIPT or JAVASCRIPT for a question only those candidates should get; blank for everyone).
          If any row is invalid, nothing is imported.{' '}
          <button type="button" className="linkish" style={{ color: 'var(--primary)' }} onClick={downloadTemplate}>Download template</button>
        </p>
        <div className="row">
          <input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <button className="btn small" disabled={!file || upload.isPending} onClick={() => upload.mutate()}>Import</button>
        </div>
        {upload.isError && <Alert kind="error">{upload.error.message}</Alert>}
        {upload.data && upload.data.errors.length > 0 && (
          <Alert kind="error">
            Nothing was imported. Fix these rows and try again:
            <ul className="clean" style={{ marginTop: 8 }}>{upload.data.errors.map((e) => <li key={e}>{e}</li>)}</ul>
          </Alert>
        )}
        {upload.data && upload.data.imported > 0 && <Alert kind="ok">Imported {upload.data.imported} questions.</Alert>}
      </div>
    </details>
  )
}

function QuestionEditor({ examId, question, onDone }: { examId: number; question: Question | null; onDone: () => void }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<QuestionForm>(() =>
    question ? { ...question, topic: question.topic ?? '', codeSnippet: question.codeSnippet ?? '', explanation: question.explanation ?? '' } : NEW_QUESTION,
  )
  const save = useMutation({
    mutationFn: () =>
      question
        ? api(`/api/admin/questions/${question.id}`, { method: 'PUT', json: form })
        : api(`/api/admin/exams/${examId}/questions`, { method: 'POST', json: form }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin'] })
      onDone()
    },
  })
  const fields = save.error instanceof ApiError ? save.error.fields : {}

  function setOption(i: number, patch: Partial<Option>) {
    let options = form.options.map((o, j) => (j === i ? { ...o, ...patch } : o))
    if (patch.correct && form.type === 'SINGLE') options = options.map((o, j) => ({ ...o, correct: j === i }))
    setForm({ ...form, options })
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    save.mutate()
  }

  return (
    <form className="card" onSubmit={submit} style={{ maxWidth: 820 }}>
      <h2>{question ? `Edit question #${question.id}` : 'New question'}</h2>
      {save.isError && <Alert kind="error">{save.error.message}</Alert>}
      <div className="grid">
        <Field label="Type">
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as QuestionForm['type'] })}>
            <option value="SINGLE">Single choice (one correct)</option>
            <option value="MULTI">Multiple choice (select all that apply)</option>
          </select>
        </Field>
        <Field label="Topic" hint="Used for the candidate's score breakdown.">
          <input type="text" value={form.topic ?? ''} onChange={(e) => setForm({ ...form, topic: e.target.value })} />
        </Field>
        <Field label="Difficulty" hint="Attempts draw a set number of questions of each level (see the exam's blueprint).">
          <select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value as Difficulty })}>
            <option value="EASY">Easy</option>
            <option value="MEDIUM">Medium</option>
            <option value="HARD">Hard</option>
          </select>
        </Field>
        <Field label="Language" hint="Candidates choose TypeScript or JavaScript. Limit a question to one only if it doesn't apply to the other.">
          <select
            value={form.language ?? ''}
            onChange={(e) => setForm({ ...form, language: (e.target.value || null) as LabLanguage | null })}
          >
            <option value="">Both languages</option>
            <option value="TYPESCRIPT">TypeScript only</option>
            <option value="JAVASCRIPT">JavaScript only</option>
          </select>
        </Field>
      </div>
      <Field label="Question" error={fields.text}>
        <textarea value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} />
      </Field>
      <Field label="Code snippet (optional)">
        <textarea className="code" value={form.codeSnippet ?? ''} onChange={(e) => setForm({ ...form, codeSnippet: e.target.value })} />
      </Field>
      <div className="field">
        <label>Options: tick the correct {form.type === 'SINGLE' ? 'answer' : 'answers'}</label>
        {fields.options && <div className="error">{fields.options}</div>}
        <div className="stack" style={{ marginTop: 8 }}>
          {form.options.map((o, i) => (
            <div className="row" key={o.id ?? `new-${i}`} style={{ flexWrap: 'nowrap' }}>
              <input
                type={form.type === 'SINGLE' ? 'radio' : 'checkbox'}
                name="correct"
                checked={o.correct}
                onChange={(e) => setOption(i, { correct: e.target.checked })}
                aria-label={`Option ${i + 1} is correct`}
              />
              <input type="text" value={o.text} placeholder={`Option ${String.fromCharCode(65 + i)}`} onChange={(e) => setOption(i, { text: e.target.value })} />
              <button
                type="button"
                className="btn secondary small"
                disabled={form.options.length <= 2}
                onClick={() => setForm({ ...form, options: form.options.filter((_, j) => j !== i) })}
                aria-label="Remove option"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        {form.options.length < 6 && (
          <button type="button" className="btn secondary small" style={{ marginTop: 10 }} onClick={() => setForm({ ...form, options: [...form.options, { text: '', correct: false }] })}>
            Add option
          </button>
        )}
      </div>
      <Field label="Explanation (internal; not shown to candidates)">
        <textarea value={form.explanation ?? ''} onChange={(e) => setForm({ ...form, explanation: e.target.value })} />
      </Field>
      <label className="check" style={{ marginBottom: 16 }}>
        <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
        <span>Active: can be drawn for new attempts</span>
      </label>
      <div className="row">
        <button className="btn" disabled={save.isPending}>Save</button>
        <button type="button" className="btn secondary" onClick={onDone}>Cancel</button>
      </div>
    </form>
  )
}
