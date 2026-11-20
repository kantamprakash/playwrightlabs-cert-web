// Thin client for the Spring Boot API. The session lives in an httpOnly cookie on the same origin,
// so requests need no tokens; the browser sends the cookie automatically.

export class ApiError extends Error {
  status: number
  code: string
  fields: Record<string, string>

  constructor(status: number, code: string, message: string, fields?: Record<string, string> | null) {
    super(message)
    this.status = status
    this.code = code
    this.fields = fields ?? {}
  }
}

type Options = Omit<RequestInit, 'body'> & { json?: unknown; body?: BodyInit }

export async function api<T>(path: string, { json, headers, ...init }: Options = {}): Promise<T> {
  const res = await fetch(path, {
    credentials: 'same-origin',
    ...init,
    headers: json === undefined ? headers : { 'Content-Type': 'application/json', ...headers },
    body: json === undefined ? init.body : JSON.stringify(json),
  })
  if (res.status === 204) return undefined as T
  const text = await res.text()
  const data = text ? safeJson(text) : null
  if (!res.ok) {
    const message =
      data?.message ??
      (res.status === 429
        ? 'Too many attempts. Please wait a minute and try again.'
        : res.status >= 500
          ? 'Something went wrong. Please try again.'
          : res.statusText || 'Request failed.')
    throw new ApiError(res.status, data?.code ?? 'HTTP_' + res.status, message, data?.fields)
  }
  return data as T
}

function safeJson(text: string) {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export const post = <T>(path: string, json?: unknown) => api<T>(path, { method: 'POST', json: json ?? {} })
export const put = <T>(path: string, json: unknown) => api<T>(path, { method: 'PUT', json })

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong. Please try again.'
}

/** e.g. "Wed, 5 Nov 2026, 10:00 am IST", in the viewer's own time zone. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}

export function formatDate(iso: string | null | undefined, withTime = false): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
}

// ---- Types mirroring the API records ----

export type User = { id: number; email: string; fullName: string; role: 'CANDIDATE' | 'ADMIN' }

/** Prices include GST. retakePriceInr applies after a failed attempt. */
export type ExamSummary = {
  id: number
  slug: string
  title: string
  description: string
  kind: 'CERTIFICATION' | 'PRACTICE' | 'LAB'
  durationMinutes: number
  questionCount: number
  passPercent: number
  priceInr: number
  retakePriceInr: number
  retakeCooldownDays: number
}

/** The language a lab exam's tests are written in, chosen at checkout. */
export type LabLanguage = 'TYPESCRIPT' | 'JAVASCRIPT'

export const LAB_LANGUAGES: { value: LabLanguage; label: string; extension: string }[] = [
  { value: 'TYPESCRIPT', label: 'TypeScript', extension: 'ts' },
  { value: 'JAVASCRIPT', label: 'JavaScript', extension: 'js' },
]

export function labLanguage(value: LabLanguage) {
  return LAB_LANGUAGES.find((l) => l.value === value) ?? LAB_LANGUAGES[0]
}

/** e.g. "₹2,999" */
export function rupees(amount: number): string {
  return '₹' + amount.toLocaleString('en-IN')
}

/** A certification the candidate can buy now (availableFrom null) or later (a retake still in its wait). */
/** lockedReason: the candidate can't buy it yet, e.g. a prerequisite exam isn't passed. */
export type Offer = { exam: ExamSummary; retake: boolean; priceInr: number; availableFrom: string | null; lockedReason: string | null }

export type PracticeResult = {
  attemptId: number
  examTitle: string
  status: 'IN_PROGRESS' | 'COMPLETED'
  startedAt: string
  scorePercent: number | null
  passed: boolean | null
}

export type Quote = {
  examSlug: string
  examTitle: string
  retake: boolean
  listPriceInr: number
  discountInr: number
  totalInr: number
  couponCode: string | null
  onlinePaymentAvailable: boolean
}

