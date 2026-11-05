export const MAX_PDF_BYTES = 50 * 1024 * 1024

export class PdfSizeLimitError extends Error {
  constructor() {
    super('Document preview is too large for the kiosk viewer.')
    this.name = 'PdfSizeLimitError'
  }
}

export async function readBoundedPdfBytes(response: Response, maxBytes = MAX_PDF_BYTES): Promise<Uint8Array> {
  const declaredLength = Number(response.headers.get('Content-Length'))
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    await response.body?.cancel()
    throw new PdfSizeLimitError()
  }
  if (!response.body) throw new Error('Document preview requires a streaming response body.')

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > maxBytes) {
        await reader.cancel('PDF size limit exceeded')
        throw new PdfSizeLimitError()
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}
