import { useEffect, useRef, useState } from 'react'
import { HubCardMedia, type HubCardMediaMode } from '../components/HubCardMedia'

export function Selector({ onJLTV, onExplorer, jltvDisabled = false, animateEntrance = false, jltvMediaMode = 'video' }: { onJLTV: () => void; onExplorer: () => void; onReset: () => void; jltvDisabled?: boolean; animateEntrance?: boolean; jltvMediaMode?: HubCardMediaMode }) {
  const carouselRef = useRef<HTMLElement>(null)
  const [edges, setEdges] = useState({ start: true, end: false })

  useEffect(() => {
    const carousel = carouselRef.current
    if (!carousel) return
    const updateEdges = () => setEdges({
      start: carousel.scrollLeft <= 1,
      end: carousel.scrollLeft + carousel.clientWidth >= carousel.scrollWidth - 1,
    })
    const observer = new ResizeObserver(updateEdges)
    observer.observe(carousel)
    Array.from(carousel.children).forEach(card => observer.observe(card))
    carousel.addEventListener('scroll', updateEdges, { passive: true })
    updateEdges()
    return () => {
      observer.disconnect()
      carousel.removeEventListener('scroll', updateEdges)
    }
  }, [])

  const moveCards = (direction: number) => {
    const carousel = carouselRef.current
    if (!carousel) return
    const positions = Array.from(carousel.children).map(card => (card as HTMLElement).offsetLeft)
    const target = direction > 0
      ? positions.find(position => position > carousel.scrollLeft + 2) ?? carousel.scrollWidth
      : positions.reverse().find(position => position < carousel.scrollLeft - 2) ?? 0
    carousel.scrollTo({ left: target, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }

  return <main id="main-content" className={`reference-hub ${animateEntrance ? 'is-entering-from-attract' : ''}`}>
    <img className="reference-logo" src="/assets/reference/leidos-logo-light.svg" alt="Leidos" />
    <h1>Choose an Experience</h1>
    <div className="hub-experiences">
    <section id="experience-cards" className="hub-carousel" ref={carouselRef} tabIndex={0} aria-label="Experience modules">
      <button className={`hub-card hub-card-primary ${jltvDisabled ? 'disabled' : ''}`} onClick={onJLTV} disabled={jltvDisabled}><HubCardMedia mode={jltvMediaMode} imageSrc="/assets/jltv-card.webp" videoSrc="/assets/nexus-placeholder-loop.mp4" alt="JLTV platform media" placeholderLabel={jltvMediaMode === 'video' ? 'Placeholder video preview' : undefined} /><span className="hub-gradient" /><div className="hub-card-content"><h2>JLTV</h2><p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer consequat viverra efficitur.</p><b className="outline-pill">{jltvDisabled ? 'Disabled' : 'Explore'} <i>→</i></b></div></button>
      <article className="hub-card"><span className="pending-card-art" /><span className="hub-gradient" /><div className="hub-card-content"><h2>Platform 02</h2><p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vehicle selection pending.</p><b className="outline-pill">Coming soon</b></div></article>
      <article className="hub-card"><span className="pending-card-art alternate" /><span className="hub-gradient" /><div className="hub-card-content"><h2>Platform 03</h2><p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vehicle selection pending.</p><b className="outline-pill">Coming soon</b></div></article>
    </section>
    <div className="hub-arrows" role="group" aria-label="Browse experiences"><button aria-label="Previous experience" aria-controls="experience-cards" disabled={edges.start} onClick={() => moveCards(-1)}>←</button><button aria-label="Next experience" aria-controls="experience-cards" disabled={edges.end} onClick={() => moveCards(1)}>→</button></div>
    </div>
    <button className="hub-explorer" onClick={onExplorer}>Explorer <span>→</span></button>
  </main>
}
