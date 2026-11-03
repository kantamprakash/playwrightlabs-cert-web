import { useState, type FormEvent } from 'react'
import { Alert } from './Field'

/** "YYYY-MM-DDTHH:mm" in local time, the format a datetime-local input uses. */
function toLocalInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Tomorrow at 10:00 local time: a sensible first suggestion. */
function defaultSlot() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(10, 0, 0, 0)
  return d
}

const zoneName = new Intl.DateTimeFormat('en-IN', { timeZoneName: 'long' })
  .formatToParts(new Date())
  .find((p) => p.type === 'timeZoneName')?.value

/**
 * Lets the candidate pick when they will take the exam. The server re-checks the limits;
 * min/max here just keep the browser's picker inside them.
 */
export function SchedulePicker({
  minNoticeMinutes,
  latest,
  initial,
  submitLabel,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  minNoticeMinutes: number
  latest?: string
  initial?: string | null
  submitLabel: string
  pending: boolean
  error?: string
  onSubmit: (scheduledAtIso: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState(() => toLocalInput(initial && new Date(initial) > new Date() ? new Date(initial) : defaultSlot()))
  const [localError, setLocalError] = useState('')
  const earliest = new Date(Date.now() + minNoticeMinutes * 60_000)

  function submit(e: FormEvent) {
    e.preventDefault()
    const chosen = new Date(value)
    if (!value || Number.isNaN(chosen.getTime())) return setLocalError('Choose a date and time.')
    if (chosen < earliest) return setLocalError(`Choose a time at least ${minNoticeMinutes} minutes from now.`)
    setLocalError('')
    onSubmit(chosen.toISOString())
  }

  return (
    // noValidate: our own checks give clearer messages than the browser's, and min/max still guide the picker.
    <form className="stack" onSubmit={submit} noValidate style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
      <div className="field" style={{ marginBottom: 0 }}>
        <label htmlFor="exam-slot">When do you want to take the exam?</label>
        <input
          id="exam-slot"
          type="datetime-local"
          min={toLocalInput(earliest)}
          max={latest ? toLocalInput(new Date(latest)) : undefined}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required
          style={{ maxWidth: 280 }}
        />
        <div className="hint">
          Times are in your time zone{zoneName ? ` (${zoneName})` : ''}. You can start the exam from this time until 30 minutes after it,
          and you can reschedule any time before you start.
        </div>
      </div>
      {(localError || error) && <Alert kind="error">{localError || error}</Alert>}
      <div className="row">
        <button className="btn" disabled={pending}>{pending ? 'Saving…' : submitLabel}</button>
        <button type="button" className="btn secondary" onClick={onCancel} disabled={pending}>Cancel</button>
      </div>
    </form>
  )
}
