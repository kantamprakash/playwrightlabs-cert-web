import { useMutation } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router'
import { post } from '../api'
import { Alert } from '../components/Field'

export function VerifyEmail() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const verify = useMutation({ mutationFn: () => post<{ message: string }>('/api/auth/verify-email', { token }) })
  const started = useRef(false)

  useEffect(() => {
    // Tokens are single-use, so make sure StrictMode's double effect doesn't send it twice.
    if (token && !started.current) {
      started.current = true
      verify.mutate()
    }
  }, [token, verify])

  return (
    <main className="container page narrow">
      <div className="card">
        <h1>Email verification</h1>
        {!token && <Alert kind="error">This link is incomplete. Please open the full link from your email.</Alert>}
        {verify.isPending && <p className="muted">Verifying…</p>}
        {verify.isError && <Alert kind="error">{verify.error.message}</Alert>}
        {verify.isSuccess && <Alert kind="ok">{verify.data.message}</Alert>}
        <Link to="/login" className="btn">Sign in</Link>
      </div>
    </main>
  )
}
