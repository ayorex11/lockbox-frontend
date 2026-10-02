import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { authApi, refreshAccessToken, setAccessToken } from '@/lib/api'
import { useKeyStore } from './keys'

// Non-sensitive hint (no tokens) so anonymous visitors, like link recipients, don't fire a refresh request.
const HINT_KEY = 'lockbox:session'
const hasHint = () => { try { return localStorage.getItem(HINT_KEY) === '1' } catch { return false } }
const setHint = (on: boolean) => {
  try { on ? localStorage.setItem(HINT_KEY, '1') : localStorage.removeItem(HINT_KEY) } catch { /* ignore */ }
}

export const useAuthStore = defineStore('auth', () => {
  const email = ref<string | null>(null)
  const isStaff = ref(false)
  const ready = ref(false)
  const isAuthenticated = computed(() => email.value !== null)
  let bootstrapping: Promise<void> | null = null

  /** Restore a session from the refresh cookie (once per page load). */
  function bootstrap(): Promise<void> {
    if (ready.value) return Promise.resolve()
    if (!bootstrapping) {
      bootstrapping = (async () => {
        try {
          if (hasHint()) {
            if (await refreshAccessToken()) {
              const me = await authApi.me()
              email.value = me.email
              isStaff.value = me.is_staff === true
            } else setHint(false)
          }
        } catch {
          email.value = null
        } finally {
          ready.value = true
        }
      })()
    }
    return bootstrapping
  }

  async function login(emailInput: string, password: string) {
    const data = await authApi.login(emailInput, password)
    setAccessToken(data.access)
    email.value = data.user.email
    isStaff.value = data.user.is_staff === true
    ready.value = true
    setHint(true)
  }

  function clearSession() {
    setAccessToken(null)
    email.value = null
    isStaff.value = false
    setHint(false)
    useKeyStore().clear()
  }

  async function logout() {
    try { await authApi.logout() } catch { /* cookie may already be gone */ }
    clearSession()
  }

  return { email, isStaff, ready, isAuthenticated, bootstrap, login, logout, clearSession }
})
