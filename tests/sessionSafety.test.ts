import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { authApi, linksApi, NetworkError, refreshOutcome, setAccessToken, setSessionLostHandler } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { useKeyStore } from '@/stores/keys'

const json = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const inHours = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString()

let fetchMock: ReturnType<typeof vi.fn>
beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  localStorage.clear()
  setActivePinia(createPinia())
  setAccessToken(null)
  setSessionLostHandler(null)
})
afterEach(() => vi.unstubAllGlobals())

describe('a failed refresh only ends the session when the server says so', () => {
  const cases: [string, () => Promise<Response> | Error][] = [
    ['the network drops', () => new TypeError('Failed to fetch')],
    ['the throttle answers 429', () => Promise.resolve(json(429, { detail: 'throttled' }))],
    ['the server is waking up (503)', () => Promise.resolve(json(503))],
    ['the server errors (500)', () => Promise.resolve(json(500))],
  ]
  for (const [label, reply] of cases) {
    it(`keeps the session when ${label}`, async () => {
      const lost = vi.fn()
      setSessionLostHandler(lost)
      setAccessToken('expired')
      fetchMock.mockResolvedValueOnce(json(401))
      const next = reply()
      if (next instanceof Error) fetchMock.mockRejectedValueOnce(next)
      else fetchMock.mockResolvedValueOnce(await next)

      await expect(linksApi.list()).rejects.toBeInstanceOf(NetworkError)
      expect(lost).not.toHaveBeenCalled()
    })
  }

  it.each([401, 403])('ends the session when refresh is refused with %i', async (status) => {
    const lost = vi.fn()
    setSessionLostHandler(lost)
    setAccessToken('expired')
    fetchMock.mockResolvedValueOnce(json(401)).mockResolvedValueOnce(json(status, { detail: 'invalid_refresh_token' }))
    await expect(linksApi.list()).rejects.toMatchObject({ status: 401 })
    expect(lost).toHaveBeenCalledOnce()
  })

  it('recovers on the next call once the connection is back', async () => {
    setAccessToken('expired')
    fetchMock.mockResolvedValueOnce(json(401)).mockRejectedValueOnce(new TypeError('offline'))
    await expect(linksApi.list()).rejects.toBeInstanceOf(NetworkError)

    fetchMock
      .mockResolvedValueOnce(json(401))
      .mockResolvedValueOnce(json(200, { access: 'fresh' }))
      .mockResolvedValueOnce(json(200, { count: 0, results: [], stats: {} }))
    await expect(linksApi.list()).resolves.toMatchObject({ count: 0 })
  })

  it('reports the outcome kinds directly', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { access: 'a' }))
    expect(await refreshOutcome()).toEqual({ kind: 'ok', token: 'a' })
    fetchMock.mockResolvedValueOnce(json(401))
    expect(await refreshOutcome()).toEqual({ kind: 'rejected' })
    fetchMock.mockResolvedValueOnce(json(502))
    expect(await refreshOutcome()).toEqual({ kind: 'unavailable' })
  })
})

describe('stored link keys', () => {
  function withKeys() {
    const keys = useKeyStore()
    keys.save('link1', 'KEY1', inHours(2))
    return keys
  }

  it('survive a session that was lost, so links can still be copied', () => {
    const keys = withKeys()
    useAuthStore().clearSession(false)
    expect(keys.get('link1')).toBe('KEY1')
    setActivePinia(createPinia()) // page reload
    expect(useKeyStore().get('link1')).toBe('KEY1')
  })

  it('are wiped on an explicit log out', async () => {
    const keys = withKeys()
    fetchMock.mockResolvedValueOnce(json(200))
    await useAuthStore().logout()
    expect(keys.get('link1')).toBeNull()
    expect(localStorage.getItem('lockbox:keys')).toBeNull()
  })

  it('are wiped even if the logout request fails', async () => {
    const keys = withKeys()
    fetchMock.mockRejectedValueOnce(new TypeError('offline'))
    await useAuthStore().logout()
    expect(keys.get('link1')).toBeNull()
  })

  it('stay when the same person logs back in, but go when someone else does', async () => {
    const loginAs = async (email: string) => {
      fetchMock.mockResolvedValueOnce(json(200, { access: 'a', user: { email } }))
      await useAuthStore().login(email, 'pw')
    }
    await loginAs('ayo@example.com')
    const keys = withKeys()
    useAuthStore().clearSession(false) // session expired

    await loginAs('ayo@example.com')
    expect(keys.get('link1')).toBe('KEY1')

    useAuthStore().clearSession(false)
    await loginAs('someone.else@example.com')
    expect(keys.get('link1')).toBeNull()
  })

  it('are kept when startup cannot reach the server', async () => {
    localStorage.setItem('lockbox:session', '1')
    const keys = withKeys()
    fetchMock.mockRejectedValueOnce(new TypeError('offline'))
    await useAuthStore().bootstrap()
    expect(keys.get('link1')).toBe('KEY1')
    expect(localStorage.getItem('lockbox:session')).toBe('1') // hint kept: try again next load
  })

  it('startup forgets the hint only when the server refuses the session', async () => {
    localStorage.setItem('lockbox:session', '1')
    fetchMock.mockResolvedValueOnce(json(401, { detail: 'invalid_refresh_token' }))
    await useAuthStore().bootstrap()
    expect(localStorage.getItem('lockbox:session')).toBeNull()
  })
})

describe('signup flow API', () => {
  it('register sends the email only', async () => {
    fetchMock.mockResolvedValueOnce(json(202, { detail: 'verification_email_sent' }))
    await authApi.register('a@b.co')
    expect(JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string)).toEqual({ email: 'a@b.co' })
  })

  it('verifyEmail sends the token and the chosen password', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { detail: 'verified' }))
    await authApi.verifyEmail('tok', 'tangerine-lamp-42')
    expect(JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string)).toEqual({
      token: 'tok', password: 'tangerine-lamp-42',
    })
  })
})
