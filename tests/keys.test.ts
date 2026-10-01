import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useKeyStore } from '@/stores/keys'

const inHours = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString()

describe('key store', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('saves and returns keys, and persists them across store instances', () => {
    useKeyStore().save('link1', 'KEY1', inHours(1))
    expect(useKeyStore().get('link1')).toBe('KEY1')
    setActivePinia(createPinia()) // simulates a page reload
    expect(useKeyStore().get('link1')).toBe('KEY1')
  })

  it('does not return keys for expired links and prunes them on load', () => {
    localStorage.setItem('lockbox:keys', JSON.stringify({ old: { key: 'K', expires: Date.now() - 1000 }, fresh: { key: 'F', expires: Date.now() + 60_000 } }))
    const store = useKeyStore()
    expect(store.get('old')).toBeNull()
    expect(store.get('fresh')).toBe('F')
    expect(Object.keys(JSON.parse(localStorage.getItem('lockbox:keys')!))).toEqual(['fresh'])
  })

  it('removes a single key and clears everything', () => {
    const store = useKeyStore()
    store.save('a', 'A', inHours(1))
    store.save('b', 'B', inHours(1))
    store.remove('a')
    expect(store.get('a')).toBeNull()
    expect(store.get('b')).toBe('B')
    store.clear()
    expect(store.get('b')).toBeNull()
    expect(localStorage.getItem('lockbox:keys')).toBeNull()
  })

  it('survives corrupt storage', () => {
    localStorage.setItem('lockbox:keys', '{not json')
    expect(useKeyStore().get('x')).toBeNull()
  })
})
