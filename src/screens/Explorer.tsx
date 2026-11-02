import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react'
import { catalogMarkets, type CatalogMedia, type CatalogProduct, type MediaKind } from '../content/catalog'
import { createEmailPreview } from '../services/emailTemplate'
import { enqueueRequest, listRequests, QueuePersistenceError } from '../services/requestQueue'

type Overlay = 'none' | 'share' | 'saved' | 'media'
type MediaFilter = 'all' | MediaKind

const emailProduct = (product: CatalogProduct) => ({ schemaVersion: 1 as const, id: product.id, marketId: product.marketId, name: product.name, designation: product.designation, description: product.description, heroLabel: product.heroVideoLabel, highlights: product.features.map((feature, order) => ({ order, text: feature.name })), features: product.features.map((feature, order) => ({ order, text: feature.description })), isFiller: true })

function TouchKeyboard({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const rows = ['1234567890-', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm,.@']
  return <div className="touch-keyboard" aria-label="Touch keyboard">{rows.map((row) => <div key={row}>{[...row].map((key) => <button type="button" key={key} onClick={() => onChange(value + key)} aria-label={`Type ${key}`}>{key}</button>)}</div>)}<div><button type="button" className="key-wide" onClick={() => onChange(value.slice(0, -1))}>Backspace</button><button type="button" className="key-space" onClick={() => onChange(value + ' ')}>Space</button></div></div>
}

function MediaPlaceholder({ media, zoom, page, playing }: { media: CatalogMedia; zoom: number; page: number; playing: boolean }) {
  return <div className={`media-placeholder media-${media.kind}`} style={{ '--media-accent': media.accent, '--media-zoom': zoom } as CSSProperties}><span>{media.kind === 'pdf' ? `DOCUMENT · PAGE ${page}` : media.kind === 'video' ? (playing ? 'PLAYING PLACEHOLDER VIDEO' : 'VIDEO PAUSED') : 'IMAGE PLACEHOLDER'}</span><strong>{media.name}</strong></div>
}

export function Explorer({ onExit }: { onExit: () => void }) {
  const accordionId = useId()
  const [openMarket, setOpenMarket] = useState('land')
  const [product, setProduct] = useState(catalogMarkets[0].products[0])
  const [openFeature, setOpenFeature] = useState(0)
  const [filter, setFilter] = useState<MediaFilter>('all')
  const [overlay, setOverlay] = useState<Overlay>('none')
  const [selectedMedia, setSelectedMedia] = useState<CatalogMedia>(product.media[0])
  const [zoom, setZoom] = useState(100)
  const [page, setPage] = useState(1)
  const [playing, setPlaying] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [activeField, setActiveField] = useState<'name' | 'email'>('name')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const closeRef = useRef<HTMLButtonElement>(null)
  const preview = useMemo(() => createEmailPreview(emailProduct(product)), [product])
  const visibleMedia = filter === 'all' ? product.media : product.media.filter((item) => item.kind === filter)
  useEffect(() => { void listRequests().then((items) => setPendingCount(items.length)) }, [])
  useEffect(() => { if (overlay !== 'none') closeRef.current?.focus() }, [overlay])
  const chooseProduct = (next: CatalogProduct) => { setProduct(next); setSelectedMedia(next.media[0]); setFilter('all'); setOpenFeature(0); setOverlay('none') }
  const openMedia = (media: CatalogMedia) => { setSelectedMedia(media); setZoom(100); setPage(1); setPlaying(false); setOverlay('media') }
  const submit = async () => {
    setError('')
    if (name.trim().length < 2) return setError('Enter a name with at least two characters.')
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Enter a valid email address.')
    setSubmitting(true)
    try { await enqueueRequest({ name, email, productId: product.id }); setPendingCount((await listRequests()).length); setOverlay('saved') }
    catch (failure) { setError(failure instanceof QueuePersistenceError && failure.reason === 'quota' ? 'This device storage is full. The request was not saved.' : 'Local storage is unavailable. The request was not saved.') }
    finally { setSubmitting(false) }
  }
  const keyboardValue = activeField === 'name' ? name : email
  const setKeyboardValue = activeField === 'name' ? setName : setEmail

  return <main id="main-content" className="catalog-explorer">
    <div className="catalog-body">
    <aside className="catalog-nav"><header><h1>Explorer</h1><p>Browse our catalogue of products and services, their related features, details, media and more.</p></header>
      <div className="market-accordion">{catalogMarkets.map((market) => {
        const expanded = openMarket === market.id
        const panelId = `${accordionId}-market-${market.id}`
        return <section key={market.id}>
          <button className="market-toggle" aria-expanded={expanded} aria-controls={panelId} onClick={() => setOpenMarket(current => current === market.id ? '' : market.id)}><span>{market.name}</span><b className="accordion-icon" aria-hidden="true" /></button>
          <div id={panelId} className={`accordion-panel ${expanded ? 'is-open' : ''}`} aria-hidden={!expanded} inert={!expanded}>
            <div className="accordion-content"><div className="product-list">{market.products.map((item) => <button key={item.id} className={product.id === item.id ? 'selected' : ''} onClick={() => chooseProduct(item)}><i style={{ background: item.media[0].accent }} /><span><strong>{item.name}</strong><small>{item.designation}</small></span></button>)}</div></div>
          </div>
        </section>
      })}</div><div className="pending-indicator" aria-label={`${pendingCount} locally saved requests`}>{pendingCount} pending · Sent 0</div></aside>
    <section className="catalog-information">
      <div className="catalog-hero"><div className="hero-media-placeholder" aria-label={product.heroVideoLabel}><span>{product.heroVideoLabel}</span></div><img className="explorer-mark" src="/assets/reference/leidos-mark-light.svg" alt="Leidos" /><div className="catalog-hero-copy"><p>{product.marketName} system</p><h2>{product.name}</h2><h3>{product.designation}</h3><p className="catalog-description">{product.description}</p><h4>Specifications</h4><div className="catalog-specs">{product.specs.map((spec) => <div key={spec.name}><b>{spec.name}</b><span>{spec.value}</span></div>)}</div><button className="outline-pill" onClick={() => setOverlay('share')}>Share <span>→</span></button></div></div>
      <div className="catalog-lower"><section className="catalog-features" aria-label="Product features">{product.features.map((feature, index) => {
        const expanded = openFeature === index
        const panelId = `${accordionId}-feature-${index}`
        return <article className="catalog-feature" key={feature.name}>
          <button aria-expanded={expanded} aria-controls={panelId} onClick={() => setOpenFeature(current => current === index ? -1 : index)}><span>{feature.name}</span><b className="accordion-icon" aria-hidden="true" /></button>
          <div id={panelId} className={`accordion-panel ${expanded ? 'is-open' : ''}`} aria-hidden={!expanded} inert={!expanded}><div className="accordion-content"><p>{feature.description}</p></div></div>
        </article>
      })}</section><section className="catalog-media" aria-label="Product media"><div className="media-tabs">{(['all', 'image', 'video', 'pdf'] as const).map((kind) => <button key={kind} className={filter === kind ? 'selected' : ''} onClick={() => setFilter(kind)}>{kind === 'all' ? 'All media' : kind === 'pdf' ? 'Documents' : `${kind}s`}</button>)}</div><div className="media-grid">{visibleMedia.map((media) => <button key={media.id} onClick={() => openMedia(media)}><div style={{ background: `linear-gradient(145deg, ${media.accent}, #191329)` }}><span>{media.kind}</span><i>◇</i></div><strong>{media.name}</strong></button>)}</div></section></div>
    </section>
    </div>
    <footer className="catalog-footer"><button className="back-to-hub" onClick={onExit}>← Back to hub</button></footer>
    {overlay !== 'none' && <div className="explorer-overlay">
      {overlay === 'media' && <section className="media-lightbox" role="dialog" aria-modal="true" aria-labelledby="media-title"><header><h2 id="media-title">{selectedMedia.name}</h2><p>{selectedMedia.description}</p></header><MediaPlaceholder media={selectedMedia} zoom={zoom} page={page} playing={playing} /><div className="viewer-controls">{selectedMedia.kind === 'image' && <><button aria-label="Zoom out" onClick={() => setZoom(Math.max(50, zoom - 25))}>−</button><span>{zoom}%</span><button aria-label="Zoom in" onClick={() => setZoom(Math.min(200, zoom + 25))}>+</button></>}{selectedMedia.kind === 'video' && <><button aria-label={playing ? 'Pause video' : 'Play video'} onClick={() => setPlaying(!playing)}>{playing ? 'Pause' : 'Play'}</button><span>00:00 / 00:30</span></>}{selectedMedia.kind === 'pdf' && <><button aria-label="Previous page" onClick={() => setPage(Math.max(1, page - 1))}>←</button><span>Page {page} / 4</span><button aria-label="Next page" onClick={() => setPage(Math.min(4, page + 1))}>→</button><button aria-label="Zoom out" onClick={() => setZoom(Math.max(50, zoom - 25))}>−</button><span>{zoom}%</span><button aria-label="Zoom in" onClick={() => setZoom(Math.min(200, zoom + 25))}>+</button></>}</div><div className="media-rail">{product.media.map((media) => <button key={media.id} aria-label={`View ${media.name}`} className={selectedMedia.id === media.id ? 'selected' : ''} onClick={() => { setSelectedMedia(media); setZoom(100); setPage(1); setPlaying(false) }}><span style={{ background: media.accent }}>{media.kind}</span></button>)}</div><button ref={closeRef} className="lightbox-close outline-pill" onClick={() => setOverlay('none')}>Close</button></section>}
      {(overlay === 'share' || overlay === 'saved') && <section className="share-lightbox" role="dialog" aria-modal="true" aria-labelledby="share-title"><header><h2 id="share-title">Share</h2><p>To receive more information regarding this product please fill out the following information.</p></header><button ref={closeRef} className="overlay-x" onClick={() => setOverlay('none')} aria-label="Close share dialog">×</button>{overlay === 'share' ? <><div className="share-form" data-email-subject={preview.subject}><label>Full name<input aria-label="Name" value={name} onFocus={() => setActiveField('name')} onChange={(event) => setName(event.target.value)} /></label><label>Email address<input aria-label="Email" type="email" value={email} onFocus={() => setActiveField('email')} onChange={(event) => setEmail(event.target.value)} /></label>{error && <p role="alert">{error}</p>}<button className="outline-pill" onClick={submit} disabled={submitting}>{submitting ? 'Saving…' : 'Submit'} <span>→</span></button></div><TouchKeyboard value={keyboardValue} onChange={setKeyboardValue} /></> : <div className="share-saved"><h3>Request saved locally.</h3><p>Pending — email service not configured. It has not been sent or delivered.</p><button className="outline-pill" onClick={() => { setName(''); setEmail(''); setOverlay('none') }}>Return to Explorer</button></div>}</section>}
    </div>}
  </main>
}
