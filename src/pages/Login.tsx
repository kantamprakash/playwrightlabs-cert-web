import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { ApiError, post, type User } from '../api'
import { useMe } from '../auth'
import { Alert, Field } from '../components/Field'

export function Login() {
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: me } = useMe()
  const [form, setForm] = useState({ email: '', password: '' })

  const destination = (user: User) => next ?? (user.role === 'ADMIN' ? '/admin' : '/dashboard')
  const login = useMutation({
    mutationFn: () => post<User>('/api/auth/login', form),
    onSuccess: (user) => {
      queryClient.setQueryData(['me'], user)
      navigate(destination(user), { replace: true })
    },
  })
  const resend = useMutation({ mutationFn: () => post<{ message: string }>('/api/auth/resend-verification', { email: form.email }) })

  if (me) return <Navigate to={destination(me)} replace />

  function submit(e: FormEvent) {
    e.preventDefault()
    login.mutate()
  }

  const notVerified = login.error instanceof ApiError && login.error.code === 'EMAIL_NOT_VERIFIED'

  return (
    <main className="container page narrow">
      <form className="card" onSubmit={submit}>
        <h1>Sign in</h1>
        {login.isError && <Alert kind="error">{login.error.message}</Alert>}
        {notVerified && !resend.isSuccess && (
          <p>
            <button type="button" className="btn secondary small" onClick={() => resend.mutate()} disabled={resend.isPending}>
              Resend verification email
            </button>
          </p>
        )}
        {resend.isSuccess && <Alert kind="ok">{resend.data.message}</Alert>}
        <Field label="Email">
          <input type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Password">
          <input type="password" autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        <button className="btn block" disabled={login.isPending}>{login.isPending ? 'Signing in…' : 'Sign in'}</button>
        <div className="spread faint" style={{ marginTop: 16 }}>
          <Link to="/forgot-password">Forgot password?</Link>
          <span>New here? <Link to="/register">Create an account</Link></span>
        </div>
      </form>
    </main>
  )
}

/** Only allow redirects to paths on this site. */
function safeNext(next: string | null) {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : null
}
