import { chromium } from 'playwright-core'
import axe from 'axe-core'

const baseURL = process.env.NEXUS_PREVIEW_URL ?? 'http://127.0.0.1:4177'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--use-gl=swiftshader'] })
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, serviceWorkers: 'allow', reducedMotion: 'reduce', hasTouch: true })
const page = await context.newPage()
const browserErrors = []
const audits = []
page.on('pageerror', (error) => browserErrors.push(error.message))
page.on('console', (message) => { if (message.type() === 'error') browserErrors.push(message.text()) })

async function audit(name, target = page) {
  await target.addScriptTag({ content: axe.source })
  const result = await target.evaluate(async () => window.axe.run(document, { resultTypes: ['violations'], rules: { 'color-contrast': { enabled: true } } }))
  const blocking = result.violations.filter((violation) => ['critical', 'serious'].includes(violation.impact))
  audits.push({ name, violations: blocking.map(({ id, impact, nodes }) => ({ id, impact, nodes: nodes.map((node) => ({ target: node.target, html: node.html })) })) })
}

await page.goto(baseURL, { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts.ready)
const loopVideo = page.locator('.placeholder-video')
await page.waitForFunction(() => {
  const video = document.querySelector('.placeholder-video')
  return video instanceof HTMLVideoElement && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && !video.paused
})
await loopVideo.evaluate((video) => { video.dataset.continuityProbe = 'same-video-element' })
const videoDuration = await loopVideo.evaluate((video) => video.duration)
await page.waitForTimeout((videoDuration + 0.75) * 1000)
const loopState = await loopVideo.evaluate((video) => ({ connected: video.isConnected, ended: video.ended, paused: video.paused, currentTime: video.currentTime, loop: video.loop }))
if (!loopState.connected || loopState.ended || loopState.paused || !loopState.loop || loopState.currentTime >= videoDuration) throw new Error('Placeholder video did not decode and loop')
if (await page.getByRole('button', { name: /(?:pause|play|mute|unmute) background video/i }).count()) throw new Error('Attract playback controls must not be shown')
if (!(await loopVideo.evaluate(video => video.muted))) throw new Error('Attract video must autoplay muted')
await audit('attract')
await page.getByRole('button', { name: /touch screen to begin/i }).click()
await page.getByRole('heading', { name: /choose an experience/i }).waitFor()
const continuityState = await loopVideo.evaluate((video) => ({ probe: video.dataset.continuityProbe, connected: video.isConnected, currentTime: video.currentTime, filter: getComputedStyle(video.parentElement).filter }))
if (continuityState.probe !== 'same-video-element' || !continuityState.connected || continuityState.currentTime <= 0 || !continuityState.filter.includes('blur')) throw new Error('Attract-to-Hub video continuity or blur failed')
await audit('hub')
await page.getByRole('button', { name: /^explorer/i }).click()
await page.getByRole('heading', { name: 'JLTV Overview' }).waitFor()

const visited = []
const marketSections = page.locator('.market-accordion > section')
for (let marketIndex = 0; marketIndex < 6; marketIndex += 1) {
  const section = marketSections.nth(marketIndex)
  const toggle = section.locator('.market-toggle')
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click()
  const products = section.locator('.product-list > button')
  if (await products.count() !== 5) throw new Error(`Market ${marketIndex + 1} does not contain five products`)
  for (let productIndex = 0; productIndex < 5; productIndex += 1) {
    const productButton = products.nth(productIndex)
    const name = (await productButton.locator('strong').textContent())?.trim()
    await productButton.click()
    await page.locator('.catalog-hero-copy h2').filter({ hasText: name }).waitFor()
    visited.push(name)
  }
}
if (new Set(visited).size !== 30) throw new Error('All 30 distinct products were not selectable')

await page.getByRole('button', { name: /all media/i }).click()
if (await page.locator('.media-grid > button').count() !== 6) throw new Error('All-media filter did not show six assets')
for (const [filter, expected] of [['images', 3], ['videos', 2], ['documents', 1]]) {
  await page.getByRole('button', { name: new RegExp(`^${filter}$`, 'i') }).click()
  if (await page.locator('.media-grid > button').count() !== expected) throw new Error(`${filter} filter count was incorrect`)
}

await page.getByRole('button', { name: /^images$/i }).click()
await page.locator('.media-grid > button').first().click()
await page.getByRole('dialog').waitFor()
await page.getByRole('dialog').getByRole('button', { name: 'Zoom in', exact: true }).click()
if (!(await page.getByText('125%').isVisible())) throw new Error('Image zoom control failed')
await audit('image-viewer')
await page.getByRole('button', { name: /close/i }).click()

await page.getByRole('button', { name: /^videos$/i }).click()
await page.locator('.media-grid > button').first().click()
await page.getByRole('button', { name: /play/i }).click()
await page.getByText(/playing placeholder video/i).waitFor()
await page.getByRole('button', { name: /close/i }).click()

await page.getByRole('button', { name: /^documents$/i }).click()
await page.locator('.media-grid > button').first().click()
await page.getByRole('dialog').getByRole('button', { name: 'Next page', exact: true }).click()
await page.getByText('Page 2 / 4').waitFor()
await page.getByRole('button', { name: /close/i }).click()

await page.getByRole('button', { name: /^share/i }).click()
await page.getByRole('dialog', { name: /^share$/i }).waitFor()
await page.getByLabel('Name').fill('Quality Test')
await page.getByLabel('Email').fill('quality@example.com')
await page.getByRole('button', { name: /type q/i }).click()
await page.getByRole('button', { name: /backspace/i }).click()
await page.getByRole('button', { name: /submit/i }).click()
await page.getByText(/pending — email service not configured/i).waitFor()
await audit('share-saved')
await page.getByRole('button', { name: /return to explorer/i }).click()

await page.getByRole('button', { name: /back to hub/i }).click()
await page.getByRole('button', { name: /jltv/i }).click()
await page.getByRole('button', { name: /^Return to Hub$/i }).waitFor()
if (await page.locator('.bottom-config [aria-pressed="true"]').count()) throw new Error('Bare vehicle was not the default')
await page.getByRole('button', { name: /^add-on 1$/i }).click()
await page.getByRole('button', { name: /^add-on 1$/i }).click()
await page.waitForFunction(() => [...document.querySelectorAll('.vehicle-hotspot')].some(marker => marker.dataset.visible === 'true' && Number(getComputedStyle(marker).opacity) > .99))
await page.locator('.vehicle-hotspot[data-visible="true"] button').first().click()
await page.getByRole('button', { name: /close hotspot/i }).waitFor()
if (!(await page.locator('.vehicle-hotspot.is-open').isVisible())) throw new Error('Integrated hotspot panel did not expand')
await audit('configurator-hotspot')
await context.close()

for (const route of process.env.SKIP_TIMER_CHECKS ? [] : ['share', 'media', 'configurator']) {
  console.log(`Checking inactivity reset from ${route}`)
  const timerContext = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block', hasTouch: true })
  const timerPage = await timerContext.newPage()
  await timerPage.goto(`${baseURL}?testTimeout=12`, { waitUntil: 'networkidle' })
  await timerPage.getByRole('button', { name: /touch screen to begin/i }).click()
  if (route === 'configurator') {
    await timerPage.getByRole('button', { name: /jltv/i }).click()
    await timerPage.getByRole('button', { name: /^Return to Hub$/i }).waitFor()
  }
  else {
    await timerPage.getByRole('button', { name: /^explorer/i }).click()
    await timerPage.getByRole('heading', { name: 'JLTV Overview' }).waitFor()
    if (route === 'share') await timerPage.getByRole('button', { name: /^share/i }).click()
    else await timerPage.locator('.media-grid > button').first().click()
  }
  await timerPage.evaluate(() => window.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })))
  await timerPage.getByRole('alertdialog').waitFor({ timeout: route === 'configurator' ? 45_000 : 15_000 })
  await timerPage.getByRole('button', { name: /touch screen to begin/i }).waitFor({ timeout: route === 'configurator' ? 50_000 : 18_000 })
  await timerContext.close()
}

