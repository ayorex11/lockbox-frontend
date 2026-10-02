/**
 * Typed client for the Lockbox API (see lockbox-contract.md).
 * - Access token lives in memory only; the refresh token is an HttpOnly cookie.
 * - A 401 on an authenticated call triggers one shared refresh, then a single retry.
 */

const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

// ---------------------------------------------------------------------------- types
export type LinkMode = 'timed' | 'one_time'
export type LinkStatus = 'active' | 'used' | 'expired' | 'revoked'
export type TtlChoice = '1h' | '24h' | '7d'
export type AuditEventType =
  | 'link_created' | 'opened' | 'password_failed' | 'locked_out' | 'claimed' | 'revoked' | 'expired_cleanup'

export interface AuthUser { email: string; is_staff: boolean }

export interface ShareLink {
  id: string
  url: string
  status: LinkStatus
  mode: LinkMode
  file_name: string
  file_size: number
  created_at: string
  expires_at: string
  max_downloads: number | null
  download_count: number
  requires_password: boolean
  show_sender_email: boolean
  consumed_at: string | null
  last_claimed_at: string | null
  revoked_at: string | null
}

export interface LinkStats {
  total: number; active: number; used: number; expired: number; revoked: number; total_claims: number
}

export interface Page<T> { count: number; next: string | null; previous: string | null; results: T[] }
export interface LinkPage extends Page<ShareLink> { stats: LinkStats }

export interface AuditEvent {
  id: number
  event_type: AuditEventType
  ip_truncated: string
  user_agent: string
  created_at: string
}

// ---- admin dashboard (staff only; mirrors backend insights/queries.py) ----
export type Rate = number | null // 0..1, or null when there is nothing to divide by

export interface AdminOverview {
  generated_at: string
  users: {
    total: number; verified: number; new_7d: number; new_30d: number
    senders_ever: number; active_senders_7d: number; active_senders_30d: number
  }
  links: {
    total: number; active: number; used: number; expired: number; revoked: number
    one_time: number; timed: number; password_protected: number; created_7d: number; created_30d: number
  }
  engagement: { claims: number; opens: number; opens_incl_bots: number; password_failed: number; locked_out: number }
  funnels: {
    users: { signed_up: number; verified: number; created_a_link: number; verify_rate: Rate; link_rate: Rate }
    links: {
      created: number; opened: number; claimed: number; open_rate: Rate; claim_rate: Rate
      never_opened: number; expired_never_opened: number
    }
    uploads: { files_started: number; files_never_linked: number; link_rate: Rate }
  }
  storage: { files_in_storage: number; bytes_in_storage: number; bytes_shared_all_time: number }
}

export interface DailyPoint { date: string; signups: number; links_created: number; opens: number; claims: number }
export interface AdminTimeseries { days: number; series: DailyPoint[] }

export type TopMetric = 'links' | 'claims' | 'bytes'
export interface TopUser {
  email: string; links: number; claims: number; bytes_shared: number
  last_link_at: string | null; joined_at: string
}
export interface AdminTopUsers { metric: TopMetric; results: TopUser[] }

export interface SecurityCounts { password_failed: number; locked_out: number }
export interface SecurityPoint extends SecurityCounts { date: string }
export interface AdminSecurity {
  windows: Record<'24h' | '7d' | '30d', SecurityCounts>
  links_with_failures_7d: number
  series: SecurityPoint[]
}

export interface UploadInit {
  file_id: string
  upload_url: string
  method: 'PUT'
  headers: Record<string, string>
  expires_in: number
}

export interface CreateLinkPayload {
  file_id: string
  mode: LinkMode
  ttl: TtlChoice
  max_downloads?: number | null
  password?: string
  show_sender_email: boolean
}

export interface LinkMeta {
  available: true
  name: string
  size: number
  mode: LinkMode
  expires_at: string
  requires_password: boolean
  sender_email: string | null
}
export type GoneReason = 'expired' | 'unavailable'
export interface LinkGone { available: false; reason: GoneReason }

export type ClaimResult =
  | { ok: true; download_url: string; expires_in: number }
  | { ok: false; reason: GoneReason }

// ---------------------------------------------------------------------------- errors
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    /** Machine-readable code from the API (`detail`), e.g. "wrong_password", "locked". */
    public readonly code: string,
    public readonly data: Record<string, unknown> = {},
  ) {
    super(code)
    this.name = 'ApiError'
  }
  /** Field-level validation messages from DRF, flattened. */
  get fieldErrors(): Record<string, string[]> {
    const out: Record<string, string[]> = {}
    for (const [key, value] of Object.entries(this.data)) {
      if (Array.isArray(value)) out[key] = value.map(String)
      else if (typeof value === 'string' && key !== 'detail') out[key] = [value]
    }
    return out
  }
}

export class NetworkError extends Error {
  constructor() {
    super('network_error')
    this.name = 'NetworkError'
  }
}

// ------------------------------------------------------------------------ token state
let accessToken: string | null = null
let onSessionLost: (() => void) | null = null
let refreshInFlight: Promise<string | null> | null = null

export function setAccessToken(token: string | null) { accessToken = token }
export function getAccessToken() { return accessToken }
export function setSessionLostHandler(handler: (() => void) | null) { onSessionLost = handler }

// --------------------------------------------------------------------------- transport
interface RequestOptions {
  method?: 'GET' | 'POST'
  body?: unknown
  /** Attach the bearer token and auto-refresh on 401. */
  auth?: boolean
  /** Send/receive the refresh cookie (auth endpoints only). */
  cookies?: boolean
  signal?: AbortSignal
}

