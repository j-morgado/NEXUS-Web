import { chromium } from 'playwright-core'
import axe from 'axe-core'

const baseURL = process.env.NEXUS_PREVIEW_URL ?? 'http://127.0.0.1:4177'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--use-gl=swiftshader'] })
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, serviceWorkers: 'allow', reducedMotion: 'reduce' })
const page = await context.newPage()
const browserErrors = []
const audits = []
page.on('pageerror', (error) => browserErrors.push(error.message))
page.on('console', (message) => { if (message.type() === 'error') browserErrors.push(message.text()) })

async function audit(name) {
  await page.addScriptTag({ content: axe.source })
  const result = await page.evaluate(async () => window.axe.run(document, { resultTypes: ['violations'], rules: { 'color-contrast': { enabled: true } } }))
  const blocking = result.violations.filter((violation) => ['critical', 'serious'].includes(violation.impact))
  audits.push({ name, violations: blocking.map(({ id, impact, nodes }) => ({ id, impact, nodes: nodes.length })) })
}

await page.goto(baseURL, { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts.ready)
await audit('attract')
await page.keyboard.press('Tab')
if (await page.evaluate(() => document.activeElement?.textContent?.trim()) !== 'Skip to main content') throw new Error('Skip link is not first in keyboard order')
await page.keyboard.press('Enter')
await page.getByRole('button', { name: /touch screen to begin/i }).click()
await audit('selector')

await page.keyboard.press('Control+Shift+o')
await page.getByRole('dialog', { name: /local event settings/i }).waitFor()
if (await page.evaluate(() => document.activeElement?.getAttribute('aria-label')) !== 'Close operator controls') throw new Error('Operator dialog did not receive focus')
await audit('operator')
await page.keyboard.press('Escape')
await page.getByRole('dialog', { name: /local event settings/i }).waitFor({ state: 'detached' })

// Operator disable persists across a full page restart and remains reversible.
await page.keyboard.press('Control+Shift+o')
await page.getByLabel(/disable JLTV module/i).check()
await page.waitForFunction(async () => {
  const open = indexedDB.open('nexus-configuration-v1', 1)
  const db = await new Promise((resolve, reject) => { open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error) })
  const tx = db.transaction('settings', 'readonly')
  const request = tx.objectStore('settings').get('operatorSettings')
  const value = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
  db.close()
  return value?.locallyDisabledModuleIds?.includes('jltv')
})
await page.reload({ waitUntil: 'networkidle' })
await page.getByRole('button', { name: /touch screen to begin/i }).click()
if (!(await page.locator('.platform-card.locally-disabled').isDisabled())) throw new Error('Local module disable did not survive restart')
await page.keyboard.press('Control+Shift+o')
await page.getByLabel(/disable JLTV module/i).uncheck()
await page.keyboard.press('Escape')

// Install two valid local bundles and prove operator rollback changes the active pointer.
await page.evaluate(async () => {
  const open = indexedDB.open('nexus-configuration-v1', 1)
  const db = await new Promise((resolve, reject) => { open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error) })
  const make = async (version, previousBundleVersion) => {
    const config = { schemaVersion: 1, id: 'nexus-demo-event', version, inactivitySeconds: 120, warningSeconds: 5, enabledModuleIds: ['jltv'], activeBundleVersion: `jltv-${version}`, previousBundleVersion }
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(config)))
    const checksum = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
    return { key: `${config.id}@${version}`, config, checksum, installedAt: new Date().toISOString() }
  }
  const previous = await make('0.1.0', null)
  const active = await make('0.2.0', 'jltv-0.1.0')
  const tx = db.transaction(['configs', 'settings'], 'readwrite')
  tx.objectStore('configs').put(previous)
  tx.objectStore('configs').put(active)
  tx.objectStore('settings').put(active.key, 'activeConfigKey')
  tx.objectStore('settings').put(previous.key, 'previousConfigKey')
  await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error) })
  db.close()
})
await page.reload({ waitUntil: 'networkidle' })
await page.keyboard.press('Control+Shift+o')
await page.getByText('0.2.0', { exact: true }).waitFor()
await page.getByRole('button', { name: /roll back to previous/i }).click()
await page.getByText('0.1.0', { exact: true }).waitFor()
await page.keyboard.press('Escape')
await page.getByRole('button', { name: /touch screen to begin/i }).click()

await page.getByRole('button', { name: /explore products/i }).click()
await page.getByRole('button', { name: /share overview/i }).click()
await page.getByRole('dialog', { name: /take the overview/i }).waitFor()
if (await page.evaluate(() => document.activeElement?.getAttribute('aria-label')) !== 'Close follow-up request') throw new Error('Follow-up dialog did not receive focus')
await audit('explorer-modal')
await page.keyboard.press('Control+Shift+o')
await page.getByRole('button', { name: /reset to attract/i }).click()
await page.getByRole('button', { name: /touch screen to begin/i }).waitFor()

await page.getByRole('button', { name: /touch screen to begin/i }).click()
await page.locator('.platform-card.active').click()
await page.getByText('JLTV CONFIGURATOR').waitFor()
await page.locator('.model-marker').waitFor()
await page.waitForFunction(() => Number.parseFloat(getComputedStyle(document.querySelector('.model-marker')).opacity) > 0, null, { timeout: 15000 })
await page.locator('.model-marker').click()
await page.getByRole('button', { name: /close hotspot/i }).waitFor()
if (await page.locator('.model-stage').getAttribute('data-camera-transitioning') === 'true') throw new Error('Reduced-motion camera transition remained animated')
await audit('configurator-hotspot')

