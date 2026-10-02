// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { ApiError, NetworkError } from '@/lib/api'
import { encryptBytes, generateKey } from '@/lib/crypto'
import { claimAndDecrypt, DOWNLOAD_RETRIES, type RecipientDeps, type RecipientPhase } from '@/lib/recipientFlow'

const hooks = () => {
  const phases: RecipientPhase[] = []
  return { phases, hooks: { onPhase: (p: RecipientPhase) => phases.push(p), onProgress: () => {} } }
}

async function setup(overrides: Partial<RecipientDeps> = {}) {
  const key = generateKey()
  const plain = new TextEncoder().encode('the quarterly numbers')
  const cipher = await encryptBytes(plain, key)
  const deps: RecipientDeps = {
    claim: vi.fn(async () => ({ ok: true as const, download_url: 'https://b2/get/x', expires_in: 60 })),
    fetchCiphertext: vi.fn(async () => cipher),
    decrypt: (await import('@/lib/crypto')).decryptBytes,
    ...overrides,
  }
  return { key, plain, cipher, deps }
}

describe('claimAndDecrypt', () => {
  it('claims, downloads and decrypts to the original bytes', async () => {
    const { key, plain, deps } = await setup()
    const { phases, hooks: h } = hooks()
    const outcome = await claimAndDecrypt('tok', key, 'pw', h, deps)
    expect(outcome.kind).toBe('ok')
    if (outcome.kind === 'ok') expect([...outcome.bytes]).toEqual([...plain])
    expect(phases).toEqual(['claiming', 'downloading', 'unlocking'])
    expect(deps.claim).toHaveBeenCalledWith('tok', 'pw')
    expect(deps.fetchCiphertext).toHaveBeenCalledWith('https://b2/get/x', expect.any(Function))
  })

  it('reports a wrong key as decrypt_failed after the download', async () => {
    const { deps } = await setup()
    expect((await claimAndDecrypt('t', generateKey(), undefined, hooks().hooks, deps)).kind).toBe('decrypt_failed')
  })

  it.each([
    [new ApiError(401, 'wrong_password', { attempts_left: 2 }), { kind: 'wrong_password', attemptsLeft: 2 }],
    [new ApiError(401, 'password_required'), { kind: 'password_required' }],
    [new ApiError(423, 'locked', { retry_after: 600 }), { kind: 'locked', retryAfter: 600 }],
    [new ApiError(429, 'throttled'), { kind: 'throttled' }],
    [new NetworkError(), { kind: 'network' }],
  ])('maps claim error %#', async (error, expected) => {
    const { key, deps } = await setup({ claim: vi.fn(async () => { throw error }) })
    const outcome = await claimAndDecrypt('t', key, 'x', hooks().hooks, deps)
    expect(outcome).toEqual(expected)
    expect(deps.fetchCiphertext).not.toHaveBeenCalled()
  })

  it('maps a 410 to gone, carrying the reason', async () => {
    const { key, deps } = await setup({ claim: vi.fn(async () => ({ ok: false as const, reason: 'expired' as const })) })
    expect(await claimAndDecrypt('t', key, undefined, hooks().hooks, deps)).toEqual({ kind: 'gone', reason: 'expired' })
  })

  it('reports download_failed when the ciphertext cannot be fetched', async () => {
    const { key, deps } = await setup({ fetchCiphertext: vi.fn(async () => { throw new Error('download_failed_403') }) })
    expect((await claimAndDecrypt('t', key, undefined, hooks().hooks, deps)).kind).toBe('download_failed')
  })

  it('rethrows unexpected errors instead of hiding them', async () => {
    const { key, deps } = await setup({ claim: vi.fn(async () => { throw new ApiError(500, 'http_500') }) })
    await expect(claimAndDecrypt('t', key, undefined, hooks().hooks, deps)).rejects.toMatchObject({ status: 500 })
  })

  describe('retrying a download that failed after the claim', () => {
    const claimed = { ok: true as const, download_url: 'https://b2/get/first', expires_in: 60, reissue_token: 'secret-retry' }
    const fresh = { download_url: 'https://b2/get/second', expires_in: 60 }

    it('gets a fresh URL with the claim token and finishes the download', async () => {
      const { key, plain, cipher, deps } = await setup()
      const fetchCiphertext = vi.fn()
        .mockRejectedValueOnce(new Error('network dropped'))
        .mockResolvedValueOnce(cipher)
      const reissue = vi.fn(async () => fresh)
      const wait = vi.fn(async () => {})
      const outcome = await claimAndDecrypt('tok', key, undefined, hooks().hooks, {
        ...deps, claim: vi.fn(async () => claimed), fetchCiphertext, reissue, wait,
      })
      expect(outcome.kind).toBe('ok')
      if (outcome.kind === 'ok') expect([...outcome.bytes]).toEqual([...plain])
      expect(reissue).toHaveBeenCalledOnce()
      expect(reissue).toHaveBeenCalledWith('tok', 'secret-retry')
      expect(fetchCiphertext.mock.calls.map((c) => c[0])).toEqual(['https://b2/get/first', 'https://b2/get/second'])
      expect(wait).toHaveBeenCalledOnce()
    })

    it('gives up after a bounded number of retries', async () => {
      const { key, deps } = await setup()
      const fetchCiphertext = vi.fn(async () => { throw new Error('still down') })
      const reissue = vi.fn(async () => fresh)
      const outcome = await claimAndDecrypt('tok', key, undefined, hooks().hooks, {
        ...deps, claim: vi.fn(async () => claimed), fetchCiphertext, reissue, wait: async () => {},
      })
      expect(outcome.kind).toBe('download_failed')
      expect(fetchCiphertext).toHaveBeenCalledTimes(DOWNLOAD_RETRIES + 1)
      expect(reissue).toHaveBeenCalledTimes(DOWNLOAD_RETRIES)
    })

    it('does not retry when the server gave no token', async () => {
      const { key, deps } = await setup()
      const fetchCiphertext = vi.fn(async () => { throw new Error('down') })
      const reissue = vi.fn()
      const outcome = await claimAndDecrypt('tok', key, undefined, hooks().hooks, {
        ...deps, fetchCiphertext, reissue, wait: async () => {},
      })
      expect(outcome.kind).toBe('download_failed')
      expect(reissue).not.toHaveBeenCalled()
    })

    it('stops when the retry window has closed (reissue answers null)', async () => {
      const { key, deps } = await setup()
      const fetchCiphertext = vi.fn(async () => { throw new Error('down') })
      const outcome = await claimAndDecrypt('tok', key, undefined, hooks().hooks, {
        ...deps, claim: vi.fn(async () => claimed), fetchCiphertext, reissue: vi.fn(async () => null), wait: async () => {},
      })
      expect(outcome.kind).toBe('download_failed')
      expect(fetchCiphertext).toHaveBeenCalledTimes(1)
    })

    it('stops when the reissue request itself fails', async () => {
      const { key, deps } = await setup()
      const outcome = await claimAndDecrypt('tok', key, undefined, hooks().hooks, {
        ...deps,
        claim: vi.fn(async () => claimed),
        fetchCiphertext: vi.fn(async () => { throw new Error('down') }),
        reissue: vi.fn(async () => { throw new NetworkError() }),
        wait: async () => {},
      })
      expect(outcome.kind).toBe('download_failed')
    })

    it('never retries a decryption failure (the key is wrong, not the network)', async () => {
      const { deps } = await setup()
      const reissue = vi.fn()
      const outcome = await claimAndDecrypt('tok', generateKey(), undefined, hooks().hooks, {
        ...deps, claim: vi.fn(async () => claimed), reissue, wait: async () => {},
      })
      expect(outcome.kind).toBe('decrypt_failed')
      expect(reissue).not.toHaveBeenCalled()
    })
  })
})
