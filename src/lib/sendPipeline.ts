import { filesApi, linksApi, type CreateLinkPayload, type LinkMode, type ShareLink, type TtlChoice } from './api'
import { encryptBytes, generateKey } from './crypto'
import { uploadCiphertext } from './upload'

export interface SendOptions {
  mode: LinkMode
  ttl: TtlChoice
  maxDownloads: number | null
  password: string | null
  showSenderEmail: boolean
}

export type SendStage = 'locking' | 'uploading' | 'finishing' | 'creating'

export interface SendHooks {
  onStage: (stage: SendStage) => void
  /** Upload progress, 0..1. */
  onProgress: (fraction: number) => void
}

/** Survives failures so a retry doesn't re-encrypt or re-upload work that already succeeded. */
export interface SendState {
  keyEncoded?: string
  cipher?: Uint8Array<ArrayBuffer>
  fileId?: string
  uploaded?: boolean
}

export interface SendDeps {
  generateKey: typeof generateKey
  encrypt: typeof encryptBytes
  upload: typeof uploadCiphertext
  initUpload: typeof filesApi.init
  completeUpload: typeof filesApi.complete
  createLink: typeof linksApi.create
}

export const defaultDeps: SendDeps = {
  generateKey,
  encrypt: encryptBytes,
  upload: uploadCiphertext,
  initUpload: filesApi.init,
  completeUpload: filesApi.complete,
  createLink: linksApi.create,
}

/**
 * lock (encrypt in the browser) -> reserve + PUT to B2 -> verify -> create the link.
 * Returns the link and the key; the key is never sent anywhere.
 */
export async function sendFile(
  file: File,
  options: SendOptions,
  hooks: SendHooks,
  state: SendState = {},
  deps: SendDeps = defaultDeps,
): Promise<{ link: ShareLink; key: string }> {
  if (!state.cipher || !state.keyEncoded) {
    hooks.onStage('locking')
    state.keyEncoded = deps.generateKey()
    state.cipher = await deps.encrypt(await file.arrayBuffer(), state.keyEncoded)
  }

  if (!state.uploaded) {
    try {
      hooks.onStage('uploading')
      const init = await deps.initUpload(file.name, state.cipher.byteLength)
      state.fileId = init.file_id
      await deps.upload(init.upload_url, init.headers, state.cipher, hooks.onProgress)
      hooks.onStage('finishing')
      await deps.completeUpload(init.file_id)
      state.uploaded = true
    } catch (error) {
      state.fileId = undefined // a retry reserves a fresh upload slot
      throw error
    }
  }

  hooks.onStage('creating')
  const payload: CreateLinkPayload = {
    file_id: state.fileId!,
    mode: options.mode,
    ttl: options.ttl,
    show_sender_email: options.showSenderEmail,
    ...(options.mode === 'timed' && options.maxDownloads ? { max_downloads: options.maxDownloads } : {}),
    ...(options.password ? { password: options.password } : {}),
  }
  const link = await deps.createLink(payload)
  return { link, key: state.keyEncoded }
}
