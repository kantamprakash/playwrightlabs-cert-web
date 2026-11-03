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
    const message = data?.message ?? (res.status >= 500 ? 'Something went wrong. Please try again.' : res.statusText)
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

export type ExamSummary = {
  id: number
  slug: string
  title: string
  description: string
  durationMinutes: number
  questionCount: number
  passPercent: number
  priceInr: number
}

export type ExamAccess = {
  entitlementId: number
  exam: ExamSummary
  grantedAt: string
  expiresAt: string
  state: 'AVAILABLE' | 'IN_PROGRESS' | 'COMPLETED' | 'EXPIRED'
  attemptId: number | null
  scorePercent: number | null
  passed: boolean | null
}

export type CertificateItem = { certNo: string; examTitle: string; scorePercent: number; issuedAt: string; revoked: boolean }

export type Dashboard = { exams: ExamAccess[]; certificates: CertificateItem[] }

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
}

export type Attempt = {
  id: number
  examTitle: string
  status: 'IN_PROGRESS' | 'COMPLETED'
  startedAt: string
  deadlineAt: string
  serverTime: string
  totalQuestions: number
  passPercent: number
  tabSwitches: number
  questions: AttemptQuestion[]
  result: AttemptResult | null
}

export type Verification = {
  certNo: string
  holderName: string
  examTitle: string
  issuedAt: string
  valid: boolean
  revokedAt: string | null
}
