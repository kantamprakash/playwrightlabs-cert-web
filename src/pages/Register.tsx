import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { ApiError, post } from '../api'
import { Alert, Field } from '../components/Field'

export function Register() {
  const [form, setForm] = useState({ fullName: '', email: '', password: '' })
  const register = useMutation({ mutationFn: () => post<{ message: string }>('/api/auth/register', form) })
  const fields = register.error instanceof ApiError ? register.error.fields : {}

  function submit(e: FormEvent) {
    e.preventDefault()
    register.mutate()
  }

  if (register.isSuccess) {
    return (
      <main className="container page narrow">
        <div className="card">
          <h1>Check your inbox</h1>
          <p className="muted">
            We sent a verification link to <strong>{form.email}</strong>. Open it to activate your account, then sign in.
          </p>
          <p className="faint">Can't find it? Check your spam folder. The link is valid for 24 hours.</p>
          <Link to="/login" className="btn secondary">Go to sign in</Link>
        </div>
      </main>
    )
  }

  return (
    <main className="container page narrow">
      <form className="card" onSubmit={submit} noValidate>
        <h1>Create your account</h1>
        {register.isError && !Object.keys(fields).length && <Alert kind="error">{register.error.message}</Alert>}
        <Field label="Full name" hint="Exactly as it should appear on your certificate." error={fields.fullName}>
          <input type="text" autoComplete="name" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
        </Field>
        <Field label="Email" error={fields.email}>
          <input type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Password" hint="At least 8 characters." error={fields.password}>
          <input type="password" autoComplete="new-password" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        <button className="btn block" disabled={register.isPending}>
          {register.isPending ? 'Creating account…' : 'Create account'}
        </button>
        <p className="faint" style={{ marginTop: 16, marginBottom: 0 }}>
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </main>
  )
}
