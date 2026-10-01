// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import type { ShareLink } from '@/lib/api'
import { decryptBytes, CIPHERTEXT_OVERHEAD, encryptBytes, generateKey } from '@/lib/crypto'
import { sendFile, type SendDeps, type SendOptions, type SendStage, type SendState } from '@/lib/sendPipeline'

const link = { id: 'lnk123', expires_at: '2030-01-01T00:00:00Z' } as ShareLink
const options: SendOptions = { mode: 'timed', ttl: '24h', maxDownloads: null, password: null, showSenderEmail: true }

function makeDeps(overrides: Partial<SendDeps> = {}) {
  const uploaded: Uint8Array<ArrayBuffer>[] = []
  const deps: SendDeps = {
    generateKey: vi.fn(generateKey),
    encrypt: vi.fn(encryptBytes),
    initUpload: vi.fn(async () => ({ file_id: 'f1', upload_url: 'https://b2/put', method: 'PUT' as const, headers: { 'Content-Type': 'application/octet-stream' }, expires_in: 900 })),
    upload: vi.fn(async (_u, _h, data, onProgress) => { uploaded.push(data); onProgress(1) }),
    completeUpload: vi.fn(async () => ({ file_id: 'f1', status: 'ready', size: 0 })),
    createLink: vi.fn(async () => link),
    ...overrides,
  }
  return { deps, uploaded }
}
const hooks = () => {
  const stages: SendStage[] = []
  return { stages, hooks: { onStage: (s: SendStage) => stages.push(s), onProgress: () => {} } }
}

describe('sendFile', () => {
  it('locks, uploads, verifies and creates the link, in that order', async () => {
    const { deps } = makeDeps()
    const { stages, hooks: h } = hooks()
    const file = new File(['hello secret world'], 'note.txt')
    const result = await sendFile(file, options, h, {}, deps)
    expect(stages).toEqual(['locking', 'uploading', 'finishing', 'creating'])
    expect(result.link).toBe(link)
    expect(deps.initUpload).toHaveBeenCalledWith('note.txt', 'hello secret world'.length + CIPHERTEXT_OVERHEAD)
    expect(deps.completeUpload).toHaveBeenCalledWith('f1')
  })

  it('uploads only ciphertext, and the returned key decrypts it', async () => {
    const { deps, uploaded } = makeDeps()
    const file = new File(['PLAINTEXT-MARKER'], 'a.txt')
    const { key } = await sendFile(file, options, hooks().hooks, {}, deps)
    expect(Buffer.from(uploaded[0]!).includes(Buffer.from('PLAINTEXT-MARKER'))).toBe(false)
    const back = await decryptBytes(uploaded[0]!, key)
    expect(new TextDecoder().decode(back)).toBe('PLAINTEXT-MARKER')
  })

  it('never sends the key to any API function', async () => {
    const { deps } = makeDeps()
    const { key } = await sendFile(new File(['x'], 'a.txt'), options, hooks().hooks, {}, deps)
    const sent = JSON.stringify([
      (deps.initUpload as ReturnType<typeof vi.fn>).mock.calls,
      (deps.completeUpload as ReturnType<typeof vi.fn>).mock.calls,
      (deps.createLink as ReturnType<typeof vi.fn>).mock.calls,
    ])
    expect(sent).not.toContain(key)
  })

  it('builds the right link payload for each mode', async () => {
    const a = makeDeps()
    await sendFile(new File(['x'], 'a'), { ...options, mode: 'timed', ttl: '7d', maxDownloads: 5, password: 'hunter22', showSenderEmail: false }, hooks().hooks, {}, a.deps)
    expect(a.deps.createLink).toHaveBeenCalledWith({ file_id: 'f1', mode: 'timed', ttl: '7d', show_sender_email: false, max_downloads: 5, password: 'hunter22' })

    const b = makeDeps()
    await sendFile(new File(['x'], 'a'), { ...options, mode: 'one_time', maxDownloads: 5 }, hooks().hooks, {}, b.deps)
    const payload = (b.deps.createLink as ReturnType<typeof vi.fn>).mock.calls[0]![0]
    expect(payload).toEqual({ file_id: 'f1', mode: 'one_time', ttl: '24h', show_sender_email: true }) // no max_downloads, no password
  })

  it('resumes after an upload failure without re-encrypting or changing the key', async () => {
    let failOnce = true
    const { deps } = makeDeps({
      upload: vi.fn(async () => { if (failOnce) { failOnce = false; throw new Error('network') } }),
    })
    const state: SendState = {}
    const file = new File(['data'], 'a.bin')
    await expect(sendFile(file, options, hooks().hooks, state, deps)).rejects.toThrow('network')
    const keyBefore = state.keyEncoded
    expect(state.cipher).toBeDefined()
    expect(state.fileId).toBeUndefined() // slot is reserved again on retry

    const result = await sendFile(file, options, hooks().hooks, state, deps)
    expect(result.key).toBe(keyBefore)
    expect(deps.generateKey).toHaveBeenCalledTimes(1)
    expect(deps.encrypt).toHaveBeenCalledTimes(1)
    expect(deps.initUpload).toHaveBeenCalledTimes(2)
  })

  it('does not re-upload when only link creation failed', async () => {
    let failOnce = true
    const { deps } = makeDeps({
      createLink: vi.fn(async () => { if (failOnce) { failOnce = false; throw new Error('boom') } return link }),
    })
    const state: SendState = {}
    const file = new File(['data'], 'a.bin')
    await expect(sendFile(file, options, hooks().hooks, state, deps)).rejects.toThrow('boom')
    await sendFile(file, options, hooks().hooks, state, deps)
    expect(deps.upload).toHaveBeenCalledTimes(1)
    expect(deps.initUpload).toHaveBeenCalledTimes(1)
    expect(deps.createLink).toHaveBeenCalledTimes(2)
  })
})
