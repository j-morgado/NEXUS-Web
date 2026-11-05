import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HubCardMedia } from './HubCardMedia'

describe('hub card media', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }) })
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined)
  })
  afterEach(() => { cleanup(); vi.restoreAllMocks() })

  it('supports an image-only card mode', () => {
    render(<HubCardMedia mode="image" imageSrc="/fallback.webp" videoSrc="/preview.mp4" alt="JLTV media" />)
    expect(screen.getByRole('img', { name: 'JLTV media' })).toHaveAttribute('src', '/fallback.webp')
    expect(document.querySelector('video')).not.toBeInTheDocument()
  })

  it('loops muted inline video and falls back to the image on failure', () => {
    render(<HubCardMedia mode="video" imageSrc="/fallback.webp" videoSrc="/preview.mp4" alt="JLTV media" placeholderLabel="Placeholder video preview" />)
    const video = screen.getByLabelText('JLTV media') as HTMLVideoElement
    expect(video).toHaveAttribute('loop')
    expect(video).toHaveProperty('muted', true)
    expect(video).toHaveAttribute('playsinline')
    fireEvent.error(video)
    expect(document.querySelector('video')).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'JLTV media' })).toBeVisible()
    expect(screen.queryByText('Placeholder video preview')).not.toBeInTheDocument()
  })
})

