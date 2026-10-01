// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  base64UrlToBytes, bytesToBase64Url, CIPHERTEXT_OVERHEAD, decryptBytes, DecryptError, encryptBytes,
  generateKey, MAX_CIPHERTEXT_BYTES, MAX_FILE_BYTES, parseKeyFromHash,
} from '@/lib/crypto'

const text = (s: string) => new TextEncoder().encode(s)

describe('key handling', () => {
  it('generates 256-bit url-safe keys that are different every time', () => {
    const a = generateKey()
    const b = generateKey()
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(a).not.toBe(b)
    expect(base64UrlToBytes(a).byteLength).toBe(32)
  })

  it('round-trips base64url, including bytes that need padding and url-unsafe chars', () => {
    for (const bytes of [new Uint8Array([251, 255, 254]), new Uint8Array([0]), crypto.getRandomValues(new Uint8Array(33))]) {
      expect([...base64UrlToBytes(bytesToBase64Url(bytes))]).toEqual([...bytes])
    }
  })

  it('parses only well-formed keys from a URL hash', () => {
    const key = generateKey()
    expect(parseKeyFromHash(`#${key}`)).toBe(key)
    expect(parseKeyFromHash(key)).toBe(key)
    for (const bad of ['', '#', '#short', `#${key}x`, `#${key.slice(1)}!`, '#k=' + key]) {
      expect(parseKeyFromHash(bad)).toBeNull()
    }
  })
})

describe('encrypt / decrypt', () => {
  it('round-trips data and adds exactly CIPHERTEXT_OVERHEAD bytes', async () => {
    const key = generateKey()
    const plain = text('tax return 2025 — confidential ✓')
    const sealed = await encryptBytes(plain, key)
    expect(sealed.byteLength).toBe(plain.byteLength + CIPHERTEXT_OVERHEAD)
    expect([...(await decryptBytes(sealed, key))]).toEqual([...plain])
  })

  it('handles an empty payload and a large one', async () => {
    const key = generateKey()
    expect((await decryptBytes(await encryptBytes(new Uint8Array(0), key), key)).byteLength).toBe(0)
    const big = new Uint8Array(5 * 1024 * 1024)
    for (let i = 0; i < big.length; i += 65536) crypto.getRandomValues(big.subarray(i, i + 65536))
    const back = await decryptBytes(await encryptBytes(big, key), key)
    expect(Buffer.compare(Buffer.from(back), Buffer.from(big))).toBe(0)
  })

  it('never reuses an IV: same key and plaintext give different ciphertext', async () => {
    const key = generateKey()
    const a = await encryptBytes(text('same'), key)
    const b = await encryptBytes(text('same'), key)
    expect(Buffer.compare(Buffer.from(a), Buffer.from(b))).not.toBe(0)
  })

  it('does not contain the plaintext', async () => {
    const sealed = await encryptBytes(text('SECRET-MARKER-12345'), generateKey())
    expect(Buffer.from(sealed).includes(Buffer.from('SECRET-MARKER-12345'))).toBe(false)
  })

  it('fails with DecryptError for the wrong key', async () => {
    const sealed = await encryptBytes(text('hello'), generateKey())
    await expect(decryptBytes(sealed, generateKey())).rejects.toBeInstanceOf(DecryptError)
  })

  it('detects tampering anywhere in the blob', async () => {
    const key = generateKey()
    const sealed = await encryptBytes(text('do not change me'), key)
    for (const index of [0, 1, 12, 13, sealed.length - 1]) {
      const copy = sealed.slice()
      copy[index] ^= 0x01
      await expect(decryptBytes(copy, key)).rejects.toBeInstanceOf(DecryptError)
    }
  })

  it('rejects truncated data and malformed keys', async () => {
    const key = generateKey()
    const sealed = await encryptBytes(text('hello'), key)
    await expect(decryptBytes(sealed.slice(0, sealed.length - 3), key)).rejects.toBeInstanceOf(DecryptError)
    await expect(decryptBytes(new Uint8Array(5), key)).rejects.toBeInstanceOf(DecryptError)
    await expect(decryptBytes(sealed, 'not-a-key')).rejects.toBeInstanceOf(DecryptError)
    await expect(encryptBytes(text('x'), 'not-a-key')).rejects.toBeInstanceOf(DecryptError)
  })
})

describe('size limits', () => {
  it('keeps the plaintext limit exactly CIPHERTEXT_OVERHEAD under the ciphertext cap', () => {
    expect(MAX_FILE_BYTES + CIPHERTEXT_OVERHEAD).toBe(MAX_CIPHERTEXT_BYTES)
  })
})
