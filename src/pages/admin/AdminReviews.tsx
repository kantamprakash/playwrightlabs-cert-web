import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { api, formatDate, post, type ReviewStatus } from '../../api'
import { Alert } from '../../components/Field'

type ReviewRow = {
  attemptId: number
  candidateName: string
  candidateEmail: string
  examTitle: string
  examKind: 'CERTIFICATION' | 'PRACTICE' | 'LAB'
  submittedAt: string | null
  scorePercent: number | null
  passPercent: number
  reviewStatus: ReviewStatus
  reviewedAt: string | null
  reviewedBy: string | null
  flags: number
  recordedSeconds: number
}

type EventRow = { type: string; flag: boolean; detail: string | null; occurredAt: string }

type RecordingRow = {
  id: number
  stream: 'SCREEN' | 'CAMERA'
  mimeType: string
  startedAt: string
  lastChunkAt: string
  sizeBytes: number
  deleted: boolean
}

type SessionReview = {
  attemptId: number
  candidateName: string
  candidateEmail: string
  examTitle: string
  examKind: string
  status: string
  startedAt: string
  deadlineAt: string
  submittedAt: string | null
  proctoringStartedAt: string | null
  scorePercent: number | null
  passPercent: number
  passed: boolean | null
  tabSwitches: number
  reviewStatus: ReviewStatus | null
  reviewedAt: string | null
  reviewedBy: string | null
  reviewNote: string | null
  events: EventRow[]
  recordings: RecordingRow[]
}

const EVENT_LABELS: Record<string, string> = {
  SESSION_STARTED: 'Security check passed, recording started',
  PAGE_LEFT: 'Closed or reloaded the exam page',
  TAB_HIDDEN: 'Switched tab or minimised the browser',
  WINDOW_BLUR: 'Another window or app took focus',
  FULLSCREEN_EXIT: 'Left full screen',
  PASTE_BLOCKED: 'Paste from outside the exam (blocked)',
  DROP_BLOCKED: 'Drop from outside the exam (blocked)',
  DEVTOOLS_SHORTCUT: 'Developer tools shortcut (blocked)',
  MULTIPLE_DISPLAYS: 'Second display connected',
  SCREEN_SHARE_STOPPED: 'Screen sharing stopped',
  CAMERA_STOPPED: 'Camera stopped',
  RECORDING_ERROR: 'Recording upload problem',
}

function StatusBadge({ status }: { status: ReviewStatus | null }) {
  if (status === 'PENDING') return <span className="badge orange">Waiting for review</span>
  if (status === 'APPROVED') return <span className="badge green">Approved</span>
  if (status === 'REJECTED') return <span className="badge red">Rejected</span>
  return <span className="badge">No review needed</span>
}

function duration(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h ? `${h} h ${m} min` : `${m} min`
}

