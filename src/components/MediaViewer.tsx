/* eslint-disable react-hooks/set-state-in-effect -- Selecting a different media item intentionally resets all viewer controls as one transaction. */
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import type { CatalogMedia } from '../content/catalog'

type Props = { media: CatalogMedia; items: CatalogMedia[]; onSelect: (media: CatalogMedia) => void; onClose: () => void }
const timeLabel = (time: number) => `${Math.floor(time / 60).toString().padStart(2, '0')}:${Math.floor(time % 60).toString().padStart(2, '0')}`

export function MediaViewer({ media, items, onSelect, onClose }: Props) {
  const titleId = useId()
  const frameRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const panRef = useRef<{ pointerId: number; x: number; y: number; left: number; top: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const [zoom, setZoom] = useState(100)
  const [page, setPage] = useState(1)
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [nativeFullscreen, setNativeFullscreen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [error, setError] = useState('')
  const fullscreen = nativeFullscreen || expanded
  const pageCount = media.pageCount ?? 1

  useEffect(() => {
    const previousFocus = document.activeElement
    const frame = frameRef.current
    closeRef.current?.focus()
    const changed = () => setNativeFullscreen(document.fullscreenElement === frame)
    document.addEventListener('fullscreenchange', changed)
    return () => {
      document.removeEventListener('fullscreenchange', changed)
      const restore = () => { if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true }) }
      if (document.fullscreenElement === frame) void document.exitFullscreen().then(restore, restore)
      else restore()
    }
  }, [])
  useEffect(() => {
    setZoom(100); setPage(1); setPlaying(false); setCurrentTime(0); setDuration(0); setError('')
    videoRef.current?.pause()
    if (videoRef.current) videoRef.current.currentTime = 0
  }, [media.id])
  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (viewport) {
      viewport.scrollLeft = Math.max(0, (viewport.scrollWidth - viewport.clientWidth) / 2)
      viewport.scrollTop = Math.max(0, (viewport.scrollHeight - viewport.clientHeight) / 2)
    }
  }, [zoom, media.id])

  const startPan = (event: PointerEvent<HTMLDivElement>) => {
    const viewport = event.currentTarget
    // Touch keeps native scrolling and momentum; pointer capture keeps mouse drags
    // attached to the viewer even when the cursor leaves its bounds.
    if (media.kind === 'video' || zoom <= 100 || event.button !== 0 || event.pointerType === 'touch') return
    if (viewport.scrollWidth <= viewport.clientWidth && viewport.scrollHeight <= viewport.clientHeight) return
    event.preventDefault()
    viewport.focus({ preventScroll: true })
    viewport.setPointerCapture(event.pointerId)
    panRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop }
    setDragging(true)
  }
  const movePan = (event: PointerEvent<HTMLDivElement>) => {
    const pan = panRef.current
    if (!pan || pan.pointerId !== event.pointerId) return
    event.currentTarget.scrollLeft = pan.left - (event.clientX - pan.x)
    event.currentTarget.scrollTop = pan.top - (event.clientY - pan.y)
  }
  const endPan = (event: PointerEvent<HTMLDivElement>) => {
    if (panRef.current?.pointerId !== event.pointerId) return
    panRef.current = null
    setDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const toggleFullscreen = async () => {
    if (document.fullscreenElement === frameRef.current) { await document.exitFullscreen(); return }
    if (expanded) { setExpanded(false); return }
    try {
      if (!frameRef.current?.requestFullscreen) { setExpanded(true); return }
      await frameRef.current.requestFullscreen()
    } catch { setExpanded(true) }
  }
  const toggleVideo = async () => {
    const video = videoRef.current
    if (!video) return
    if (!video.paused) { video.pause(); return }
    if (video.ended) video.currentTime = 0
    try { await video.play(); setError('') } catch { setError('Unable to play this video. Please try again.') }
  }
  const zoomControls = <>
    <button aria-label="Zoom out" disabled={zoom <= 50} onClick={() => setZoom(value => Math.max(50, value - 25))}>−</button>
    <span className="zoom-value" aria-live="polite">{zoom}%</span>
    <button aria-label="Zoom in" disabled={zoom >= 200} onClick={() => setZoom(value => Math.min(200, value + 25))}>+</button>
    <button onClick={() => setZoom(100)} aria-label="Fit media to viewer">Fit</button>
  </>

  return <section className="media-lightbox" role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={event => {
    if (event.key === 'Escape') {
      if (expanded) { event.stopPropagation(); setExpanded(false) }
      else if (!document.fullscreenElement) { event.stopPropagation(); onClose() }
    }
    if (event.key === 'Tab') {
      const scope = document.fullscreenElement === frameRef.current || expanded ? frameRef.current : event.currentTarget
      const buttons = Array.from(scope?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]') ?? []).filter(element => element.getClientRects().length)
      const first = buttons[0], last = buttons[buttons.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
  }}>
    <header><h2 id={titleId}>{media.name}</h2><p>{media.description}</p></header>
    <div ref={frameRef} className={`media-viewer ${expanded ? 'is-expanded' : ''}`} role="region" aria-label={`${media.name} viewing area`}>
      <div className={`media-viewport ${media.kind !== 'video' && zoom > 100 ? 'is-pannable' : ''} ${dragging ? 'is-panning' : ''}`} ref={viewportRef} onPointerDown={startPan} onPointerMove={movePan} onPointerUp={endPan} onPointerCancel={endPan} onLostPointerCapture={endPan} onDragStart={event => event.preventDefault()} role={media.kind === 'video' ? undefined : 'region'} tabIndex={media.kind === 'video' ? undefined : 0} aria-label={media.kind === 'video' ? undefined : 'Zoomed media, drag or scroll to pan'}>
        {media.kind === 'video' ? <div className="media-video-stage">
          <video key={media.id} ref={videoRef} src={media.url} poster={media.thumbnailUrl} playsInline preload="metadata" aria-label={media.name}
            onLoadedMetadata={event => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
            onDurationChange={event => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
            onTimeUpdate={event => setCurrentTime(event.currentTarget.currentTime)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onError={() => setError('Video could not be loaded.')} />
          <span className="media-video-label">{playing ? 'Playing video' : 'Video'}</span>
        </div> : <div className="media-zoom-stage" style={{ '--media-scale': zoom / 100, '--media-extent': Math.max(1, zoom / 100) } as CSSProperties}>
          <div className="media-surface">{error ? <div className={`media-placeholder media-${media.kind}`} style={{ '--media-accent': media.accent } as CSSProperties}><span>MEDIA UNAVAILABLE</span><strong>{media.name}</strong></div> : media.kind === 'image' ? <img className="media-asset-image" src={media.url} alt={media.description} onError={() => setError('Image could not be loaded.')} /> : <iframe key={`${media.id}-${page}`} className="media-asset-pdf" src={`${media.url}#page=${page}&view=FitH`} title={`${media.name}, page ${page}`} onError={() => setError('Document could not be loaded.')} />}</div>
        </div>}
      </div>
      <div className="viewer-controls" role="group" aria-label={`${media.kind === 'pdf' ? 'PDF' : media.kind === 'video' ? 'Video' : 'Image'} viewing controls`}>
        {media.kind === 'image' && zoomControls}
        {media.kind === 'pdf' && <><button aria-label="Previous page" disabled={page <= 1} onClick={() => setPage(value => Math.max(1, value - 1))}>←</button><span className="page-value" aria-live="polite">Page {page} / {pageCount}</span><button aria-label="Next page" disabled={page >= pageCount} onClick={() => setPage(value => Math.min(pageCount, value + 1))}>→</button>{zoomControls}<a className="viewer-open-media" href={media.url} target="_blank" rel="noreferrer">Open document</a></>}
        {media.kind === 'video' && <><button aria-label={playing ? 'Pause video' : 'Play video'} onClick={() => void toggleVideo()}>{playing ? 'Pause' : 'Play'}</button><span className="video-time">{timeLabel(currentTime)} / {timeLabel(duration)}</span><input className="video-scrubber" type="range" aria-label="Video playback position" aria-valuetext={`${timeLabel(currentTime)} of ${timeLabel(duration)}`} min={0} max={duration || 0} step={.01} value={Math.min(currentTime, duration)} disabled={!duration} onChange={event => { const time = Number(event.target.value); if (videoRef.current) videoRef.current.currentTime = time; setCurrentTime(time) }} /></>}
        <button className="viewer-fullscreen" aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} aria-pressed={fullscreen} onClick={() => void toggleFullscreen()}><span aria-hidden="true">{fullscreen ? '⤡' : '⤢'}</span> {fullscreen ? 'Exit fullscreen' : 'Fullscreen'}</button>
      </div>
      {error && <p className="media-error" role="status">{error}</p>}
    </div>
    <div className="media-viewer-footer"><div className="media-rail" role="group" aria-label="Available media">{items.map(item => <button key={item.id} aria-label={`View ${item.name}`} aria-pressed={media.id === item.id} className={media.id === item.id ? 'selected' : ''} onClick={() => onSelect(item)}><span style={{ background: item.accent }}>{item.kind}</span></button>)}</div><button ref={closeRef} className="lightbox-close outline-pill" onClick={onClose}>Close</button></div>
  </section>
}
