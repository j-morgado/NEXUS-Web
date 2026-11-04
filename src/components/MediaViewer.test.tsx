import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { CatalogMedia } from '../content/catalog'
import { MediaViewer } from './MediaViewer'

afterEach(cleanup)
beforeAll(() => { vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined) })

const image: CatalogMedia = {
  id: 'remote-image',
  name: 'Remote image',
  description: 'CMS supplied image',
  kind: 'image',
  url: 'https://cdn.example.test/image.webp',
  accent: '#8d63ea',
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

  it('uses supplied video and PDF URLs rather than built-in placeholders', () => {
    const video: CatalogMedia = { ...image, id: 'remote-video', name: 'Remote video', kind: 'video', url: 'https://cdn.example.test/video.mp4', thumbnailUrl: 'https://cdn.example.test/poster.webp' }
    const { rerender } = render(<MediaViewer media={video} items={[video]} onSelect={vi.fn()} onClose={vi.fn()} />)
    expect(document.querySelector('video[aria-label="Remote video"]')).toHaveAttribute('src', video.url)

    const pdf: CatalogMedia = { ...image, id: 'remote-pdf', name: 'Remote document', kind: 'pdf', url: 'https://cdn.example.test/document.pdf', pageCount: 2 }
    rerender(<MediaViewer media={pdf} items={[pdf]} onSelect={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByTitle('Remote document, page 1')).toHaveAttribute('src', `${pdf.url}#page=1&view=FitH`)
    expect(screen.getByRole('link', { name: 'Open document' })).toHaveAttribute('href', pdf.url)
  })
})
