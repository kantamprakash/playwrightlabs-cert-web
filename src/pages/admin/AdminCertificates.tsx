import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'
import { api, formatDate, post } from '../../api'
import { Alert } from '../../components/Field'

type CertificateRow = {
  certNo: string
  holderName: string
  email: string
  examTitle: string
  scorePercent: number
  certified: boolean
  issuedAt: string
  revokedAt: string | null
  revokeReason: string | null
}

export function AdminCertificates() {
  const queryClient = useQueryClient()
  const { data, isPending } = useQuery({ queryKey: ['admin', 'certificates'], queryFn: () => api<CertificateRow[]>('/api/admin/certificates') })
  const revoke = useMutation({
    mutationFn: ({ certNo, reason }: { certNo: string; reason: string }) => post(`/api/admin/certificates/${certNo}/revoke`, { reason }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'certificates'] }),
  })

  function askRevoke(c: CertificateRow) {
    const reason = window.prompt(`Revoke ${c.certNo} for ${c.holderName}? This cannot be undone.\n\nReason:`)
    if (reason?.trim()) revoke.mutate({ certNo: c.certNo, reason: reason.trim() })
  }

  if (isPending) return <p className="muted">Loading…</p>
  if (!data?.length) return <p className="muted">No certificates issued yet.</p>

  return (
    <div className="stack">
      {revoke.isError && <Alert kind="error">{revoke.error.message}</Alert>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Certificate</th><th>Holder</th><th>Exam</th><th>Score</th><th>Issued</th><th>Status</th><th /></tr>
          </thead>
          <tbody>
            {data.map((c) => (
              <tr key={c.certNo}>
                <td><Link to={`/verify/${c.certNo}`}>{c.certNo}</Link></td>
                <td>{c.holderName}<div className="faint">{c.email}</div></td>
                <td>{c.examTitle}</td>
                <td>{c.scorePercent}%<div className="faint">{c.certified ? 'Achievement' : 'Participation'}</div></td>
                <td>{formatDate(c.issuedAt)}</td>
                <td>
                  {c.revokedAt ? (
                    <><span className="badge red">Revoked</span><div className="faint">{c.revokeReason}</div></>
                  ) : (
                    <span className="badge green">Valid</span>
                  )}
                </td>
                <td className="row" style={{ flexWrap: 'nowrap' }}>
                  {!c.revokedAt && (
                    <>
                      <a className="btn secondary small" href={`/api/me/certificates/${c.certNo}/pdf`}>PDF</a>
                      <button className="btn danger small" onClick={() => askRevoke(c)}>Revoke</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