/** Sessions whose certificate waits for a review, then the ones already decided. */
export function AdminReviews() {
  const { data, isPending } = useQuery({ queryKey: ['admin', 'reviews'], queryFn: () => api<ReviewRow[]>('/api/admin/reviews') })
  if (isPending) return <p className="muted">Loading…</p>
  if (!data?.length) return <p className="muted">No proctored results to review yet.</p>
  const waiting = data.filter((r) => r.reviewStatus === 'PENDING').length
  return (
    <div className="stack">
      <p className="muted" style={{ margin: 0 }}>
        A proctored result that earns a certificate waits here until you’ve checked the session recording. Approving
        issues the certificate; rejecting withholds it and emails the candidate your reason.
      </p>
      <div className="facts" style={{ margin: 0 }}>
        <div className="card"><div className="stat">{waiting}</div><div className="stat-label">waiting for review</div></div>
        <div className="card"><div className="stat">{data.length - waiting}</div><div className="stat-label">reviewed</div></div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Candidate</th><th>Exam</th><th>Submitted</th><th>Score</th><th title="Events worth checking in the recording">Flags</th><th>Recorded</th><th>Status</th><th /></tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.attemptId}>
                <td>{r.candidateName}<div className="faint">{r.candidateEmail}</div></td>
                <td>{r.examTitle}</td>
                <td>{formatDate(r.submittedAt, true)}</td>
                <td>{r.scorePercent != null ? `${r.scorePercent}%` : '—'}</td>
                <td style={r.flags ? { color: 'var(--warn)', fontWeight: 600 } : undefined}>{r.flags}</td>
                <td>{duration(r.recordedSeconds)}</td>
                <td><StatusBadge status={r.reviewStatus} />{r.reviewedBy && <div className="faint">{r.reviewedBy}</div>}</td>
                <td>
                  <Link className={`btn small ${r.reviewStatus === 'PENDING' ? '' : 'secondary'}`} to={`/admin/reviews/${r.attemptId}`}>
                    {r.reviewStatus === 'PENDING' ? 'Review' : 'View'}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** One session: the recordings side by side, what the browser noticed, and the decision. */
export function AdminSessionReview() {
  const { attemptId } = useParams()
  const queryClient = useQueryClient()
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['admin', 'session', attemptId],
    queryFn: () => api<SessionReview>(`/api/admin/attempts/${attemptId}/proctoring`),
  })
  const [note, setNote] = useState('')
  const [screenId, setScreenId] = useState<number | null>(null)
  const [cameraId, setCameraId] = useState<number | null>(null)
  const [onlyFlags, setOnlyFlags] = useState(false)
  const screenVideo = useRef<HTMLVideoElement>(null)
  const cameraVideo = useRef<HTMLVideoElement>(null)
  const pendingSeek = useRef<{ screen?: number; camera?: number }>({})

  const decide = useMutation({
    mutationFn: (decision: 'APPROVE' | 'REJECT') =>
      post<SessionReview>(`/api/admin/attempts/${attemptId}/review`, { decision, note: note.trim() || null }),
    onSuccess: (next) => {
      queryClient.setQueryData(['admin', 'session', attemptId], next)
      queryClient.invalidateQueries({ queryKey: ['admin', 'reviews'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'attempts'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'certificates'] })
    },
  })

  const screens = data?.recordings.filter((r) => r.stream === 'SCREEN' && !r.deleted) ?? []
  const cameras = data?.recordings.filter((r) => r.stream === 'CAMERA' && !r.deleted) ?? []
  useEffect(() => {
    if (screenId == null && screens[0]) setScreenId(screens[0].id)
    if (cameraId == null && cameras[0]) setCameraId(cameras[0].id)
  }, [screens, cameras, screenId, cameraId])

  if (isPending) return <p className="muted">Loading…</p>
  if (isError || !data) return <Alert kind="error">{error?.message ?? 'Could not load the session.'}</Alert>

  const start = Date.parse(data.startedAt)
  const clock = (iso: string) => {
    const s = Math.max(0, Math.round((Date.parse(iso) - start) / 1000))
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  }
  const deletedAll = data.recordings.length > 0 && data.recordings.every((r) => r.deleted)
  const events = onlyFlags ? data.events.filter((e) => e.flag) : data.events

  /** Shows both recordings at the moment of an event: picks the segment that covers it and seeks there. */
  function jumpTo(iso: string) {
    const t = Date.parse(iso)
    const covering = (list: RecordingRow[]) =>
      list.find((r) => Date.parse(r.startedAt) <= t && t <= Date.parse(r.lastChunkAt) + 10_000) ??
      [...list].reverse().find((r) => Date.parse(r.startedAt) <= t)
    const s = covering(screens)
    const c = covering(cameras)
    // Start a few seconds early to see what led up to it.
    const at = (r: RecordingRow) => Math.max(0, (t - Date.parse(r.startedAt)) / 1000 - 5)
    if (s) seek('screen', s, at(s))
    if (c) seek('camera', c, at(c))
  }

  function seek(which: 'screen' | 'camera', rec: RecordingRow, seconds: number) {
    const video = which === 'screen' ? screenVideo.current : cameraVideo.current
    const current = which === 'screen' ? screenId : cameraId
    if (current !== rec.id) {
      pendingSeek.current[which] = seconds
      if (which === 'screen') setScreenId(rec.id)
      else setCameraId(rec.id)
    } else if (video) {
      video.currentTime = seconds
      video.play().catch(() => {})
    }
  }

  return (
    <div className="stack">
      <div className="spread">
        <div>
          <h2 style={{ margin: 0 }}>{data.candidateName} · {data.examTitle}</h2>
          <div className="faint">
            {data.candidateEmail} · started {formatDate(data.startedAt, true)} · submitted {formatDate(data.submittedAt, true)} ·
            score {data.scorePercent ?? '—'}% (pass {data.passPercent}%) · left the tab {data.tabSwitches}×
          </div>
        </div>
        <div className="row">
          <StatusBadge status={data.reviewStatus} />
          <Link className="btn secondary small" to="/admin/reviews">Back to reviews</Link>
        </div>
      </div>

      {!data.proctoringStartedAt && <Alert kind="error">The candidate never completed the security check, so nothing was recorded.</Alert>}
      {deletedAll && <Alert kind="warn">The recordings were deleted after the retention period. The events below are kept.</Alert>}

      <div className="review-layout">
        <div className="stack">
          <div className="review-videos">
            <div className="stack">
              <strong>Screen</strong>
              {screenId != null ? (
                <RecordingVideo
                  key={screenId}
                  ref={screenVideo}
                  id={screenId}
                  seekTo={() => {
                    const s = pendingSeek.current.screen
                    pendingSeek.current.screen = undefined
                    return s
                  }}
                />
              ) : <p className="muted">No screen recording.</p>}
              <SegmentPicker list={screens} value={screenId} onChange={setScreenId} clock={clock} />
            </div>
            <div className="stack">
              <strong>Camera and microphone</strong>
              {cameraId != null ? (
                <RecordingVideo
                  key={cameraId}
                  ref={cameraVideo}
                  id={cameraId}
                  seekTo={() => {
                    const s = pendingSeek.current.camera
                    pendingSeek.current.camera = undefined
                    return s
                  }}
                />
              ) : <p className="muted">No camera recording.</p>}
              <SegmentPicker list={cameras} value={cameraId} onChange={setCameraId} clock={clock} />
            </div>
          </div>
          <p className="faint" style={{ margin: 0 }}>
            Each reload of the exam page starts a new part. Click an event to see both recordings from just before it.
          </p>

          {data.reviewStatus === 'PENDING' ? (
            <div className="card stack">
              <h3 style={{ margin: 0 }}>Decision</h3>
              <label className="field">
                <span>Note (required to reject: it is emailed to the candidate as the reason)</span>
                <textarea rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. A second person is visible on camera from 24:10 and dictates answers." />
              </label>
              {decide.isError && <Alert kind="error">{decide.error.message}</Alert>}
              <div className="row">
                <button className="btn" disabled={decide.isPending} onClick={() => decide.mutate('APPROVE')}>
                  Approve and issue the certificate
                </button>
                <button className="btn secondary" style={{ color: 'var(--danger)' }}
                  disabled={decide.isPending || !note.trim()} onClick={() => {
                    if (confirm('Reject this session? No certificate is issued and the candidate is emailed your note.')) decide.mutate('REJECT')
                  }}>
                  Reject
                </button>
              </div>
            </div>
          ) : data.reviewStatus && (
            <div className="card stack">
              <div><StatusBadge status={data.reviewStatus} /> by {data.reviewedBy} on {formatDate(data.reviewedAt, true)}</div>
              {data.reviewNote && <p className="muted" style={{ margin: 0 }}>{data.reviewNote}</p>}
            </div>
          )}
        </div>

        <aside className="card tight stack">
          <div className="spread">
            <strong>What the browser noticed</strong>
            <label className="check" style={{ margin: 0 }}>
              <input type="checkbox" checked={onlyFlags} onChange={(e) => setOnlyFlags(e.target.checked)} />
              <span>Flags only</span>
            </label>
          </div>
          {events.length === 0 ? <p className="muted">Nothing.</p> : (
            <ul className="event-list">
              {events.map((e, i) => (
                <li key={i}>
                  <button className={e.flag ? 'flag' : ''} onClick={() => jumpTo(e.occurredAt)}>
                    <span className="faint">{clock(e.occurredAt)}</span>
                    <span>
                      {EVENT_LABELS[e.type] ?? e.type}
                      {e.detail && <div className="detail">{e.detail}</div>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  )
}

function SegmentPicker({ list, value, onChange, clock }: {
  list: RecordingRow[]; value: number | null; onChange: (id: number) => void; clock: (iso: string) => string
}) {
  if (list.length < 2) return null
  return (
    <select value={value ?? ''} onChange={(e) => onChange(Number(e.target.value))} aria-label="Recording part">
      {list.map((r, i) => (
        <option key={r.id} value={r.id}>Part {i + 1}: {clock(r.startedAt)} – {clock(r.lastChunkAt)}</option>
      ))}
    </select>
  )
}

/**
 * A recording. Browsers record without a duration in the file, so the player can't seek until it has found the
 * end; jumping far ahead once makes it work that out.
 */
function RecordingVideo({ id, ref, seekTo }: { id: number; ref: React.Ref<HTMLVideoElement>; seekTo: () => number | undefined }) {
  const local = useRef<HTMLVideoElement | null>(null)
  const fixing = useRef(false)
  return (
    <video
      ref={(el) => {
        local.current = el
        if (typeof ref === 'function') ref(el)
        else if (ref) (ref as React.RefObject<HTMLVideoElement | null>).current = el
      }}
      src={`/api/admin/recordings/${id}`}
      controls
      preload="metadata"
      onLoadedMetadata={(e) => {
        const v = e.currentTarget
        if (v.duration === Infinity || Number.isNaN(v.duration)) {
          fixing.current = true
          v.currentTime = 1e101
        } else {
          const s = seekTo()
          if (s != null) {
            v.currentTime = s
            v.play().catch(() => {})
          }
        }
      }}
      onDurationChange={(e) => {
        const v = e.currentTarget
        if (fixing.current && v.duration !== Infinity && !Number.isNaN(v.duration)) {
          fixing.current = false
          const s = seekTo()
          v.currentTime = s ?? 0
          if (s != null) v.play().catch(() => {})
        }
      }}
    />
  )
}
