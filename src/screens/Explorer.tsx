import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { MediaGallery } from '../components/MediaGallery'
import { MediaViewer } from '../components/MediaViewer'
import { catalogMarkets, type CatalogMedia, type CatalogProduct } from '../content/catalog'
import { createEmailPreview } from '../services/emailTemplate'
import { enqueueRequest, QueuePersistenceError } from '../services/requestQueue'

type Overlay = 'none' | 'share' | 'saved' | 'media'

const emailProduct = (product: CatalogProduct) => ({ schemaVersion: 1 as const, id: product.id, marketId: product.marketId, name: product.name, designation: product.designation, description: product.description, heroLabel: product.heroVideoLabel, highlights: product.features.map((feature, order) => ({ order, text: feature.name })), features: product.features.map((feature, order) => ({ order, text: feature.description })), isFiller: true })

function TouchKeyboard({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const rows = ['1234567890-', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm,.@']
  return <div className="touch-keyboard" aria-label="Touch keyboard">{rows.map((row) => <div key={row}>{[...row].map((key) => <button type="button" key={key} onClick={() => onChange(value + key)} aria-label={`Type ${key}`}>{key}</button>)}</div>)}<div><button type="button" className="key-wide" onClick={() => onChange(value.slice(0, -1))}>Backspace</button><button type="button" className="key-space" onClick={() => onChange(value + ' ')}>Space</button></div></div>
}

export function Explorer({ onExit }: { onExit: () => void }) {
  const accordionId = useId()
  const [openMarket, setOpenMarket] = useState('land')
  const [product, setProduct] = useState(catalogMarkets[0].products[0])
  const [openFeature, setOpenFeature] = useState(0)
  const [overlay, setOverlay] = useState<Overlay>('none')
  const [selectedMedia, setSelectedMedia] = useState<CatalogMedia>(product.media[0])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [activeField, setActiveField] = useState<'name' | 'email'>('name')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)
  const preview = useMemo(() => createEmailPreview(emailProduct(product)), [product])
  useEffect(() => { if (overlay !== 'none') closeRef.current?.focus() }, [overlay])
  const chooseProduct = (next: CatalogProduct) => { setProduct(next); setSelectedMedia(next.media[0]); setOpenFeature(0); setOverlay('none') }
  const openMedia = (media: CatalogMedia) => { setSelectedMedia(media); setOverlay('media') }
  const closeMedia = useCallback(() => setOverlay('none'), [])
  const submit = async () => {
    setError('')
    if (name.trim().length < 2) return setError('Enter a name with at least two characters.')
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Enter a valid email address.')
    setSubmitting(true)
    try { await enqueueRequest({ name, email, productId: product.id }); setOverlay('saved') }
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
      })}</div></aside>
    <div className="catalog-product">
    <section className="catalog-information">
      <div className="catalog-hero"><div className="hero-media-placeholder" role="img" aria-label={product.heroVideoLabel} /><img className="explorer-mark" src="/assets/reference/leidos-mark-light.svg" alt="Leidos" /><div className="catalog-hero-copy"><p>{product.marketName} system</p><h2>{product.name}</h2><h3>{product.designation}</h3><p className="catalog-description">{product.description}</p></div><div className="catalog-hero-footer"><section className="catalog-specifications" aria-label="Specifications"><h4>Specifications</h4><div className="catalog-specs">{product.specs.map((spec) => <div key={spec.name}><b>{spec.name}</b><span>{spec.value}</span></div>)}</div></section><button className="outline-pill" onClick={() => setOverlay('share')}>Share <span>→</span></button></div></div>
      <div className="catalog-lower"><section className="catalog-features" aria-label="Product features">{product.features.map((feature, index) => {
        const expanded = openFeature === index
        const panelId = `${accordionId}-feature-${index}`
        return <article className="catalog-feature" key={feature.name}>
          <button aria-expanded={expanded} aria-controls={panelId} onClick={() => setOpenFeature(current => current === index ? -1 : index)}><span>{feature.name}</span><b className="accordion-icon" aria-hidden="true" /></button>
          <div id={panelId} className={`accordion-panel ${expanded ? 'is-open' : ''}`} aria-hidden={!expanded} inert={!expanded}><div className="accordion-content"><p>{feature.description}</p></div></div>
        </article>
      })}</section><MediaGallery key={product.id} items={product.media} onOpen={openMedia} /></div>
    </section>
    <footer className="catalog-footer"><button className="back-to-hub" onClick={onExit}>← Back to hub</button></footer>
    </div>
    </div>
    {overlay !== 'none' && <div className="explorer-overlay">
      {overlay === 'media' && <MediaViewer media={selectedMedia} items={product.media} onSelect={setSelectedMedia} onClose={closeMedia} />}
      {(overlay === 'share' || overlay === 'saved') && <section className="share-lightbox" role="dialog" aria-modal="true" aria-labelledby="share-title"><header><h2 id="share-title">Share</h2><p>To receive more information regarding this product please fill out the following information.</p></header><button ref={closeRef} className="overlay-x" onClick={() => setOverlay('none')} aria-label="Close share dialog">×</button>{overlay === 'share' ? <><div className="share-form" data-email-subject={preview.subject}><label>Full name<input aria-label="Name" value={name} onFocus={() => setActiveField('name')} onChange={(event) => setName(event.target.value)} /></label><label>Email address<input aria-label="Email" type="email" value={email} onFocus={() => setActiveField('email')} onChange={(event) => setEmail(event.target.value)} /></label>{error && <p role="alert">{error}</p>}<button className="outline-pill" onClick={submit} disabled={submitting}>{submitting ? 'Saving…' : 'Submit'} <span>→</span></button></div><TouchKeyboard value={keyboardValue} onChange={setKeyboardValue} /></> : <div className="share-saved"><h3>Request saved locally.</h3><p>Pending — email service not configured. It has not been sent or delivered.</p><button className="outline-pill" onClick={() => { setName(''); setEmail(''); setOverlay('none') }}>Return to Explorer</button></div>}</section>}
    </div>}
  </main>
}
