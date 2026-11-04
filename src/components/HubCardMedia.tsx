import { useEffect, useRef, useState } from 'react'

export type HubCardMediaMode = 'image' | 'video'

export function HubCardMedia({ mode, imageSrc, videoSrc, alt, placeholderLabel }: { mode: HubCardMediaMode; imageSrc: string; videoSrc?: string; alt: string; placeholderLabel?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const [videoFailed, setVideoFailed] = useState(false)
  const [inView, setInView] = useState(true)
  const [pageVisible, setPageVisible] = useState(() => document.visibilityState !== 'hidden')
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)

  useEffect(() => {
    if (!rootRef.current || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(entries => setInView(entries[0]?.isIntersecting ?? false), { threshold: .15 })
    observer.observe(rootRef.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const visibility = () => setPageVisible(document.visibilityState !== 'hidden')
    const motion = () => setReducedMotion(query?.matches ?? false)
    document.addEventListener('visibilitychange', visibility)
    query?.addEventListener('change', motion)
    return () => {
      document.removeEventListener('visibilitychange', visibility)
      query?.removeEventListener('change', motion)
    }
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (mode === 'video' && !videoFailed && inView && pageVisible && !reducedMotion) void video.play().catch(() => undefined)
    else video.pause()
  }, [mode, videoFailed, inView, pageVisible, reducedMotion])

  const showVideo = mode === 'video' && videoSrc && !videoFailed && !reducedMotion
  return <div className="hub-card-media" ref={rootRef}>
    <img src={imageSrc} alt={showVideo ? '' : alt} aria-hidden={showVideo ? 'true' : undefined} />
    {showVideo && <video ref={videoRef} src={videoSrc} poster={imageSrc} muted loop playsInline preload="metadata" onError={() => setVideoFailed(true)} aria-label={alt} />}
    {placeholderLabel && showVideo && <span className="hub-media-badge">{placeholderLabel}</span>}
  </div>
}

