import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { Attempt } from '../api'
import { hasMultipleDisplays, proctor, proctoringSupport, type Blocker } from '../proctoring'
import { Alert } from './Field'

export function useProctor() {
  return useSyncExternalStore(
    (fn) => proctor.subscribe(fn),
    () => proctor.state,
  )
}

/** The exam rules shown before starting a proctored exam. */
export function ProctoringRules() {
  return (
    <ul className="clean muted">
      <li><strong>Your session is recorded.</strong> Your entire screen and your camera (with microphone) are recorded for the whole exam and reviewed by an examiner before your certificate is issued.</li>
      <li>Use a laptop or desktop with one display, a working camera and microphone, and the latest Chrome, Edge or Firefox. Disconnect extra monitors.</li>
      <li>Sit alone in a quiet, well-lit room, with your face visible to the camera. No phones, notes, other people or other devices.</li>
      <li>The exam runs in full screen. Don’t switch to other tabs, windows or apps: every time you do, it is recorded.</li>
      <li>Pasting text copied from outside the exam, dropping files, and developer tools are blocked and recorded.</li>
      <li>If the examiner finds the rules weren’t followed, no certificate is issued for the attempt.</li>
      <li>Recordings are kept for 90 days after the review and then deleted. See the <a href="/privacy" target="_blank" rel="noreferrer">privacy policy</a>.</li>
    </ul>
  )
}

type Step = 'idle' | 'working' | 'ok' | 'error'

/**
 * Camera, entire-screen share and the one-display check. Calls onReady(true) when everything is in place (and
 * onReady(false) if something is lost again). Full screen is entered by the caller's button, which needs a click.
 */
export function SecurityCheck({ onReady }: { onReady: (ready: boolean) => void }) {
  const state = useProctor()
  const unsupported = proctoringSupport()
  const [camera, setCamera] = useState<Step>(state.camera ? 'ok' : 'idle')
  const [screen, setScreen] = useState<Step>(state.screen ? 'ok' : 'idle')
  const [error, setError] = useState<string | null>(null)
  const [displays, setDisplays] = useState(() => hasMultipleDisplays())
  const preview = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const check = () => setDisplays(hasMultipleDisplays())
    // Chromium fires "change" on the screen when displays are added or removed; elsewhere the poll covers it.
    const screen = window.screen as unknown as EventTarget
    screen.addEventListener?.('change', check)
    const t = setInterval(check, 2000)
    return () => {
      screen.removeEventListener?.('change', check)
      clearInterval(t)
    }
  }, [])

  useEffect(() => {
    if (preview.current) preview.current.srcObject = state.camera
  }, [state.camera])

  const cameraOk = camera === 'ok' && !!state.camera
  const screenOk = screen === 'ok' && !!state.screen
  const ready = cameraOk && screenOk && displays !== true && !unsupported
  useEffect(() => onReady(ready), [ready, onReady])

  async function allowCamera() {
    setError(null)
    setCamera('working')
    try {
      await proctor.requestCamera()
      setCamera('ok')
    } catch {
      setCamera('error')
      setError('Allow the camera and microphone in your browser (the icon in the address bar), then try again.')
    }
  }

  async function shareScreen() {
    setError(null)
    setScreen('working')
    try {
      await proctor.requestScreen()
      setScreen('ok')
    } catch (e) {
      setScreen('error')
      setError(e instanceof Error && e.message.startsWith('Share') ? e.message : 'Choose “Entire screen” and allow sharing, then try again.')
    }
  }

  if (unsupported) return <Alert kind="error">{unsupported}</Alert>

  return (
    <div className="stack">
      <h2 style={{ margin: 0 }}>Security check</h2>
      <ol className="security-steps">
        <li className={cameraOk ? 'done' : ''}>
          <div>
            <strong>Camera and microphone</strong>
            <div className="faint">Your face must be clearly visible for the whole exam.</div>
          </div>
          {cameraOk ? <span className="badge green">On</span> : (
            <button className="btn secondary small" disabled={camera === 'working'} onClick={allowCamera}>Turn on camera</button>
          )}
        </li>
        <li className={screenOk ? 'done' : ''}>
          <div>
            <strong>Share your entire screen</strong>
            <div className="faint">Choose “Entire screen” (not a window or tab) when your browser asks.</div>
          </div>
          {screenOk ? <span className="badge green">Sharing</span> : (
            <button className="btn secondary small" disabled={screen === 'working'} onClick={shareScreen}>Share screen</button>
          )}
        </li>
        <li className={displays !== true ? 'done' : ''}>
          <div>
            <strong>One display</strong>
            <div className="faint">
              {displays === true ? 'More than one display is connected. Disconnect the others to continue.'
                : displays === false ? 'Only one display is connected.'
                  : 'Your browser can’t check this. Make sure only one display is connected; your screen recording is reviewed.'}
            </div>
          </div>
          <span className={`badge ${displays === true ? 'red' : 'green'}`}>{displays === true ? 'Disconnect' : 'OK'}</span>
        </li>
      </ol>
      {state.camera && <video ref={preview} className="camera-preview" autoPlay muted playsInline aria-label="Your camera" />}
      {error && <Alert kind="error">{error}</Alert>}
    </div>
  )
}