async function send(path: string, opts: RequestOptions, token: string | null): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json'
  if (opts.auth && token) headers.Authorization = `Bearer ${token}`
  try {
    return await fetch(`${BASE}${path}`, {
      method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      credentials: opts.cookies ? 'include' : 'omit',
      signal: opts.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new NetworkError()
  }
}

async function readBody(response: Response): Promise<Record<string, unknown>> {
  if (response.status === 204) return {}
  try {
    const data: unknown = await response.json()
    return data && typeof data === 'object' ? (data as Record<string, unknown>) : { value: data }
  } catch {
    return {}
  }
}

function toApiError(response: Response, data: Record<string, unknown>): ApiError {
  const detail = typeof data.detail === 'string' ? data.detail : undefined
  return new ApiError(response.status, detail ?? `http_${response.status}`, data)
}

export async function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const response = await send('/api/auth/refresh', { method: 'POST', cookies: true }, null)
        if (!response.ok) return null
        const data = (await readBody(response)) as { access?: string }
        accessToken = data.access ?? null
        return accessToken
      } catch {
        return null
      } finally {
        refreshInFlight = null
      }
    })()
  }
  return refreshInFlight
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  let response = await send(path, opts, accessToken)
  if (response.status === 401 && opts.auth) {
    const fresh = await refreshAccessToken()
    if (fresh) {
      response = await send(path, opts, fresh)
    } else {
      accessToken = null
      onSessionLost?.()
    }
  }
  const data = await readBody(response)
  if (!response.ok) throw toApiError(response, data)
  return data as T
}

// ------------------------------------------------------------------------------- auth
export const authApi = {
  register: (email: string, password: string) =>
    request<{ detail: string }>('/api/auth/register', { body: { email, password } }),
  verifyEmail: (token: string) => request<{ detail: string }>('/api/auth/verify-email', { body: { token } }),
  resendVerification: (email: string) =>
    request<{ detail: string }>('/api/auth/resend-verification', { body: { email } }),
  login: (email: string, password: string) =>
    request<{ access: string; user: AuthUser }>('/api/auth/login', {
      body: { email, password }, cookies: true,
    }),
  logout: () => request<Record<string, never>>('/api/auth/logout', { method: 'POST', cookies: true }),
  me: () => request<{ email: string; is_email_verified: boolean; is_staff: boolean }>('/api/auth/me', { auth: true }),
}

// ------------------------------------------------------------------------------ sender
export const filesApi = {
  init: (name: string, size: number) =>
    request<UploadInit>('/api/files/', { body: { name, size }, auth: true }),
  complete: (fileId: string) =>
    request<{ file_id: string; status: string; size: number }>(`/api/files/${fileId}/complete/`, {
      method: 'POST', auth: true,
    }),
}

export const linksApi = {
  create: (payload: CreateLinkPayload) => request<ShareLink>('/api/links/', { body: payload, auth: true }),
  list: (params: { status?: LinkStatus | 'all'; page?: number } = {}) => {
    const query = new URLSearchParams()
    if (params.status && params.status !== 'all') query.set('status', params.status)
    if (params.page && params.page > 1) query.set('page', String(params.page))
    const qs = query.toString()
    return request<LinkPage>(`/api/links/${qs ? `?${qs}` : ''}`, { auth: true })
  },
  get: (id: string) => request<ShareLink>(`/api/links/${id}/`, { auth: true }),
  events: (id: string, page = 1) =>
    request<Page<AuditEvent>>(`/api/links/${id}/events/${page > 1 ? `?page=${page}` : ''}`, { auth: true }),
  revoke: (id: string) => request<ShareLink>(`/api/links/${id}/revoke/`, { method: 'POST', auth: true }),
}

// ------------------------------------------------------------------------------- admin
/** Staff-only. Non-staff callers get ApiError 403 with code "staff_only". */
export const adminApi = {
  overview: () => request<AdminOverview>('/api/admin/overview/', { auth: true }),
  timeseries: (days = 30) => request<AdminTimeseries>(`/api/admin/timeseries/?days=${days}`, { auth: true }),
  topUsers: (metric: TopMetric = 'links', limit = 10) =>
    request<AdminTopUsers>(`/api/admin/top-users/?metric=${metric}&limit=${limit}`, { auth: true }),
  security: () => request<AdminSecurity>('/api/admin/security/', { auth: true }),
}

// ---------------------------------------------------------------------------- recipient
export const recipientApi = {
  /** 200 -> metadata. 410 -> {available:false, reason}. Never consumes anything. */
  async meta(token: string, signal?: AbortSignal): Promise<LinkMeta | LinkGone> {
    try {
      return await request<LinkMeta>(`/api/s/${token}/`, { signal })
    } catch (error) {
      if (error instanceof ApiError && error.status === 410) {
        return { available: false, reason: error.data.reason === 'expired' ? 'expired' : 'unavailable' }
      }
      throw error
    }
  },
  /** Throws ApiError for 401 (wrong_password | password_required) and 423 (locked, data.retry_after). */
  async claim(token: string, password?: string): Promise<ClaimResult> {
    try {
      const data = await request<{ download_url: string; expires_in: number }>(`/api/s/${token}/claim/`, {
        body: password ? { password } : {},
      })
      return { ok: true, ...data }
    } catch (error) {
      if (error instanceof ApiError && error.status === 410) {
        return { ok: false, reason: error.data.reason === 'expired' ? 'expired' : 'unavailable' }
      }
      throw error
    }
  },
}
