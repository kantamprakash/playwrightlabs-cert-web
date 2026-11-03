import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ApiError, post } from '../api'
import { Alert, Field } from '../components/Field'

export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const send = useMutation({ mutationFn: () => post<{ message: string }>('/api/auth/forgot-password', { email }) })

  function submit(e: FormEvent) {
    e.preventDefault()
    send.mutate()
  }

  return (
    <main className="container page narrow">
      <form className="card" onSubmit={submit}>
        <h1>Reset your password</h1>
        {send.isSuccess ? (
          <Alert kind="ok">{send.data.message}</Alert>
        ) : (
          <>
            <p className="muted">Enter your account email and we'll send you a reset link.</p>
            {send.isError && <Alert kind="error">{send.error.message}</Alert>}
            <Field label="Email">
              <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <button className="btn block" disabled={send.isPending}>Send reset link</button>
          </>
        )}
        <p className="faint" style={{ marginTop: 16, marginBottom: 0 }}><Link to="/login">Back to sign in</Link></p>
      </form>
    </main>
  )
}

export function ResetPassword() {
  const [params] = useSearchParams()
  const [password, setPassword] = useState('')
  const reset = useMutation({
    mutationFn: () => post<{ message: string }>('/api/auth/reset-password', { token: params.get('token') ?? '', password }),
  })
  const fields = reset.error instanceof ApiError ? reset.error.fields : {}

  function submit(e: FormEvent) {
    e.preventDefault()
    reset.mutate()
  }

  return (
    <main className="container page narrow">
      <form className="card" onSubmit={submit}>
        <h1>Choose a new password</h1>
        {reset.isSuccess ? (
          <>
            <Alert kind="ok">{reset.data.message}</Alert>
            <Link to="/login" className="btn">Sign in</Link>
          </>
        ) : (
          <>
            {reset.isError && !fields.password && <Alert kind="error">{reset.error.message}</Alert>}
            <Field label="New password" hint="At least 8 characters." error={fields.password}>
              <input type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <button className="btn block" disabled={reset.isPending}>Update password</button>
          </>
        )}
      </form>
    </main>
  )
}