export type CheckoutResult = {
  status: 'ENROLLED' | 'PAYMENT_REQUIRED'
  entitlementId: number | null
  payment: {
    keyId: string
    razorpayOrderId: string
    amountPaise: number
    currency: string
    description: string
    buyerName: string
    buyerEmail: string
    /** Payments are simulated (test mode): show the test payment step instead of Razorpay. */
    mock: boolean
  } | null
}

export type OrderView = {
  id: number
  examTitle: string
  retake: boolean
  amountPaise: number
  invoiceNo: string | null
  paidAt: string
}

export type ExamAccess = {
  entitlementId: number
  exam: ExamSummary
  grantedAt: string
  expiresAt: string
  scheduledAt: string | null
  startWindowEndsAt: string | null
  state: 'NOT_SCHEDULED' | 'SCHEDULED' | 'READY' | 'MISSED' | 'IN_PROGRESS' | 'GRADING' | 'COMPLETED' | 'EXPIRED'
  attemptId: number | null
  scorePercent: number | null
  passed: boolean | null
  /** Lab exams only: the language the tests are (or will be) written in. */
  labLanguage: LabLanguage | null
}

/** certified=false is a certificate of participation (issued below the pass mark). */
export type CertificateItem = {
  certNo: string
  examTitle: string
  scorePercent: number
  issuedAt: string
  certified: boolean
  revoked: boolean
}

export type Dashboard = {
  exams: ExamAccess[]
  offers: Offer[]
  practiceTests: ExamSummary[]
  practiceResults: PracticeResult[]
  certificates: CertificateItem[]
  serverTime: string
  minScheduleNoticeMinutes: number
}

export type AttemptQuestion = {
  id: number
  position: number
  type: 'SINGLE' | 'MULTI'
  topic: string | null
  text: string
  codeSnippet: string | null
  options: { id: number; text: string }[]
  selected: number[]
}

export type AttemptResult = {
  correctCount: number
  scorePercent: number
  passed: boolean
  autoSubmitted: boolean
  submittedAt: string
  certificateNo: string | null
  topics: { topic: string; correct: number; total: number }[]
  /** Practice tests only: every question with the right answer and explanation. */
  review: ReviewItem[] | null
}

export type ReviewItem = {
  position: number
  type: 'SINGLE' | 'MULTI'
  topic: string | null
  text: string
  codeSnippet: string | null
  options: { id: number; text: string; correct: boolean }[]
  selected: number[]
  correct: boolean
  explanation: string | null
}

export type LabTest = { title: string; status: string; error: string | null }

/** A "Run tests" result. passed/total/failed are null until status is DONE. */
export type LabRun = {
  id: number
  taskId: number | null
  status: 'QUEUED' | 'RUNNING' | 'DONE' | 'ERROR'
  createdAt: string
  passed: boolean | null
  total: number | null
  failed: number | null
  tests: LabTest[]
  errors: string[]
}

export type LabTask = { id: number; key: string; title: string; instructions: string; code: string; lastRun: LabRun | null }

export type LabTaskResult = {
  taskId: number
  title: string
  score: number
  gatePassed: boolean
  testsPassed: number
  testsTotal: number
  bugsCaught: number
  bugsTotal: number
  qualityPoints: number
  integrityIssue: string | null
  feedback: string[]
}

export type LabView = {
  practiceAppUrl: string
  language: LabLanguage
  practiceRunsLeft: number
  tasks: LabTask[]
  grading: boolean
  gradingProblem: string | null
  results: LabTaskResult[] | null
}

export type Attempt = {
  id: number
  examTitle: string
  examSlug: string
  kind: 'CERTIFICATION' | 'PRACTICE' | 'LAB'
  practice: boolean
  status: 'IN_PROGRESS' | 'GRADING' | 'COMPLETED'
  startedAt: string
  deadlineAt: string
  serverTime: string
  totalQuestions: number
  passPercent: number
  tabSwitches: number
  questions: AttemptQuestion[]
  result: AttemptResult | null
  lab: LabView | null
}

export type Verification = {
  certNo: string
  holderName: string
  examTitle: string
  issuedAt: string
  valid: boolean
  certified: boolean
  revokedAt: string | null
}
