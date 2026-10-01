/**
 * Client-side encryption for Lockbox.
 *
 * Format of an encrypted blob:  [ version (1 byte) | IV (12 bytes) | AES-256-GCM ciphertext + tag ]
 * The version byte is also bound as AES-GCM additional data, so it can't be altered undetected.
 *
 * The key is 32 random bytes, base64url-encoded (43 chars), and travels only in the URL
 * fragment (#key). Browsers never send fragments to servers, so the backend and B2 only
 * ever see ciphertext.
 */

const VERSION = 1
export const IV_BYTES = 12
export const TAG_BYTES = 16
export const KEY_BYTES = 32
/** Bytes added to every file: version + IV + GCM tag. */
export const CIPHERTEXT_OVERHEAD = 1 + IV_BYTES + TAG_BYTES
/** Backend cap on the *ciphertext* size (keep in sync with MAX_UPLOAD_BYTES on the API). */
export const MAX_CIPHERTEXT_BYTES = 25 * 1024 * 1024
/** Largest plaintext we accept so that the ciphertext still fits under the cap. */
export const MAX_FILE_BYTES = MAX_CIPHERTEXT_BYTES - CIPHERTEXT_OVERHEAD

const KEY_PATTERN = /^[A-Za-z0-9_-]{43}$/

export class DecryptError extends Error {
  constructor(message = 'Could not unlock this file.') {
    super(message)
    this.name = 'DecryptError'
  }
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** A fresh random 256-bit key, base64url-encoded. */
export function generateKey(): string {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(KEY_BYTES)))
}

/** Extract and validate the key from a URL hash ("#abc…"). Returns null if absent or malformed. */
export function parseKeyFromHash(hash: string): string | null {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  return KEY_PATTERN.test(raw) ? raw : null
}

async function importKey(encodedKey: string, usage: 'encrypt' | 'decrypt'): Promise<CryptoKey> {
  if (!KEY_PATTERN.test(encodedKey)) throw new DecryptError('The link is missing its key.')
  return crypto.subtle.importKey('raw', base64UrlToBytes(encodedKey), 'AES-GCM', false, [usage])
}

export async function encryptBytes(
  plaintext: ArrayBuffer | Uint8Array<ArrayBuffer>,
  encodedKey: string,
): Promise<Uint8Array<ArrayBuffer>> {
  const key = await importKey(encodedKey, 'encrypt')
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const aad = new Uint8Array([VERSION])
  const sealed = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad }, key, plaintext)
  const out = new Uint8Array(1 + IV_BYTES + sealed.byteLength)
  out[0] = VERSION
  out.set(iv, 1)
  out.set(new Uint8Array(sealed), 1 + IV_BYTES)
  return out
}

export async function decryptBytes(
  data: ArrayBuffer | Uint8Array<ArrayBuffer>,
  encodedKey: string,
): Promise<Uint8Array<ArrayBuffer>> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  if (bytes.byteLength < CIPHERTEXT_OVERHEAD || bytes[0] !== VERSION) {
    throw new DecryptError('This file is in an unknown format.')
  }
  const key = await importKey(encodedKey, 'decrypt')
  const iv = bytes.slice(1, 1 + IV_BYTES)
  const sealed = bytes.slice(1 + IV_BYTES)
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, additionalData: new Uint8Array([VERSION]) },
      key,
      sealed,
    )
    return new Uint8Array(plain)
  } catch {
    // Wrong key, truncated download and tampering all look the same to AES-GCM.
    throw new DecryptError()
  }
}
