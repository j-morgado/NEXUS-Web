import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { chromium } from 'playwright-core'

const port = Number(process.env.NEXUS_CMS_E2E_PORT ?? 4183)
const baseURL = `http://127.0.0.1:${port}`
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port)], {
  cwd: new URL('..', import.meta.url),
  env: {
    ...process.env,
    VITE_NEXUS_CMS_CATALOG_URL: '/qa/catalog.json',
    VITE_NEXUS_CMS_EVENT_ID: 'qa-event',
    VITE_NEXUS_CMS_PUBLICATION_ID: 'qa-publication',
    VITE_NEXUS_CMS_MODE: 'production',
    VITE_NEXUS_CMS_CACHE_MAX_AGE_SECONDS: '3600',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})

const waitForServer = async () => {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(baseURL)
      if (response.ok) return
    } catch { /* Vite is still starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('CMS adversarial test server did not start.')
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] })
try {
  await waitForServer()
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' })
  const page = await context.newPage()
  page.setDefaultTimeout(12_000)
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))

  let cmsStatus = 200
  let cmsPayload
  await page.route('**/qa/catalog.json', (route) => cmsStatus === 200
    ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(cmsPayload) })
    : route.fulfill({ status: cmsStatus, contentType: 'application/json', body: '{}' }))

  await page.goto(baseURL)
  await page.getByLabel('Password').fill('nexus')
  await page.getByRole('button', { name: 'Enter site' }).click()
  await page.getByRole('button', { name: /touch screen to begin/i }).click()

  const baseCatalog = await page.evaluate(async () => structuredClone((await import('/src/content/catalog.ts')).packagedCatalog))
  const makePayload = (approvalStatus) => {
    const catalog = structuredClone(baseCatalog)
    catalog.publicationId = 'qa-publication'
    catalog.approvalStatus = approvalStatus
    catalog.publicationState = 'published'
    for (const product of catalog.markets.flatMap((market) => market.products)) product.isFiller = false
    return catalog
  }
  const cacheCount = () => page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('nexus-explorer-content-v2')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result
      const count = db.transaction('publications').objectStore('publications').count()
      count.onerror = () => reject(count.error)
      count.onsuccess = () => resolve(count.result)
    }
  }))
  const enterExplorer = async () => {
    await page.getByRole('button', { name: /^Explorer/ }).click()
    await page.locator('.experience-loading').waitFor({ state: 'detached' })
  }
  const returnToHub = async () => {
    await page.getByRole('button', { name: /Back to hub/i }).click()
    await page.locator('.experience-loading').waitFor({ state: 'detached' })
  }

  cmsPayload = makePayload('demonstration')
  await enterExplorer()
  assert.match(await page.locator('.catalog-source-notice').innerText(), /not editorially approved/i)
  assert.equal(await cacheCount(), 0, 'Unapproved remote content entered the production cache')
  await returnToHub()

  cmsPayload = makePayload('approved')
  await enterExplorer()
  assert.equal(await page.locator('.catalog-source-notice').count(), 0, 'Approved production content was incorrectly labeled as demonstration')
  assert.equal(await cacheCount(), 1, 'Approved scoped publication was not cached')

  await page.getByRole('button', { name: 'Documents', exact: true }).click()
  await page.locator('.media-grid > button').first().click()
  const pdfCanvas = page.locator('canvas.media-asset-pdf')
  await pdfCanvas.waitFor({ state: 'visible' })
  const renderedPdf = await pdfCanvas.evaluate((canvas) => {
    const context = canvas.getContext('2d')
    if (!context) return { width: canvas.width, height: canvas.height, nonWhitePixels: 0 }
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
    let nonWhitePixels = 0
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index + 3] > 0 && (pixels[index] < 250 || pixels[index + 1] < 250 || pixels[index + 2] < 250)) nonWhitePixels += 1
    }
    return { width: canvas.width, height: canvas.height, nonWhitePixels }
  })
  assert.ok(renderedPdf.width > 0 && renderedPdf.height > 0, 'Valid PDF canvas has no render dimensions')
  assert.ok(renderedPdf.nonWhitePixels > 0, 'Valid PDF canvas contains no rendered document content')
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await page.locator('.media-overlay').waitFor({ state: 'detached' })

  await page.route('**/assets/demo-overview.pdf', (route) => route.fulfill({ status: 404, contentType: 'text/html', body: 'missing' }))
  await page.getByRole('button', { name: 'Documents', exact: true }).click()
  await page.locator('.media-grid > button').first().click()
  assert.match(await page.getByRole('alert').innerText(), /HTTP 404/)
  assert.equal(await page.locator('.media-asset-pdf').count(), 0, 'A failed/non-validated document was embedded')
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await page.locator('.media-overlay').waitFor({ state: 'detached' })
  await returnToHub()

  cmsStatus = 410
  await enterExplorer()
  assert.match(await page.locator('.catalog-source-notice').innerText(), /retired.*invalidated/i)
  assert.equal(await cacheCount(), 0, 'HTTP 410 left retired products in the scoped cache')
  assert.deepEqual(errors, [])

  console.log(JSON.stringify({ unapprovedRejected: true, unapprovedCacheEntries: 0, approvedCached: true, validPdfCanvasRendered: true, pdf404AccessibleError: true, untrustedPdfEmbedded: false, http410Invalidated: true, browserErrors: errors }))
  await context.close()
} finally {
  await browser.close()
  server.kill('SIGTERM')
}

