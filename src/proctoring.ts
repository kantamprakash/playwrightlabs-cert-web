// Proctoring for certification exams. While the exam is open the browser records the candidate's entire screen
// and their camera (with microphone), uploads both in 10-second chunks, and reports what it notices: leaving the
// tab or window, leaving full screen, pasting text copied outside the exam, a second display, the screen share or
// camera stopping. An admin reviews all of it before a certificate is issued.
//
// One Proctor lives for the whole page (a module singleton), so the streams the candidate allows on the start page
// survive the navigation to the exam page. A reload loses them, so the exam page runs the security check again.

import { ApiError } from './api'

export type StreamKind = 'SCREEN' | 'CAMERA'

export type ProctorEventType =
  | 'PAGE_LEFT'
  | 'TAB_HIDDEN'
  | 'WINDOW_BLUR'
  | 'FULLSCREEN_EXIT'
  | 'PASTE_BLOCKED'
  | 'DROP_BLOCKED'
  | 'DEVTOOLS_SHORTCUT'
  | 'MULTIPLE_DISPLAYS'
  | 'SCREEN_SHARE_STOPPED'
  | 'CAMERA_STOPPED'
  | 'RECORDING_ERROR'

/** What stops the exam until the candidate fixes it. */
export type Blocker = 'FULLSCREEN' | 'SCREEN' | 'CAMERA' | 'DISPLAYS'

export type ProctorState = {
  camera: MediaStream | null
  screen: MediaStream | null
  /** Recording and monitoring for this attempt. */
  attemptId: number | null
  blockers: Blocker[]
  /** A short notice for the candidate, e.g. after a blocked paste. */
  notice: string | null
}

const CHUNK_MS = 10_000

/** Whether this browser can be proctored at all: desktop, with screen sharing and video recording. */
export function proctoringSupport(): string | null {
  if (!navigator.mediaDevices?.getDisplayMedia || !navigator.mediaDevices?.getUserMedia) {
    return 'This browser can’t share your screen. Use the latest Chrome, Edge or Firefox on a laptop or desktop computer.'
  }
  if (typeof MediaRecorder === 'undefined' || !pickMime(true)) {
    return 'This browser can’t record video. Use the latest Chrome, Edge or Firefox.'
  }
  return null
}

function pickMime(withAudio: boolean): string | null {
  const candidates = withAudio
    ? ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
    : ['video/webm;codecs=vp8', 'video/webm', 'video/mp4']
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? null
}

/** True or false where the browser can tell (Chromium), null where it can't. */
export function hasMultipleDisplays(): boolean | null {
  const extended = (window.screen as Screen & { isExtended?: boolean }).isExtended
  return typeof extended === 'boolean' ? extended : null
}

type Upload = { stream: StreamKind; segment: number; index: number; mime: string; blob: Blob }

class Proctor {
  state: ProctorState = { camera: null, screen: null, attemptId: null, blockers: [], notice: null }
  private listeners = new Set<() => void>()
  private clockOffset = 0
  private recorders: Partial<Record<StreamKind, MediaRecorder>> = {}
  private uploads: Upload[] = []
  private uploading = false
  private events: { type: ProctorEventType; detail?: string; at: string }[] = []
  private eventTimer: number | null = null
  private internalCopies: string[] = []
  private noticeTimer: number | null = null
  private cleanup: (() => void)[] = []
  private stopped = false

  subscribe(fn: () => void) {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }

  private set(patch: Partial<ProctorState>) {
    this.state = { ...this.state, ...patch }
    this.listeners.forEach((fn) => fn())
  }

  // ---- The security check -----------------------------------------------------------------------------------