const smallContext = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block', hasTouch: true })
const smallPage = await smallContext.newPage()
await smallPage.goto(baseURL, { waitUntil: 'networkidle' })
await smallPage.getByRole('button', { name: /touch screen to begin/i }).click()
const primaryExplore = await smallPage.locator('.hub-card-primary .outline-pill').boundingBox()
const explorerEntry = await smallPage.getByRole('button', { name: /^explorer/i }).boundingBox()
const overlaps = (a, b) => Boolean(a && b && a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y)
if (overlaps(primaryExplore, explorerEntry)) throw new Error('Small Hub Explorer entry overlaps primary Explore control')
await smallPage.getByRole('button', { name: /^explorer/i }).click()
await smallPage.getByRole('heading', { name: 'JLTV Overview' }).waitFor()
const mediaBounds = await smallPage.locator('.catalog-media').boundingBox()
const backBounds = await smallPage.getByRole('button', { name: /back to hub/i }).boundingBox()
const featureBounds = await smallPage.locator('.catalog-features').boundingBox()
if (!mediaBounds || mediaBounds.x + mediaBounds.width > 1280 || overlaps(backBounds, featureBounds)) throw new Error('Small Explorer content clips or Back to Hub overlays features')
await smallPage.getByRole('button', { name: /^share/i }).click()
const formBounds = await smallPage.locator('.share-form').boundingBox()
const keyboardBounds = await smallPage.locator('.touch-keyboard').boundingBox()
const keyHeight = await smallPage.locator('.touch-keyboard button').first().evaluate((item) => item.getBoundingClientRect().height)
if (overlaps(formBounds, keyboardBounds) || keyHeight < 48) throw new Error('Small Share form collides with keyboard or keys are undersized')
await smallContext.close()

const updateContext = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' })
const updatePage = await updateContext.newPage()
await updatePage.goto(baseURL, { waitUntil: 'networkidle' })
await updatePage.keyboard.press('Control+Shift+O')
const updatePreference = updatePage.getByLabel(/run an explicit update check at startup/i)
await updatePreference.uncheck()
if (!(await updatePage.getByRole('button', { name: 'Check now' }).isDisabled())) throw new Error('Disabled update preference did not disable explicit checking')
await updatePage.reload({ waitUntil: 'networkidle' })
await updatePage.keyboard.press('Control+Shift+O')
if (await updatePage.getByLabel(/run an explicit update check at startup/i).isChecked()) throw new Error('Update preference did not persist')
await updateContext.close()

const report = { visitedProducts: visited.length, audits, blockingViolationCount: audits.flatMap((item) => item.violations).length, browserErrors }
console.log(JSON.stringify(report, null, 2))
await browser.close()
if (report.blockingViolationCount || browserErrors.length) process.exitCode = 1
