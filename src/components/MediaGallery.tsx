import { useLayoutEffect, useRef, useState } from 'react'
import type { CatalogMedia, MediaKind } from '../content/catalog'

type MediaFilter = 'all' | MediaKind

export function MediaGallery({ items, onOpen }: { items: CatalogMedia[]; onOpen: (media: CatalogMedia) => void }) {
  const [filter, setFilter] = useState<MediaFilter>('all')
  const gridRef = useRef<HTMLDivElement>(null)
  const positions = useRef(new Map<string, DOMRect>())
  const animations = useRef<Animation[]>([])
  const visible = filter === 'all' ? items : items.filter(item => item.kind === filter)

  const changeFilter = (next: MediaFilter) => {
    if (next === filter) return
    // Capture the current visual positions, including an interrupted animation.
    positions.current = new Map(Array.from(gridRef.current?.querySelectorAll<HTMLElement>('[data-media-id]') ?? []).map(tile => [tile.dataset.mediaId!, tile.getBoundingClientRect()]))
    setFilter(next)
  }

  useLayoutEffect(() => {
    animations.current.forEach(animation => animation.cancel())
    animations.current = []
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!reducedMotion) {
      let entering = 0
      gridRef.current?.querySelectorAll<HTMLElement>('[data-media-id]').forEach(tile => {
        const before = positions.current.get(tile.dataset.mediaId!)
        const after = tile.getBoundingClientRect()
        if (before) {
          const x = before.left - after.left, y = before.top - after.top
          if (Math.abs(x) > .5 || Math.abs(y) > .5) animations.current.push(tile.animate([
            { transform: `translate(${x}px, ${y}px)` }, { transform: 'translate(0, 0)' },
          ], { duration: 600, easing: 'cubic-bezier(.22, 1, .36, 1)' }))
        } else {
          animations.current.push(tile.animate([
            { opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'translateY(0)' },
          ], { duration: 630, delay: entering++ * 82.5, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'backwards' }))
        }
      })
    }
    positions.current.clear()
    return () => { animations.current.forEach(animation => animation.cancel()) }
  }, [filter, items])

  return <section className="catalog-media" aria-label="Product media">
    <div className="media-tabs">{(['all', 'image', 'video', 'pdf'] as const).map(kind => <button key={kind} aria-pressed={filter === kind} className={filter === kind ? 'selected' : ''} onClick={() => changeFilter(kind)}>{kind === 'all' ? 'All media' : kind === 'pdf' ? 'Documents' : `${kind}s`}</button>)}</div>
    <div className="media-grid" ref={gridRef}>{visible.map(media => <button key={media.id} data-media-id={media.id} onClick={() => onOpen(media)}><div style={{ background: `linear-gradient(145deg, ${media.accent}, #191329)` }}><span>{media.kind}</span><i>◇</i></div><strong>{media.name}</strong></button>)}</div>
  </section>
}
