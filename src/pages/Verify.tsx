import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { api, ApiError, formatDate, type Verification } from '../api'
import { Alert, Field } from '../components/Field'

export function Verify() {
  const { certNo } = useParams()
  const navigate = useNavigate()
  const [input, setInput] = useState(certNo ?? '')
  const { data, error, isFetching } = useQuery({
    queryKey: ['verify', certNo],
    queryFn: () => api<Verification>(`/api/public/certificates/${encodeURIComponent(certNo!)}`),
    enabled: !!certNo,
    retry: false,
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    const value = input.trim().toUpperCase()
    if (value) navigate(`/verify/${value}`)
  }

  return (
    <main className="container page" style={{ maxWidth: 640 }}>
      <h1>Verify a certificate</h1>
      <p className="muted">Enter the certificate number printed on a Playwright Labs certificate, or scan its QR code.</p>
      <form className="card" onSubmit={submit}>
        <Field label="Certificate number">
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <input type="text" placeholder="PWL-2026-XXXXXXXX" value={input} onChange={(e) => setInput(e.target.value)} />
            <button className="btn">Verify</button>
          </div>
        </Field>
      </form>

      <div style={{ marginTop: 24 }}>
        {isFetching && <p className="muted">Checking…</p>}
        {error && (
          <Alert kind="error">
            {error instanceof ApiError && error.status === 404
              ? 'No certificate exists with this number. Check it was entered exactly as printed.'
              : error.message}
          </Alert>
        )}
        {data && !isFetching && (
          <div className="card stack">
            <span className={`badge ${data.valid ? 'green' : 'red'}`}>{data.valid ? '✓ Valid certificate' : 'Revoked'}</span>
            <div>
              <div className="stat-label">Awarded to</div>
              <div className="stat">{data.holderName}</div>
            </div>
            <dl className="grid" style={{ margin: 0 }}>
              <div><dt className="stat-label">Certification</dt><dd style={{ margin: 0 }}>{data.examTitle}</dd></div>
              <div><dt className="stat-label">Issued</dt><dd style={{ margin: 0 }}>{formatDate(data.issuedAt)}</dd></div>
              <div><dt className="stat-label">Certificate number</dt><dd style={{ margin: 0 }}>{data.certNo}</dd></div>
            </dl>
            {!data.valid && (
              <p className="muted" style={{ margin: 0 }}>This certificate was revoked on {formatDate(data.revokedAt)} and is no longer valid.</p>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
