import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const baseURL = process.env.NEXUS_PREVIEW_URL ?? 'http://127.0.0.1:4177'
const imageModeURL = new URL(baseURL)
imageModeURL.searchParams.set('hubMedia', 'image')

const assertRectMatches = (actual, expected, label) => {
  assert(actual && expected, `${label} is not rendered`)
  for (const key of ['x', 'y', 'width', 'height']) assert(Math.abs(actual[key] - expected[key]) < 1.5, `${label} ${key} does not match its card (${actual[key]} vs ${expected[key]})`)
}

const assertFullCardMedia = async (page, mediaSelector) => {
  const card = page.locator('.hub-card-primary')
  const geometry = await card.evaluate((element, selector) => {
    const rect = target => { const bounds = target.getBoundingClientRect(); return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height } }
    const media = element.querySelector('.hub-card-media')
    const gradient = element.querySelector('.hub-gradient')
    const content = element.querySelector('.hub-card-content')
    return {
      card: rect(element),
      media: rect(media),
      gradient: rect(gradient),
      mediaElement: rect(media.querySelector(selector)),
      layers: { media: getComputedStyle(media).zIndex, gradient: getComputedStyle(gradient).zIndex, content: getComputedStyle(content).zIndex },
    }
  }, mediaSelector)
  assertRectMatches(geometry.media, geometry.card, 'Media layer')
  assertRectMatches(geometry.gradient, geometry.card, 'Gradient layer')
  assertRectMatches(geometry.mediaElement, geometry.card, `${mediaSelector} element`)
  assert.deepEqual(geometry.layers, { media: '0', gradient: '1', content: '2' })
}

