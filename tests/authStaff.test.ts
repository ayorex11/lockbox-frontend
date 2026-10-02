import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/lib/api'
import { useAuthStore } from '@/stores/auth'

describe('auth store: staff flag', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

  it('records is_staff on login and clears it on logout', async () => {
    vi.spyOn(api.authApi, 'login').mockResolvedValue({ access: 't', user: { email: 'boss@example.com', is_staff: true } })
    vi.spyOn(api.authApi, 'logout').mockResolvedValue({})
    const auth = useAuthStore()
    await auth.login('boss@example.com', 'pw')
    expect(auth.isAuthenticated).toBe(true)
    expect(auth.isStaff).toBe(true)
    await auth.logout()
    expect(auth.isAuthenticated).toBe(false)
    expect(auth.isStaff).toBe(false)
  })

  it('is not staff when the API says so, or omits the field (older backend)', async () => {
    const login = vi.spyOn(api.authApi, 'login')
    login.mockResolvedValue({ access: 't', user: { email: 'a@example.com', is_staff: false } })
    const auth = useAuthStore()
    await auth.login('a@example.com', 'pw')
    expect(auth.isStaff).toBe(false)

    login.mockResolvedValue({ access: 't', user: { email: 'b@example.com' } } as never)
    await auth.login('b@example.com', 'pw')
    expect(auth.isStaff).toBe(false)
  })

  it('restores the staff flag when a session is bootstrapped from the refresh cookie', async () => {
    localStorage.setItem('lockbox:session', '1')
    const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
    vi.stubGlobal('fetch', vi.fn(async (url: string) =>
      String(url).includes('/api/auth/refresh')
        ? json({ access: 'fresh' })
        : json({ email: 'boss@example.com', is_email_verified: true, is_staff: true }),
    ))
    const auth = useAuthStore()
    await auth.bootstrap()
    expect(auth.email).toBe('boss@example.com')
    expect(auth.isStaff).toBe(true)
  })
})
