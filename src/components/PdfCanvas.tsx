import { useEffect, useRef, useState } from 'react'
import { GlobalWorkerOptions, getDocument, type PDFDocumentLoadingTask, type PDFDocumentProxy, type RenderTask } from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { CatalogMedia } from '../content/catalog'
import { readBoundedPdfBytes } from '../services/pdfStream'

GlobalWorkerOptions.workerSrc = pdfWorkerUrl

type LoadState = { status: 'loading' } | { status: 'ready'; document: PDFDocumentProxy } | { status: 'error'; message: string }

export function PdfCanvas({ media, page }: { media: CatalogMedia; page: number }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [renderError, setRenderError] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    let loadingTask: PDFDocumentLoadingTask | undefined
    let document: PDFDocumentProxy | undefined
    const load = async () => {
      try {
        const response = await fetch(media.url, { headers: { Accept: 'application/pdf' }, credentials: 'omit', signal: controller.signal })
        if (!response.ok) throw new Error(`Document request failed with HTTP ${response.status}.`)
        const contentType = response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase()
        if (contentType !== 'application/pdf') throw new Error('Document preview blocked because the server did not return a PDF.')
        const bytes = await readBoundedPdfBytes(response)
        loadingTask = getDocument({ data: bytes, enableXfa: false, stopAtErrors: true, maxImageSize: 20_000_000 })
        document = await loadingTask.promise
        if (!controller.signal.aborted) setState({ status: 'ready', document })
      } catch (failure) {
        if (controller.signal.aborted) return
        const message = failure instanceof TypeError
          ? 'Document preview unavailable: the server did not permit a status-checked download, or the network is offline. Use Open document to try the source directly.'
          : failure instanceof Error ? failure.message : 'Document preview could not be loaded.'
        setState({ status: 'error', message })
      }
    }
    void load()
    return () => {
      controller.abort()
      void loadingTask?.destroy()
    }
  }, [media.url])

  useEffect(() => {
    if (state.status !== 'ready') return
    let renderTask: RenderTask | undefined
    let cancelled = false
    const render = async () => {
      try {
        if (page > state.document.numPages) throw new Error(`Document contains only ${state.document.numPages} pages.`)
        const pdfPage = await state.document.getPage(page)
        const viewport = pdfPage.getViewport({ scale: 1.5 })
        const canvas = canvasRef.current
        const context = canvas?.getContext('2d', { alpha: false })
        if (!canvas || !context) throw new Error('Canvas rendering is unavailable on this device.')
        const outputScale = Math.min(window.devicePixelRatio || 1, 2)
        canvas.width = Math.floor(viewport.width * outputScale)
        canvas.height = Math.floor(viewport.height * outputScale)
        canvas.style.aspectRatio = `${viewport.width} / ${viewport.height}`
        renderTask = pdfPage.render({
          canvas,
          canvasContext: context,
          viewport,
          transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0],
          background: '#ffffff',
        })
        await renderTask.promise
      } catch (failure) {
        if (!cancelled && failure instanceof Error && failure.name !== 'RenderingCancelledException') setRenderError(failure.message)
      }
    }
    void render()
    return () => {
      cancelled = true
      renderTask?.cancel()
    }
  }, [page, state])

  if (state.status === 'loading') return <div className="media-document-state" role="status"><span>Loading document preview…</span></div>
  if (state.status === 'error') return <div className="media-document-state is-error" role="alert"><span>DOCUMENT UNAVAILABLE</span><strong>{media.name}</strong><p>{state.message}</p></div>
  return <div className="media-pdf-canvas-stage">
    <canvas ref={canvasRef} className="media-asset-pdf" role="img" aria-label={`${media.name}, page ${page}`} />
    {renderError && <div className="media-document-state is-error" role="alert"><span>DOCUMENT UNAVAILABLE</span><strong>{media.name}</strong><p>{renderError}</p></div>}
  </div>
}