const assertHeadingClearsCard = async page => {
  const heading = await page.locator('.reference-hub h1').boundingBox()
  const card = await page.locator('.hub-card-primary').boundingBox()
  assert(heading && card && heading.y + heading.height <= card.y - 12, 'Hub heading is clipped behind the primary card')
}

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' })
  await context.addInitScript(() => sessionStorage.setItem('nexus:access-granted', 'true'))
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })

  await page.goto(baseURL, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /touch screen to begin/i }).click()
  const media = page.locator('.hub-card-primary .hub-card-media')
  const video = media.locator('video')
  await video.waitFor()
  assert.equal(await video.getAttribute('loop'), '')
  assert.equal(await video.evaluate(element => element.muted), true)
  assert.equal(await video.getAttribute('playsinline'), '')
  assert.equal(await page.getByText('Placeholder video preview', { exact: true }).count(), 1)
  await assertFullCardMedia(page, 'video')
  await page.waitForFunction(() => !document.querySelector('.hub-card-primary video')?.paused)

  const carousel = page.locator('.hub-carousel')
  await carousel.evaluate(element => element.scrollTo({ left: element.scrollWidth, behavior: 'instant' }))
  await page.waitForFunction(() => document.querySelector('.hub-card-primary video')?.paused === true)
  await carousel.evaluate(element => element.scrollTo({ left: 0, behavior: 'instant' }))
  await page.waitForFunction(() => document.querySelector('.hub-card-primary video')?.paused === false)

  await page.evaluate(() => {
    let visibility = 'visible'
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility })
    window.__setHubMediaVisibility = value => { visibility = value; document.dispatchEvent(new Event('visibilitychange')) }
  })
  await page.evaluate(() => window.__setHubMediaVisibility('hidden'))
  await page.waitForFunction(() => document.querySelector('.hub-card-primary video')?.paused === true)
  await page.evaluate(() => window.__setHubMediaVisibility('visible'))
  await page.waitForFunction(() => document.querySelector('.hub-card-primary video')?.paused === false)
  await page.screenshot({ path: '/tmp/nexus-hub-video-desktop.png' })

  await page.setViewportSize({ width: 390, height: 844 })
  await assertFullCardMedia(page, 'video')
  await assertHeadingClearsCard(page)
  await page.screenshot({ path: '/tmp/nexus-hub-video-mobile.png' })
  await page.setViewportSize({ width: 1280, height: 800 })

  await video.dispatchEvent('error')
  await video.waitFor({ state: 'detached' })
  assert.equal(await page.getByText('Placeholder video preview', { exact: true }).count(), 0)
  assert.equal(await page.getByRole('img', { name: 'JLTV platform media' }).count(), 1)
  await assertFullCardMedia(page, 'img')
  await page.screenshot({ path: '/tmp/nexus-hub-video-fallback.png' })

  await page.locator('.hub-card-primary').click()
  await page.locator('.experience-loading').waitFor({ state: 'detached', timeout: 90_000 })
  const stage = page.locator('.model-stage')
  const addon = page.getByRole('button', { name: 'Add-on 1', exact: true })
  assert.equal(await page.locator('.bottom-config button').count(), 1)
  assert.equal(await addon.locator('img').getAttribute('src'), '/assets/addons/addon-1.webp')
  await addon.click()
  await page.waitForFunction(() => { const progress = Number(document.querySelector('.model-stage')?.dataset.addonProgress); return progress > .1 && progress < .95 })
  await page.waitForFunction(() => document.querySelector('.model-stage')?.dataset.addonProgress === '1.000')
  const panel = page.getByRole('complementary', { name: 'Add-on 1 details' })
  await panel.waitFor()
  assert.equal(await panel.locator('img').getAttribute('src'), '/assets/addons/addon-1.webp')
  assert.equal(await panel.getByText('Placeholder — pending approved data', { exact: true }).count(), 3)
  await page.screenshot({ path: '/tmp/nexus-addon-panel-desktop.png' })

  await page.setViewportSize({ width: 390, height: 844 })
  const panelBounds = await panel.boundingBox()
  const controlsBounds = await page.locator('.configuration-controls').boundingBox()
  assert(panelBounds && controlsBounds && panelBounds.x >= 0 && panelBounds.x + panelBounds.width <= 390)
  assert(panelBounds.y + panelBounds.height <= controlsBounds.y, 'Phone add-on panel obscures configuration controls')
  await page.screenshot({ path: '/tmp/nexus-addon-panel-mobile.png' })
  await page.getByRole('button', { name: 'Close Add-on 1 details' }).click()
  await page.waitForFunction(() => document.querySelector('.model-stage')?.dataset.addonVisible === 'false')
  assert.equal(await page.getByRole('complementary', { name: 'Add-on 1 details' }).count(), 0)
  assert.deepEqual(errors, [])
  await context.close()

  const imageContext = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' })
  await imageContext.addInitScript(() => sessionStorage.setItem('nexus:access-granted', 'true'))
  const imagePage = await imageContext.newPage()
  await imagePage.goto(imageModeURL.href, { waitUntil: 'networkidle' })
  await imagePage.getByRole('button', { name: /touch screen to begin/i }).click()
  assert.equal(await imagePage.locator('.hub-card-primary video').count(), 0)
  assert.equal(await imagePage.getByText('Placeholder video preview', { exact: true }).count(), 0)
  await assertFullCardMedia(imagePage, 'img')
  await imagePage.screenshot({ path: '/tmp/nexus-hub-image-desktop.png' })
  await imagePage.setViewportSize({ width: 390, height: 844 })
  await assertFullCardMedia(imagePage, 'img')
  await assertHeadingClearsCard(imagePage)
  await imagePage.screenshot({ path: '/tmp/nexus-hub-image-mobile.png' })
  await imageContext.close()

  const reduced = await browser.newContext({ viewport: { width: 960, height: 640 }, serviceWorkers: 'block', reducedMotion: 'reduce' })
  await reduced.addInitScript(() => sessionStorage.setItem('nexus:access-granted', 'true'))
  const reducedPage = await reduced.newPage()
  await reducedPage.goto(baseURL)
  await reducedPage.getByRole('button', { name: /touch screen to begin/i }).click()
  assert.equal(await reducedPage.locator('.hub-card-primary video').count(), 0)
  assert.equal(await reducedPage.getByRole('img', { name: 'JLTV platform media' }).count(), 1)
  await reduced.close()

  console.log(JSON.stringify({ fullCardMediaDesktop: true, fullCardMediaPhone: true, mediaBelowGradientAndContent: true, loopingHubVideo: true, offscreenPauseResume: true, visibilityPauseResume: true, imageModeDesktop: true, imageModePhone: true, browserErrorFallback: true, reducedMotionImageFallback: true, actualAddonThumbnail: true, revealAnimationRetained: true, desktopPanel: true, phonePanelAvoidsControls: true, placeholderSpecsOnly: true }))
} finally {
  await browser.close()
}