  async requestCamera() {
    this.state.camera?.getTracks().forEach((t) => t.stop())
    const camera = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 15, max: 15 } },
      audio: { echoCancellation: true, noiseSuppression: true },
    })
    camera.getTracks().forEach((t) => (t.onended = () => this.lost('CAMERA')))
    this.set({ camera, blockers: this.state.blockers.filter((b) => b !== 'CAMERA') })
    if (this.state.attemptId != null) this.record('CAMERA')
  }

  /** Throws with a message for the candidate when they share a window or tab instead of the entire screen. */
  async requestScreen() {
    this.state.screen?.getTracks().forEach((t) => t.stop())
    const screen = await navigator.mediaDevices.getDisplayMedia({
      video: { displaySurface: 'monitor', frameRate: { ideal: 5, max: 10 }, width: { max: 1920 }, height: { max: 1080 } },
      audio: false,
      // Chromium: offer the entire screen first and hide the "switch to this tab" button.
      ...({ monitorTypeSurfaces: 'include', surfaceSwitching: 'exclude', selfBrowserSurface: 'exclude' } as object),
    } as DisplayMediaStreamOptions)
    const surface = (screen.getVideoTracks()[0]?.getSettings() as MediaTrackSettings & { displaySurface?: string }).displaySurface
    if (surface && surface !== 'monitor') {
      screen.getTracks().forEach((t) => t.stop())
      throw new Error('Share your entire screen, not a window or a tab.')
    }
    screen.getVideoTracks()[0].onended = () => this.lost('SCREEN')
    this.set({ screen, blockers: this.state.blockers.filter((b) => b !== 'SCREEN') })
    if (this.state.attemptId != null) this.record('SCREEN')
  }

  /** Must be called from a click: browsers only allow full screen from a user gesture. */
  async enterFullscreen() {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen()
    this.set({ blockers: this.state.blockers.filter((b) => b !== 'FULLSCREEN') })
  }

  /** Turns the camera and screen share off again when the candidate leaves without starting. */
  release() {
    if (this.state.attemptId != null) return
    this.state.camera?.getTracks().forEach((t) => t.stop())
    this.state.screen?.getTracks().forEach((t) => t.stop())
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    this.set({ camera: null, screen: null, blockers: [] })
  }

  ready() {
    return isLive(this.state.camera) && isLive(this.state.screen)
  }

  // ---- During the exam --------------------------------------------------------------------------------------

  /** Starts recording and monitoring for the attempt, once its security check passed on this page load. */
  async begin(attemptId: number, clockOffset: number) {
    if (this.state.attemptId === attemptId) return
    this.stopped = false
    this.clockOffset = clockOffset
    this.set({ attemptId })
    const res = await fetch(`/api/attempts/${attemptId}/proctoring/session`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ detail: describeSession(this.state.screen) }),
    }).catch(() => null)
    if (!res?.ok) {
      this.set({ attemptId: null })
      throw new ApiError(res?.status ?? 0, 'SESSION_FAILED', 'Could not start the exam session. Please try again.')
    }
    this.record('SCREEN')
    this.record('CAMERA')
    this.watch()
  }

  /** Stops recording and uploads what is left (waiting at most a few seconds). Call before submitting. */
  async finish() {
    if (this.stopped) return
    this.stopped = true
    this.cleanup.forEach((fn) => fn())
    this.cleanup = []
    const stopping = Object.values(this.recorders).map(
      (r) =>
        new Promise<void>((resolve) => {
          if (!r || r.state === 'inactive') return resolve()
          r.addEventListener('stop', () => resolve(), { once: true })
          r.stop()
        }),
    )
    await Promise.race([Promise.all(stopping), wait(3000)])
    await this.flushEvents()
    const deadline = Date.now() + 15_000
    while ((this.uploads.length || this.uploading) && Date.now() < deadline) await wait(250)
    this.state.camera?.getTracks().forEach((t) => t.stop())
    this.state.screen?.getTracks().forEach((t) => t.stop())
    this.recorders = {}
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    this.set({ camera: null, screen: null, attemptId: null, blockers: [], notice: null })
  }

  report(type: ProctorEventType, detail?: string) {
    if (this.state.attemptId == null || this.stopped) return
    this.events.push({ type, detail, at: new Date(Date.now() + this.clockOffset).toISOString() })
    if (this.eventTimer == null) this.eventTimer = window.setTimeout(() => this.flushEvents(), 1500)
  }

  private async flushEvents() {
    if (this.eventTimer != null) clearTimeout(this.eventTimer)
    this.eventTimer = null
    const id = this.state.attemptId
    if (id == null || !this.events.length) return
    const batch = this.events.splice(0, 200)
    try {
      const res = await fetch(`/api/attempts/${id}/proctoring/events`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: batch }),
      })
      if (!res.ok && res.status >= 500) throw new Error()
    } catch {
      this.events.unshift(...batch)
      this.eventTimer = window.setTimeout(() => this.flushEvents(), 5000)
    }
  }

  private notify(notice: string) {
    if (this.noticeTimer != null) clearTimeout(this.noticeTimer)
    this.set({ notice })
    this.noticeTimer = window.setTimeout(() => this.set({ notice: null }), 6000)
  }

  private block(b: Blocker) {
    if (!this.state.blockers.includes(b)) this.set({ blockers: [...this.state.blockers, b] })
  }

  private lost(stream: StreamKind) {
    if (this.stopped) return
    this.report(stream === 'SCREEN' ? 'SCREEN_SHARE_STOPPED' : 'CAMERA_STOPPED')
    this.block(stream)
  }

  private record(stream: StreamKind) {
    const media = stream === 'SCREEN' ? this.state.screen : this.state.camera
    if (!media || this.stopped) return
    const old = this.recorders[stream]
    if (old && old.state !== 'inactive') old.stop()
    const mime = pickMime(stream === 'CAMERA')!
    const recorder = new MediaRecorder(media, {
      mimeType: mime,
      videoBitsPerSecond: stream === 'SCREEN' ? 300_000 : 150_000,
      audioBitsPerSecond: 32_000,
    })
    // A new segment for every recorder: each one's chunks join up into a playable file. Its number is when it
    // started, on the server's clock, so the review can line the video up with the events.
    const segment = Math.round(Date.now() + this.clockOffset)
    let index = 0
    recorder.ondataavailable = (e) => {
      if (e.data.size) this.queue({ stream, segment, index: index++, mime: recorder.mimeType || mime, blob: e.data })
    }
    recorder.start(CHUNK_MS)
    this.recorders[stream] = recorder
  }

  private queue(upload: Upload) {
    this.uploads.push(upload)
    if (!this.uploading) this.drain()
  }

  private async drain() {
    this.uploading = true
    let failures = 0
    while (this.uploads.length && this.state.attemptId != null) {
      const u = this.uploads[0]
      try {
        const res = await fetch(
          `/api/attempts/${this.state.attemptId}/proctoring/recordings/${u.stream}/${u.segment}/${u.index}?type=${encodeURIComponent(u.mime)}`,
          { method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/octet-stream' }, body: u.blob },
        )
        if (res.ok) {
          this.uploads.shift()
          failures = 0
          continue
        }
        const code = (await res.json().catch(() => null))?.code
        if (code === 'ATTEMPT_CLOSED' || code === 'RECORDING_FULL' || res.status === 400 || res.status === 404) {
          // Nothing more will be accepted for this attempt.
          if (code === 'RECORDING_FULL') this.report('RECORDING_ERROR', 'Recording size limit reached')
          this.uploads = []
          break
        }
        throw new Error('HTTP ' + res.status)
      } catch (err) {
        failures++
        if (failures === 3) this.report('RECORDING_ERROR', `Upload failing: ${(err as Error).message}`)
        await wait(Math.min(30_000, 1000 * 2 ** failures))
      }
    }
    this.uploading = false
  }

  /** Everything the page watches while the exam is open. */
  private watch() {
    const on = <K extends keyof WindowEventMap>(target: Window | Document, type: K | string, fn: (e: never) => void, capture = true) => {
      target.addEventListener(type, fn as EventListener, capture)
      this.cleanup.push(() => target.removeEventListener(type, fn as EventListener, capture))
    }

    on(document, 'visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.report('TAB_HIDDEN')
    })
    on(window, 'blur', () => {
      // Clicking into the embedded practice app moves focus to its frame; that's allowed.
      if (document.visibilityState === 'visible' && document.activeElement?.tagName !== 'IFRAME') {
        setTimeout(() => {
          if (document.activeElement?.tagName !== 'IFRAME' && !document.hasFocus()) this.report('WINDOW_BLUR')
        }, 0)
      }
    })
    on(document, 'fullscreenchange', () => {
      if (!document.fullscreenElement && !this.stopped) {
        this.report('FULLSCREEN_EXIT')
        this.block('FULLSCREEN')
      }
    })
    const checkDisplays = () => {
      if (hasMultipleDisplays()) {
        this.report('MULTIPLE_DISPLAYS')
        this.block('DISPLAYS')
      } else {
        this.set({ blockers: this.state.blockers.filter((b) => b !== 'DISPLAYS') })
      }
    }
    on(window.screen as unknown as Window, 'change', checkDisplays)
    checkDisplays()

    this.guardClipboard(document)
    on(window, 'pagehide', () => {
      // The page is closing or reloading: send what's left without waiting.
      const id = this.state.attemptId
      if (id == null) return
      this.events.push({ type: 'PAGE_LEFT', at: new Date(Date.now() + this.clockOffset).toISOString() })
      navigator.sendBeacon(
        `/api/attempts/${id}/proctoring/events`,
        new Blob([JSON.stringify({ events: this.events.splice(0, 200) })], { type: 'application/json' }),
      )
    })
    on(window, 'keydown', (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      const mod = e.ctrlKey || e.metaKey
      const devtools =
        key === 'f12' ||
        (mod && e.shiftKey && ['i', 'j', 'c'].includes(key)) ||
        (e.metaKey && e.altKey && ['i', 'j', 'c', 'u'].includes(key)) ||
        (mod && key === 'u')
      if (devtools) {
        e.preventDefault()
        this.report('DEVTOOLS_SHORTCUT', [e.ctrlKey && 'Ctrl', e.metaKey && 'Cmd', e.altKey && 'Alt', e.shiftKey && 'Shift', e.key].filter(Boolean).join('+'))
        this.notify('Developer tools are not allowed during the exam.')
      }
    })
  }

  /**
   * Copying inside the exam is fine; pasting text that wasn't copied inside it is blocked and reported. Also used
   * for the embedded practice app, so candidates can copy its text into their tests.
   */
  guardClipboard(doc: Document) {
    const remember = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData('text/plain') || doc.getSelection()?.toString() || ''
      if (text) this.internalCopies = [normalize(text), ...this.internalCopies].slice(0, 50)
    }
    // Bubbling, so the editor has already put its selection on the clipboard.
    const copy = (e: Event) => remember(e as ClipboardEvent)
    const paste = (e: Event) => {
      const text = (e as ClipboardEvent).clipboardData?.getData('text/plain') ?? ''
      if (!text || this.internalCopies.includes(normalize(text))) return
      e.preventDefault()
      e.stopImmediatePropagation()
      this.report('PASTE_BLOCKED', `${text.length} characters: ${text.slice(0, 120)}`)
      this.notify('Pasting from outside the exam is blocked, and the attempt has been recorded.')
    }
    const dragstart = (e: Event) => {
      const text = doc.getSelection()?.toString()
      if (text) this.internalCopies = [normalize(text), ...this.internalCopies].slice(0, 50)
      void e
    }
    const drop = (e: Event) => {
      const dt = (e as DragEvent).dataTransfer
      const text = dt?.getData('text/plain') ?? ''
      if (dt?.files.length || (text && !this.internalCopies.includes(normalize(text)))) {
        e.preventDefault()
        e.stopImmediatePropagation()
        this.report('DROP_BLOCKED', dt?.files.length ? `${dt.files.length} file(s)` : `${text.length} characters`)
        this.notify('Dropping text or files from outside the exam is blocked.')
      }
    }
    doc.addEventListener('copy', copy)
    doc.addEventListener('cut', copy)
    doc.addEventListener('paste', paste, true)
    doc.addEventListener('dragstart', dragstart, true)
    doc.addEventListener('drop', drop, true)
    this.cleanup.push(() => {
      doc.removeEventListener('copy', copy)
      doc.removeEventListener('cut', copy)
      doc.removeEventListener('paste', paste, true)
      doc.removeEventListener('dragstart', dragstart, true)
      doc.removeEventListener('drop', drop, true)
    })
  }
}

function isLive(stream: MediaStream | null) {
  return !!stream && stream.getTracks().length > 0 && stream.getTracks().every((t) => t.readyState === 'live')
}

function normalize(text: string) {
  return text.replace(/\r\n/g, '\n').trim()
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function describeSession(screen: MediaStream | null) {
  const s = screen?.getVideoTracks()[0]?.getSettings()
  const displays = hasMultipleDisplays()
  const ua = navigator.userAgent
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Other browser'
  return [
    browser,
    s?.width && s?.height ? `screen ${s.width}×${s.height}` : null,
    displays == null ? 'display count unknown' : displays ? 'more than one display' : 'one display',
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  ]
    .filter(Boolean)
    .join(', ')
    .slice(0, 500)
}

export const proctor = new Proctor()
