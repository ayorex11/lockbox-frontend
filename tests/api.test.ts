import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ApiError, authApi, linksApi, NetworkError, recipientApi, setAccessToken, setSessionLostHandler,
} from '@/lib/api'

const json = (status: number, body: unknown = {}) =>
  new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  setAccessToken(null)
  setSessionLostHandler(null)
})
afterEach(() => vi.unstubAllGlobals())

const authHeader = (call: unknown[]) => ((call[1] as RequestInit).headers as Record<string, string>).Authorization

describe('api client', () => {
  it('sends the bearer token on authenticated calls only', async () => {
    setAccessToken('tok1')
    fetchMock.mockResolvedValue(json(200, { count: 0, results: [], stats: {} }))
    await linksApi.list()
    expect(authHeader(fetchMock.mock.calls[0]!)).toBe('Bearer tok1')

    fetchMock.mockResolvedValue(json(410, { available: false, reason: 'expired' }))
    await recipientApi.meta('abc')
    expect(authHeader(fetchMock.mock.calls[1]!)).toBeUndefined()
    expect((fetchMock.mock.calls[1]![1] as RequestInit).credentials).toBe('omit')
  })

  it('refreshes once on 401 and retries the original request', async () => {
    setAccessToken('old')
    fetchMock
      .mockResolvedValueOnce(json(401, { detail: 'token_not_valid' }))
      .mockResolvedValueOnce(json(200, { access: 'new' })) // refresh
      .mockResolvedValueOnce(json(200, { id: 'l1' }))
    const result = await linksApi.get('l1')
    expect(result).toEqual({ id: 'l1' })
    expect(fetchMock.mock.calls[1]![0]).toContain('/api/auth/refresh')
    expect((fetchMock.mock.calls[1]![1] as RequestInit).credentials).toBe('include')
    expect(authHeader(fetchMock.mock.calls[2]!)).toBe('Bearer new')
  })

  it('shares a single refresh between concurrent 401s', async () => {
    setAccessToken('old')
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      if (url.includes('/api/auth/refresh')) return json(200, { access: 'fresh' })
      const bearer = (init.headers as Record<string, string>).Authorization
      return bearer === 'Bearer fresh' ? json(200, { ok: true }) : json(401)
    })
    await Promise.all([linksApi.get('a'), linksApi.get('b'), linksApi.get('c')])
    const refreshes = fetchMock.mock.calls.filter((c) => String(c[0]).includes('/refresh'))
    expect(refreshes).toHaveLength(1)
  })

  it('reports a lost session when refresh fails', async () => {
    const lost = vi.fn()
    setSessionLostHandler(lost)
    setAccessToken('old')
    fetchMock.mockResolvedValueOnce(json(401)).mockResolvedValueOnce(json(401, { detail: 'invalid_refresh_token' }))
    await expect(linksApi.list()).rejects.toMatchObject({ status: 401 })
    expect(lost).toHaveBeenCalledOnce()
  })

  it('maps API errors, including DRF field errors and machine codes', async () => {
    fetchMock.mockResolvedValue(json(400, { email: ['Enter a valid email address.'], detail: undefined }))
    const error = await authApi.register('nope').catch((e) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(400)
    expect(error.fieldErrors).toEqual({ email: ['Enter a valid email address.'] })

    fetchMock.mockResolvedValue(json(423, { detail: 'locked', retry_after: 88 }))
    const locked = await authApi.login('a@b.co', 'x').catch((e) => e)
    expect([locked.status, locked.code, locked.data.retry_after]).toEqual([423, 'locked', 88])
  })

  it('throws NetworkError when fetch itself fails', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(authApi.login('a@b.co', 'x')).rejects.toBeInstanceOf(NetworkError)
  })

  it('recipient.meta maps 410 to a reason without throwing', async () => {
    fetchMock.mockResolvedValue(json(410, { available: false, reason: 'expired' }))
    expect(await recipientApi.meta('t')).toEqual({ available: false, reason: 'expired' })
    fetchMock.mockResolvedValue(json(410, { available: false, reason: 'unavailable' }))
    expect(await recipientApi.meta('t')).toEqual({ available: false, reason: 'unavailable' })
  })

  it('recipient.claim returns the URL, maps 410, and throws for 401/423', async () => {
    fetchMock.mockResolvedValue(json(200, { download_url: 'https://b2/x', expires_in: 60 }))
    expect(await recipientApi.claim('t', 'pw')).toEqual({ ok: true, download_url: 'https://b2/x', expires_in: 60 })
    expect(JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string)).toEqual({ password: 'pw' })

    fetchMock.mockResolvedValue(json(410, { available: false, reason: 'unavailable' }))
    expect(await recipientApi.claim('t')).toEqual({ ok: false, reason: 'unavailable' })

    fetchMock.mockResolvedValue(json(401, { detail: 'wrong_password', attempts_left: 3 }))
    await expect(recipientApi.claim('t', 'x')).rejects.toMatchObject({ status: 401, code: 'wrong_password' })
  })

  it('builds list query strings', async () => {
    fetchMock.mockResolvedValue(json(200, { count: 0, results: [], stats: {} }))
    await linksApi.list({ status: 'active', page: 2 })
    await linksApi.list({ status: 'all' })
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/links/?status=active&page=2')
    expect(fetchMock.mock.calls[1]![0]).toBe('/api/links/')
  })
})
