import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { adminApi, ApiError, setAccessToken, setSessionLostHandler } from '@/lib/api'

const json = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

let fetchMock: ReturnType<typeof vi.fn>
beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  setAccessToken('tok')
  setSessionLostHandler(null)
})
afterEach(() => vi.unstubAllGlobals())

const url = (i = 0) => String(fetchMock.mock.calls[i]![0])
const bearer = (i = 0) => ((fetchMock.mock.calls[i]![1] as RequestInit).headers as Record<string, string>).Authorization

describe('adminApi', () => {
  it('calls each endpoint with the bearer token', async () => {
    fetchMock.mockImplementation(async () => json(200, {}))
    await adminApi.overview()
    await adminApi.timeseries(7)
    await adminApi.topUsers('claims', 5)
    await adminApi.security()
    expect(url(0)).toContain('/api/admin/overview/')
    expect(url(1)).toContain('/api/admin/timeseries/?days=7')
    expect(url(2)).toContain('/api/admin/top-users/?metric=claims&limit=5')
    expect(url(3)).toContain('/api/admin/security/')
    for (let i = 0; i < 4; i++) expect(bearer(i)).toBe('Bearer tok')
  })

  it('uses sensible defaults', async () => {
    fetchMock.mockImplementation(async () => json(200, {}))
    await adminApi.timeseries()
    await adminApi.topUsers()
    expect(url(0)).toContain('days=30')
    expect(url(1)).toContain('metric=links&limit=10')
  })

  it('surfaces staff_only as a 403 ApiError (and does not log the user out)', async () => {
    const lost = vi.fn()
    setSessionLostHandler(lost)
    fetchMock.mockResolvedValue(json(403, { detail: 'staff_only' }))
    const error = await adminApi.overview().catch((e) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(403)
    expect(error.code).toBe('staff_only')
    expect(lost).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledTimes(1) // no refresh attempt for a 403
  })
})
