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
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block', reducedMotion: 'no-preference' })
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
  const panelElement = page.locator('.addon-info-panel')
  await panelElement.waitFor({ state: 'attached' })
  await page.waitForFunction(() => document.querySelector('.addon-info-panel')?.classList.contains('is-open'))
  const openingBounds = await panelElement.boundingBox()
  const openingTransitionRunning = await panelElement.evaluate(element => element.getAnimations().some(animation => animation.playState === 'running'))
  assert(openingTransitionRunning, 'Add-on panel did not animate in from the right')
  await panelElement.evaluate(async element => { await Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => undefined))) })
  const openBounds = await panelElement.boundingBox()
  assert(openingBounds && openBounds && openingBounds.x > openBounds.x + 20, 'Add-on panel entry did not travel left from beyond the right edge')
  await page.waitForFunction(() => { const progress = Number(document.querySelector('.model-stage')?.dataset.addonProgress); return progress > .1 && progress < .95 })
  await page.waitForFunction(() => document.querySelector('.model-stage')?.dataset.addonProgress === '1.000')
  const panel = page.getByRole('complementary', { name: 'Add-on 1 details' })
  await panel.waitFor()
  assert.equal(await panel.locator('img').getAttribute('src'), '/assets/addons/addon-1.webp')
  assert.equal(await panel.getByText('Placeholder — pending approved data', { exact: true }).count(), 3)
  const closeButton = panelElement.locator('.addon-panel-close')
  const closeStyle = await closeButton.evaluate(element => { const style = getComputedStyle(element); const bounds = element.getBoundingClientRect(); return { background: style.backgroundColor, borderWidth: style.borderWidth, borderRadius: style.borderRadius, width: bounds.width, height: bounds.height } })
  assert.deepEqual(closeStyle, { background: 'rgba(0, 0, 0, 0)', borderWidth: '0px', borderRadius: '0px', width: 48, height: 48 })
  await addon.focus()
  await page.keyboard.press('Tab')
  assert.equal(await closeButton.evaluate(element => document.activeElement === element), true, 'Bare close cross is not keyboard reachable')
  const closeFocus = await closeButton.evaluate(element => { const style = getComputedStyle(element); return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth } })
  assert.notEqual(closeFocus.outlineStyle, 'none', 'Bare close cross has no visible focus treatment')
  assert(Number.parseFloat(closeFocus.outlineWidth) >= 3, 'Bare close cross focus treatment is too subtle')
  await page.screenshot({ path: '/tmp/nexus-addon-panel-desktop.png' })

  await addon.evaluate(button => button.click())
  await page.waitForFunction(() => document.querySelector('.addon-menu-item')?.getAttribute('aria-pressed') === 'false')
  await page.waitForTimeout(60)
  await addon.evaluate(button => button.click())
  await page.waitForFunction(() => document.querySelector('.addon-info-panel')?.dataset.state === 'open')
  await panelElement.evaluate(async element => { await Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => undefined))) })
  await page.waitForTimeout(450)
  assert.equal(await panelElement.getAttribute('data-state'), 'open', 'Rapid reopen was removed by a stale exit callback')
  assert.equal(await addon.getAttribute('aria-pressed'), 'true', 'Rapid reopen did not restore add-on selection')
  await page.waitForFunction(() => document.querySelector('.model-stage')?.dataset.addonProgress === '1.000')

  await page.setViewportSize({ width: 390, height: 844 })
  const panelBounds = await panel.boundingBox()
  const controlsBounds = await page.locator('.configuration-controls').boundingBox()
  assert(panelBounds && controlsBounds && panelBounds.x >= 0 && panelBounds.x + panelBounds.width <= 390)
  assert(panelBounds.y + panelBounds.height <= controlsBounds.y, 'Phone add-on panel obscures configuration controls')
  await page.screenshot({ path: '/tmp/nexus-addon-panel-mobile.png' })
  await closeButton.evaluate(button => button.click())
  await page.waitForFunction(() => document.querySelector('.addon-info-panel')?.dataset.state === 'exiting')
  assert.equal(await panelElement.getAttribute('aria-hidden'), 'true')
  assert.equal(await panelElement.getAttribute('inert'), '')
  assert.equal(await panelElement.evaluate(element => getComputedStyle(element).pointerEvents), 'none', 'Exiting panel blocks controls')
  const exitMotion = await panelElement.evaluate(element => {
    const animation = element.getAnimations().find(item => item.playState === 'running')
    const finalTransform = animation?.effect?.getKeyframes().at(-1)?.transform
    return { running: Boolean(animation), finalTransform: String(finalTransform ?? ''), viewportWidth: window.innerWidth }
  })
  assert(exitMotion.running, 'Panel exit transition is not running')
  assert(exitMotion.finalTransform.includes('100%') && (exitMotion.finalTransform.includes('100vw') || exitMotion.finalTransform.includes(`${exitMotion.viewportWidth}px`)), 'Panel exit destination does not clear the right viewport edge')
  await panelElement.waitFor({ state: 'detached' })
  await page.waitForFunction(() => document.querySelector('.model-stage')?.dataset.addonVisible === 'false')
  assert.equal(await page.getByRole('complementary', { name: 'Add-on 1 details' }).count(), 0)

  await addon.click()
  await page.waitForFunction(() => document.querySelector('.addon-info-panel')?.dataset.state === 'open')
  await page.getByRole('button', { name: /^Return to Hub$/ }).click()
  await page.getByRole('heading', { name: /choose an experience/i }).waitFor()
  assert.equal(await page.locator('.addon-info-panel').count(), 0, 'Route unmount left stale add-on panel state')
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
  await reducedPage.locator('.hub-card-primary').click()
  await reducedPage.locator('.experience-loading').waitFor({ state: 'detached', timeout: 90_000 })
  await reducedPage.getByRole('button', { name: 'Add-on 1', exact: true }).click()
  const reducedPanel = reducedPage.locator('.addon-info-panel')
  await reducedPage.waitForFunction(() => document.querySelector('.addon-info-panel')?.dataset.state === 'open')
  assert.equal(await reducedPanel.evaluate(element => element.getAnimations().some(animation => animation.playState === 'running')), false, 'Reduced-motion panel still animates')
  await reducedPanel.locator('.addon-panel-close').evaluate(button => button.click())
  await reducedPanel.waitFor({ state: 'detached' })
  await reduced.close()

  console.log(JSON.stringify({ fullCardMediaDesktop: true, fullCardMediaPhone: true, mediaBelowGradientAndContent: true, loopingHubVideo: true, offscreenPauseResume: true, visibilityPauseResume: true, imageModeDesktop: true, imageModePhone: true, browserErrorFallback: true, reducedMotionImageFallback: true, actualAddonThumbnail: true, revealAnimationRetained: true, bareCrossClose: true, accessibleCloseTarget: true, panelSlidesInFromRight: true, panelSlidesFullyOutRight: true, rapidReopenCancelsExit: true, routeUnmountCleansPanel: true, reducedMotionPanel: true, desktopPanel: true, phonePanelAvoidsControls: true, placeholderSpecsOnly: true }))
} finally {
  await browser.close()
}

