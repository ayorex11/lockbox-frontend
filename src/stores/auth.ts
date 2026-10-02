import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { authApi, refreshOutcome, setAccessToken } from '@/lib/api'
import { useKeyStore } from './keys'

// Non-sensitive hint (no tokens) so anonymous visitors, like link recipients, don't fire a refresh request.
const HINT_KEY = 'lockbox:session'
const hasHint = () => { try { return localStorage.getItem(HINT_KEY) === '1' } catch { return false } }
const setHint = (on: boolean) => {
  try { on ? localStorage.setItem(HINT_KEY, '1') : localStorage.removeItem(HINT_KEY) } catch { /* ignore */ }
}

// Who the stored link keys belong to. If someone else logs in on this browser, the previous
// person's keys are wiped, since a session that merely expired never wiped them.
const OWNER_KEY = 'lockbox:owner'
const readOwner = () => { try { return localStorage.getItem(OWNER_KEY) } catch { return null } }
const writeOwner = (email: string | null) => {
  try { email ? localStorage.setItem(OWNER_KEY, email) : localStorage.removeItem(OWNER_KEY) } catch { /* ignore */ }
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
            const outcome = await refreshOutcome()
            if (outcome.kind === 'ok') {
              const me = await authApi.me()
              adopt(me.email)
              isStaff.value = me.is_staff === true
            } else if (outcome.kind === 'rejected') {
              setHint(false)
            }
            // 'unavailable' (offline, throttled, server waking up): keep the hint so the next
            // page load tries again, instead of forgetting a perfectly good session.
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

  function adopt(address: string) {
    const previousOwner = readOwner()
    if (previousOwner && previousOwner !== address) useKeyStore().clear()
    writeOwner(address)
    email.value = address
  }

  async function login(emailInput: string, password: string) {
    const data = await authApi.login(emailInput, password)
    setAccessToken(data.access)
    isStaff.value = data.user.is_staff === true
    ready.value = true
    setHint(true)
    adopt(data.user.email)
  }

  /**
   * End the local session. `wipeKeys` is true only for an explicit log out: the stored link
   * keys are the sender's only copy of each decryption key, so an expired or failed session
   * must never destroy them.
   */
  function clearSession(wipeKeys = true) {
    setAccessToken(null)
    email.value = null
    isStaff.value = false
    setHint(false)
    if (wipeKeys) {
      useKeyStore().clear()
      writeOwner(null)
    }
  }

  async function logout() {
    try { await authApi.logout() } catch { /* cookie may already be gone */ }
    clearSession(true)
  }

  return { email, isStaff, ready, isAuthenticated, bootstrap, login, logout, clearSession }
})