const BLOCKER_TEXT: Record<Blocker, { title: string; text: string; action: string }> = {
  FULLSCREEN: { title: 'Return to full screen', text: 'The exam must stay in full screen. Leaving it has been recorded.', action: 'Return to full screen' },
  SCREEN: { title: 'Screen sharing stopped', text: 'Share your entire screen again to continue. The gap is recorded.', action: 'Share entire screen' },
  CAMERA: { title: 'Camera stopped', text: 'Turn your camera back on to continue. The gap is recorded.', action: 'Turn on camera' },
  DISPLAYS: { title: 'Another display was connected', text: 'Disconnect the extra display to continue. This has been recorded.', action: '' },
}

/**
 * Wraps the exam while a proctored attempt is open: runs the security check after a reload, records and
 * monitors, shows the camera, and covers the exam whenever a rule needs fixing.
 */
export function ProctorGate({ attempt, children }: { attempt: Attempt; children: ReactNode }) {
  const state = useProctor()
  const [checked, setChecked] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [blockerError, setBlockerError] = useState<string | null>(null)
  const self = useRef<HTMLVideoElement>(null)
  const offset = useRef(Date.parse(attempt.serverTime) - Date.now())
  const active = state.attemptId === attempt.id

  // Arrived from the start page with everything already allowed: begin straight away.
  useEffect(() => {
    if (!active && proctor.ready() && document.fullscreenElement) {
      proctor.begin(attempt.id, offset.current).catch((e) => setError(e.message))
    }
  }, [active, attempt.id])

  useEffect(() => {
    if (self.current) self.current.srcObject = state.camera
  }, [state.camera, active])

  async function begin() {
    setError(null)
    setStarting(true)
    try {
      await proctor.enterFullscreen()
      await proctor.begin(attempt.id, offset.current)
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Allow full screen to continue.')
    } finally {
      setStarting(false)
    }
  }

  if (!active) {
    return (
      <main className="container page" style={{ maxWidth: 720 }}>
        <div className="card stack">
          <h1 style={{ margin: 0 }}>{attempt.examTitle}</h1>
          <Alert kind="warn">
            Your exam is still running. Complete the security check to continue. Reopening the exam is recorded.
          </Alert>
          <SecurityCheck onReady={setChecked} />
          {error && <Alert kind="error">{error}</Alert>}
          <button className="btn" disabled={!checked || starting} onClick={begin}>
            {starting ? 'Starting…' : 'Continue the exam in full screen'}
          </button>
        </div>
      </main>
    )
  }

  const blocker = state.blockers[0]
  async function fix() {
    setBlockerError(null)
    try {
      if (blocker === 'FULLSCREEN') await proctor.enterFullscreen()
      if (blocker === 'SCREEN') await proctor.requestScreen()
      if (blocker === 'CAMERA') await proctor.requestCamera()
    } catch (e) {
      setBlockerError(e instanceof Error && e.message.startsWith('Share') ? e.message : 'That didn’t work. Please try again.')
    }
  }

  return (
    <>
      {children}
      <div className="proctor-badge" aria-label="Recording">
        <video ref={self} autoPlay muted playsInline aria-hidden="true" />
        <span><span className="rec-dot" aria-hidden="true" /> Recording</span>
      </div>
      {state.notice && <div className="proctor-notice" role="alert">{state.notice}</div>}
      {blocker && (
        <div className="modal-backdrop proctor-block" role="alertdialog" aria-modal="true" aria-labelledby="proctor-block-title">
          <div className="card modal stack">
            <h2 id="proctor-block-title">{BLOCKER_TEXT[blocker].title}</h2>
            <p className="muted">{BLOCKER_TEXT[blocker].text} Your exam timer keeps running.</p>
            {blockerError && <Alert kind="error">{blockerError}</Alert>}
            {BLOCKER_TEXT[blocker].action && <button className="btn" onClick={fix}>{BLOCKER_TEXT[blocker].action}</button>}
          </div>
        </div>
      )}
    </>
  )
}
