import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { chromium } from 'playwright-core'

const port = Number(process.env.NEXUS_CMS_OFFLINE_E2E_PORT ?? 4184)
const baseURL = `http://127.0.0.1:${port}`
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port)], {
  cwd: new URL('..', import.meta.url),
  stdio: ['ignore', 'pipe', 'pipe'],
})

const waitForServer = async () => {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(baseURL)
      if (response.ok) return
    } catch { /* Preview is still starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('CMS offline PDF test server did not start.')
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] })
try {
  await waitForServer()
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'allow', reducedMotion: 'reduce' })
  const page = await context.newPage()
  page.setDefaultTimeout(15_000)
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })

  await page.goto(baseURL, { waitUntil: 'networkidle' })
  await page.getByLabel('Password').fill('nexus')
  await page.getByRole('button', { name: 'Enter site' }).click()
  await page.getByRole('button', { name: /touch screen to begin/i }).waitFor()
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller))
  await page.getByRole('button', { name: /touch screen to begin/i }).waitFor()

  assert.equal(await page.locator('.catalog-explorer').count(), 0, 'Explorer was opened before the cold-offline check')
  const precachedAssets = await page.evaluate(async () => {
    const names = await caches.keys()
    const urls = []
    for (const name of names) {
      const cache = await caches.open(name)
      urls.push(...(await cache.keys()).map((request) => request.url))
    }
    return urls
  })
  assert.ok(precachedAssets.some((url) => /pdf\.worker\.min-.*\.mjs$/.test(url)), 'PDF.js worker was not present in the fresh service-worker precache')
  assert.ok(precachedAssets.some((url) => url.endsWith('/assets/demo-overview.pdf')), 'Packaged PDF was not present in the fresh service-worker precache')

  await context.setOffline(true)
  await page.getByRole('button', { name: /touch screen to begin/i }).click()
  await page.getByRole('button', { name: /^Explorer/ }).click()
  await page.locator('.experience-loading').waitFor({ state: 'detached' })
  await page.getByRole('button', { name: 'Documents', exact: true }).click()
  await page.locator('.media-grid > button').first().click()
  const pdfCanvas = page.locator('canvas.media-asset-pdf')
  await pdfCanvas.waitFor({ state: 'visible' })
  await page.waitForFunction(() => {
    const canvas = document.querySelector('canvas.media-asset-pdf')
    if (!(canvas instanceof HTMLCanvasElement) || !canvas.width || !canvas.height) return false
    const context = canvas.getContext('2d')
    if (!context) return false
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index + 3] > 0 && (pixels[index] < 250 || pixels[index + 1] < 250 || pixels[index + 2] < 250)) return true
    }
    return false
  })
  assert.equal(await page.getByRole('alert').filter({ hasText: 'DOCUMENT UNAVAILABLE' }).count(), 0, 'Cold-offline PDF fell back to an error')
  assert.deepEqual(errors, [])

  console.log(JSON.stringify({ freshInstall: true, explorerUnopenedBeforeOffline: true, workerPrecached: true, pdfPrecached: true, coldOfflinePdfRendered: true, browserErrors: errors }))
  await context.close()
} finally {
  await browser.close()
  server.kill('SIGTERM')
}
