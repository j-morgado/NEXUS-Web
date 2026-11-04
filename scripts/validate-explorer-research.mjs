import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const path = new URL('../research/leidos-explorer-research.json', import.meta.url)
const research = JSON.parse(await readFile(path, 'utf8'))

assert.equal(research.schemaVersion, 'nexus-research-catalog-v1')
assert.match(research.purpose, /not approved/i)
assert.equal(research.products.length, 31)
assert(research.sources.length > 0)
assert(research.products.every((product) => product.editorialState === 'draft' && product.publicationReady === false))

const mxr = research.products.find((product) => product.id === 'mxr')
assert(mxr, 'MXR research record is required')
assert.match(mxr.description, /radar/i)
assert(mxr.uncertainties.some((note) => /JLTV-specific mounting.*not verified/i.test(note)))

const heldNames = research.excludedOrHeld.map((item) => item.name).join(' | ')
assert.match(heldNames, /GeoRover/)
assert.match(heldNames, /SES products/)
assert.match(heldNames, /VACIS/)

const assets = research.products.flatMap((product) => product.assets)
assert.equal(assets.length, 31)
assert(assets.every((asset) => asset.publishByDefault === false))
assert(assets.every((asset) => /unverified/i.test(asset.rightsStatus)))

console.log(JSON.stringify({ products: research.products.length, sources: research.sources.length, assets: assets.length, editorialState: 'draft', publicationReady: false, mediaReuseCleared: false }))

