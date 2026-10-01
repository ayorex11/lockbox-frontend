/** Fetch the ciphertext from the presigned URL with progress (0..1 when the size is known). */
export async function fetchCiphertext(
  url: string,
  onProgress: (fraction: number | null) => void,
  signal?: AbortSignal,
): Promise<Uint8Array<ArrayBuffer>> {
  const response = await fetch(url, { signal, credentials: 'omit' })
  if (!response.ok) throw new Error(`download_failed_${response.status}`)

  const total = Number(response.headers.get('content-length')) || 0
  if (!response.body) {
    const buffer = new Uint8Array(await response.arrayBuffer())
    onProgress(1)
    return buffer
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    received += value.byteLength
    onProgress(total ? Math.min(1, received / total) : null)
  }
  const out = new Uint8Array(received)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  onProgress(1)
  return out
}

/** Hand decrypted bytes to the browser as a file download. */
export function saveBytes(bytes: Uint8Array<ArrayBuffer>, filename: string): void {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
