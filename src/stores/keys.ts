import { defineStore } from 'pinia'
import { ref } from 'vue'

const STORAGE_KEY = 'lockbox:keys'

interface StoredKey { key: string; expires: number }
type KeyMap = Record<string, StoredKey>

function read(): KeyMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as KeyMap) : {}
  } catch {
    return {}
  }
}

function write(map: KeyMap) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(map)) } catch { /* storage unavailable */ }
}

/**
 * Remembers the decryption key for links created on THIS device so the sender can copy a
 * link again later. The server never has these keys. Entries are dropped when the link
 * expires and all of them are wiped on logout.
 */
export const useKeyStore = defineStore('keys', () => {
  const map = ref<KeyMap>({})

  function load() {
    const now = Date.now()
    const fresh = Object.fromEntries(Object.entries(read()).filter(([, v]) => v.expires > now))
    map.value = fresh
    write(fresh)
  }
  function save(linkId: string, key: string, expiresAtIso: string) {
    map.value = { ...map.value, [linkId]: { key, expires: new Date(expiresAtIso).getTime() } }
    write(map.value)
  }
  function get(linkId: string): string | null {
    const entry = map.value[linkId]
    return entry && entry.expires > Date.now() ? entry.key : null
  }
  function remove(linkId: string) {
    const { [linkId]: _removed, ...rest } = map.value
    map.value = rest
    write(rest)
  }
  function clear() {
    map.value = {}
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
  }
  load()
  return { save, get, remove, clear, load }
})
