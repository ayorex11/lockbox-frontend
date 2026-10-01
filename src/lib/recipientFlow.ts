import { ApiError, NetworkError, recipientApi, type GoneReason } from './api'
import { decryptBytes, DecryptError } from './crypto'
import { fetchCiphertext } from './download'

export type RecipientPhase = 'claiming' | 'downloading' | 'unlocking'

export type ClaimOutcome =
  | { kind: 'ok'; bytes: Uint8Array<ArrayBuffer> }
  | { kind: 'gone'; reason: GoneReason }
  | { kind: 'wrong_password'; attemptsLeft: number }
  | { kind: 'password_required' }
  | { kind: 'locked'; retryAfter: number }
  | { kind: 'throttled' }
  /** The claim itself failed to reach the server. Nothing was consumed. */
  | { kind: 'network' }
  /** The claim succeeded but the ciphertext could not be fetched. A one-time link is now spent. */
  | { kind: 'download_failed' }
  | { kind: 'decrypt_failed' }

export interface RecipientDeps {
  claim: typeof recipientApi.claim
  fetchCiphertext: typeof fetchCiphertext
  decrypt: typeof decryptBytes
}

export const defaultRecipientDeps: RecipientDeps = {
  claim: recipientApi.claim,
  fetchCiphertext,
  decrypt: decryptBytes,
}

/** Claim the link, download the ciphertext, then decrypt it locally with the key from the URL fragment. */
export async function claimAndDecrypt(
  token: string,
  key: string,
  password: string | undefined,
  hooks: { onPhase: (phase: RecipientPhase) => void; onProgress: (fraction: number | null) => void },
  deps: RecipientDeps = defaultRecipientDeps,
): Promise<ClaimOutcome> {
  hooks.onPhase('claiming')
  let claimed
  try {
    claimed = await deps.claim(token, password)
  } catch (error) {
    if (error instanceof NetworkError) return { kind: 'network' }
    if (error instanceof ApiError) {
      if (error.status === 401 && error.code === 'wrong_password') {
        return { kind: 'wrong_password', attemptsLeft: Number(error.data.attempts_left ?? 0) }
      }
      if (error.status === 401) return { kind: 'password_required' }
      if (error.status === 423) return { kind: 'locked', retryAfter: Number(error.data.retry_after ?? 60) }
      if (error.status === 429) return { kind: 'throttled' }
    }
    throw error
  }
  if (!claimed.ok) return { kind: 'gone', reason: claimed.reason }

  hooks.onPhase('downloading')
  let cipher: Uint8Array<ArrayBuffer>
  try {
    cipher = await deps.fetchCiphertext(claimed.download_url, hooks.onProgress)
  } catch {
    return { kind: 'download_failed' }
  }

  hooks.onPhase('unlocking')
  try {
    return { kind: 'ok', bytes: await deps.decrypt(cipher, key) }
  } catch (error) {
    if (error instanceof DecryptError) return { kind: 'decrypt_failed' }
    throw error
  }
}
