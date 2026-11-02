import type { Product } from '../domain/schemas'

const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]!)

export function createEmailPreview(product: Product) {
  const highlights = [...product.highlights].sort((a, b) => a.order - b.order)
  const text = `${product.name}\n${product.designation}\n\n${product.description}\n\nHighlights\n${highlights.map((item) => `• ${item.text}`).join('\n')}\n\nDemonstration content — final product-approved material pending.`
  const html = `<main style="font-family:Arial,sans-serif;background:#0d0f17;color:#fff;padding:32px"><p style="color:#b8ff39;letter-spacing:.15em">NEXUS FOLLOW-UP</p><h1>${escapeHtml(product.name)}</h1><p>${escapeHtml(product.description)}</p><h2>Highlights</h2><ul>${highlights.map((item) => `<li>${escapeHtml(item.text)}</li>`).join('')}</ul><p><strong>Demonstration content — final product-approved material pending.</strong></p>${product.learnMoreUrl ? `<a href="${escapeHtml(product.learnMoreUrl)}" style="color:#b8ff39">Learn more</a>` : ''}</main>`
  return { subject: `${product.name} · NEXUS follow-up`, html, text }
}
