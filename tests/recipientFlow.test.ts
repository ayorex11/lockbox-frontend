// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { ApiError, NetworkError } from '@/lib/api'
import { encryptBytes, generateKey } from '@/lib/crypto'
import { claimAndDecrypt, type RecipientDeps, type RecipientPhase } from '@/lib/recipientFlow'

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
})