const registration = await page.evaluate(async () => {
  const ready = await navigator.serviceWorker.ready
  return { controlled: Boolean(navigator.serviceWorker.controller), scope: ready.scope }
})
const cdp = await context.newCDPSession(page)
await cdp.send('Network.enable')
await cdp.send('Network.setBlockedURLs', { urls: ['*sw.js*'] })
const interruptedUpdate = await page.evaluate(async () => {
  const registration = await navigator.serviceWorker.getRegistration()
  try { await registration?.update() } catch { /* expected network interruption */ }
  return { controlled: Boolean(navigator.serviceWorker.controller), usable: Boolean(document.querySelector('.configurator')) }
})
await cdp.send('Network.setBlockedURLs', { urls: [] })
await page.evaluate(() => Promise.all([200, 300, 400, 600].map((weight) => document.fonts.load(`${weight} 18px "Avenir Next for Leidos"`))))
await context.setOffline(true)
await page.reload({ waitUntil: 'domcontentloaded' })
await page.getByRole('button', { name: /touch screen to begin/i }).click()
await page.locator('.platform-card.active').click()
await page.locator('canvas').waitFor({ timeout: 15000 })
await page.waitForFunction(() => Number.parseFloat(getComputedStyle(document.querySelector('.model-marker')).opacity) > 0, null, { timeout: 15000 })
const offline = await page.evaluate(() => ({ controlled: Boolean(navigator.serviceWorker.controller), font: document.fonts.check('400 18px "Avenir Next for Leidos"'), modelMarkerVisible: Number.parseFloat(getComputedStyle(document.querySelector('.model-marker')).opacity) > 0 }))
await context.setOffline(false)

const blocking = audits.flatMap((entry) => entry.violations.map((violation) => ({ screen: entry.name, ...violation })))
const report = { audits, blockingViolationCount: blocking.length, browserErrors, registration, interruptedUpdate, offline }

// Quota failure is surfaced without claiming the request was saved.
const quotaContext = await browser.newContext({ viewport: { width: 1280, height: 800 } })
await quotaContext.addInitScript(() => {
  const original = IDBObjectStore.prototype.add
  IDBObjectStore.prototype.add = function (...args) {
    if (this.name === 'requests') throw new DOMException('Synthetic full storage', 'QuotaExceededError')
    return original.apply(this, args)
  }
})
const quotaPage = await quotaContext.newPage()
await quotaPage.goto(baseURL, { waitUntil: 'networkidle' })
await quotaPage.getByRole('button', { name: /touch screen to begin/i }).click()
await quotaPage.getByRole('button', { name: /explore products/i }).click()
await quotaPage.getByRole('button', { name: /share overview/i }).click()
await quotaPage.getByLabel('Name').fill('Quota Test')
await quotaPage.getByLabel('Email').fill('quota@example.com')
await quotaPage.getByRole('button', { name: /save request/i }).click()
const quotaMessage = await quotaPage.getByRole('alert').textContent()
report.quotaRecovery = { reported: quotaMessage?.includes('storage is full') === true, savedClaimVisible: await quotaPage.getByText(/request saved/i).isVisible().catch(() => false) }
await quotaContext.close()

// Simulated browser eviction leaves a usable, honest empty queue on restart.
const evictionContext = await browser.newContext({ viewport: { width: 1280, height: 800 } })
let evictionPage = await evictionContext.newPage()
await evictionPage.goto(baseURL, { waitUntil: 'networkidle' })
await evictionPage.getByRole('button', { name: /touch screen to begin/i }).click()
await evictionPage.getByRole('button', { name: /explore products/i }).click()
await evictionPage.getByRole('button', { name: /share overview/i }).click()
await evictionPage.getByLabel('Name').fill('Eviction Test')
await evictionPage.getByLabel('Email').fill('eviction@example.com')
await evictionPage.getByRole('button', { name: /save request/i }).click()
await evictionPage.getByText(/pending — email service not configured/i).waitFor()
await evictionPage.close()
evictionPage = await evictionContext.newPage()
const evictionCdp = await evictionContext.newCDPSession(evictionPage)
await evictionCdp.send('Storage.clearDataForOrigin', { origin: new URL(baseURL).origin, storageTypes: 'indexeddb' })
await evictionPage.goto(baseURL, { waitUntil: 'networkidle' })
await evictionPage.getByRole('button', { name: /touch screen to begin/i }).click()
await evictionPage.getByRole('button', { name: /explore products/i }).click()
const evictedCount = await evictionPage.locator('.queue-stat strong').textContent()
report.evictionRecovery = { pendingAfterEviction: evictedCount, sent: await evictionPage.locator('.queue-stat small').textContent() }
await evictionContext.close()

console.log(JSON.stringify(report, null, 2))
await browser.close()
if (blocking.length || browserErrors.length || !registration.controlled || !interruptedUpdate.controlled || !interruptedUpdate.usable || !offline.controlled || !offline.font || !offline.modelMarkerVisible || !report.quotaRecovery.reported || report.quotaRecovery.savedClaimVisible || report.evictionRecovery.pendingAfterEviction !== '0' || report.evictionRecovery.sent !== 'Sent: 0') process.exitCode = 1
