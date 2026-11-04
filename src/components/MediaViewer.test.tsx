import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { CatalogMedia } from '../content/catalog'
import { MediaViewer } from './MediaViewer'

beforeAll(() => {
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined)
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:status-checked-pdf') })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks() })

const image: CatalogMedia = {
  id: 'remote-image',
  name: 'Remote image',
  description: 'CMS supplied image',
  kind: 'image',
  url: 'https://cdn.example.test/image.webp',
  accent: '#8d63ea',
}

const pdf: CatalogMedia = {
  ...image,
  id: 'remote-pdf',
  name: 'Remote document',
  kind: 'pdf',
  url: 'https://cdn.example.test/document.pdf',
  pageCount: 2,
}

describe('MediaViewer CMS assets', () => {
  it('uses the supplied image URL and contains an asset failure', () => {
    render(<MediaViewer media={image} items={[image]} onSelect={vi.fn()} onClose={vi.fn()} />)
    const asset = screen.getByAltText('CMS supplied image')
    expect(asset).toHaveAttribute('src', image.url)
    fireEvent.error(asset)
    expect(screen.getByText('Image could not be loaded.')).toBeInTheDocument()
    expect(screen.getByText('MEDIA UNAVAILABLE')).toBeInTheDocument()
  })

  it('uses the supplied video URL rather than a built-in placeholder', () => {
    const video: CatalogMedia = { ...image, id: 'remote-video', name: 'Remote video', kind: 'video', url: 'https://cdn.example.test/video.mp4', thumbnailUrl: 'https://cdn.example.test/poster.webp' }
    render(<MediaViewer media={video} items={[video]} onSelect={vi.fn()} onClose={vi.fn()} />)
    expect(document.querySelector('video[aria-label="Remote video"]')).toHaveAttribute('src', video.url)
  })

  it('status-checks a PDF before embedding it in an isolated iframe', async () => {
    const fetcher = vi.fn(async () => new Response(new Blob(['%PDF-1.4'], { type: 'application/pdf' }), { status: 200, headers: { 'Content-Type': 'application/pdf', 'Content-Length': '8' } }))
    vi.stubGlobal('fetch', fetcher)
    render(<MediaViewer media={pdf} items={[pdf]} onSelect={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading document preview')
    const frame = await screen.findByTitle('Remote document, page 1')
    expect(frame).toHaveAttribute('src', 'blob:status-checked-pdf#page=1&view=FitH')
    expect(frame).toHaveAttribute('sandbox', '')
    expect(frame).toHaveAttribute('referrerpolicy', 'no-referrer')
    expect(fetcher).toHaveBeenCalledWith(pdf.url, expect.objectContaining({ credentials: 'omit', headers: { Accept: 'application/pdf' } }))
    expect(screen.getByRole('link', { name: 'Open document' })).toHaveAttribute('href', pdf.url)
  })

  it('shows an accessible error for a normal PDF 404 instead of trusting iframe onError', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('missing', { status: 404, headers: { 'Content-Type': 'text/html' } })))
    render(<MediaViewer media={pdf} items={[pdf]} onSelect={vi.fn()} onClose={vi.fn()} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('HTTP 404')
    expect(screen.queryByTitle('Remote document, page 1')).not.toBeInTheDocument()
  })

  it('blocks a successful HTML response from the PDF preview sandbox', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>not a PDF</html>', { status: 200, headers: { 'Content-Type': 'text/html' } })))
    render(<MediaViewer media={pdf} items={[pdf]} onSelect={vi.fn()} onClose={vi.fn()} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('did not return a PDF')
    expect(screen.queryByTitle('Remote document, page 1')).not.toBeInTheDocument()
  })

  it('provides a CORS-aware fallback when a status-checked download is blocked', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    render(<MediaViewer media={pdf} items={[pdf]} onSelect={vi.fn()} onClose={vi.fn()} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('status-checked download')
    await waitFor(() => expect(screen.getByRole('link', { name: 'Open document' })).toBeInTheDocument())
  })
})
