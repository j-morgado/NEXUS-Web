import { describe, expect, it, vi } from 'vitest'
import { PdfSizeLimitError, readBoundedPdfBytes } from './pdfStream'

const chunkedResponse = (chunks: number[][], headers?: HeadersInit) => {
  const cancelled = vi.fn()
  let index = 0
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < chunks.length) controller.enqueue(Uint8Array.from(chunks[index++]))
      if (index === chunks.length) controller.close()
    },
    cancel: cancelled,
  })
  return { response: new Response(body, { status: 200, headers }), cancelled }
}

describe('bounded PDF response reader', () => {
  it('reassembles a streamed response within the limit', async () => {
    const { response } = chunkedResponse([[1, 2], [3, 4]])
    expect([...await readBoundedPdfBytes(response, 4)]).toEqual([1, 2, 3, 4])
  })

  it('cancels a chunked response as soon as its real size crosses the limit', async () => {
    const { response, cancelled } = chunkedResponse([[1, 2, 3], [4, 5, 6], [7, 8, 9]])
    await expect(readBoundedPdfBytes(response, 5)).rejects.toBeInstanceOf(PdfSizeLimitError)
    expect(cancelled).toHaveBeenCalledWith('PDF size limit exceeded')
  })

  it('does not trust a smaller Content-Length than the streamed payload', async () => {
    const { response, cancelled } = chunkedResponse([[1, 2, 3], [4, 5, 6], [7, 8, 9]], { 'Content-Length': '4' })
    await expect(readBoundedPdfBytes(response, 5)).rejects.toBeInstanceOf(PdfSizeLimitError)
    expect(cancelled).toHaveBeenCalled()
  })

  it('rejects and cancels an oversized declared length before reading', async () => {
    const { response, cancelled } = chunkedResponse([[1]], { 'Content-Length': '6' })
    await expect(readBoundedPdfBytes(response, 5)).rejects.toBeInstanceOf(PdfSizeLimitError)
    expect(cancelled).toHaveBeenCalled()
  })
})
