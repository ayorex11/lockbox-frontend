export class UploadError extends Error {
  constructor(public readonly status: number) {
    super(`upload_failed_${status}`)
    this.name = 'UploadError'
  }
}

/** PUT the ciphertext straight to B2 via the presigned URL, reporting real progress (0..1). */
export function uploadCiphertext(
  url: string,
  headers: Record<string, string>,
  data: Uint8Array<ArrayBuffer>,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value)
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total)
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(1)
        resolve()
      } else {
        reject(new UploadError(xhr.status))
      }
    }
    xhr.onerror = () => reject(new UploadError(0))
    xhr.onabort = () => reject(new DOMException('Aborted', 'AbortError'))
    signal?.addEventListener('abort', () => xhr.abort(), { once: true })
    xhr.send(new Blob([data]))
  })
}
