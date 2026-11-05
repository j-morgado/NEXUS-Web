import { chromium } from 'playwright-core'
import assert from 'node:assert/strict'
import { grantPreviewAccess } from './e2e-helpers.mjs'

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 1 })
await grantPreviewAccess(page)
const errors = []
page.on('pageerror', error => errors.push(error.message))
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
const stage = page.locator('.model-stage')
const read = () => stage.evaluate(element => ({ ...element.dataset }))
const waitStage = async () => { await page.waitForFunction(() => document.querySelector('.model-stage')?.dataset.modelReady === 'true'); await page.waitForFunction(() => [...document.querySelectorAll('.vehicle-hotspot')].some(element => Number(getComputedStyle(element).opacity) > .99)) }
try {
  await page.goto(process.env.NEXUS_PREVIEW_URL ?? 'http://127.0.0.1:4177', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /touch screen to begin/i }).click()
  await page.locator('.hub-card-primary').click()
  await waitStage()
  assert.equal(await page.getByRole('button', { name: 'NEXUS', exact: true }).count(), 0)
  assert.equal(await page.getByText('JLTV CONFIGURATOR', { exact: true }).count(), 0)
  const heading = await page.locator('.vehicle-heading').boundingBox()
  assert(heading.y < 100)
  assert.equal((await read()).addonVisible, 'false')
  const addonButtons = page.locator('.addon-menu-item')
  const addonCount = await addonButtons.count()
  assert(addonCount > 0)
  for (let addon = 0; addon < addonCount; addon++) {
    await addonButtons.nth(addon).click()
    const active = await page.locator('.bottom-config [aria-pressed="true"]').count()
    assert(active <= 1)
    const attached = await addonButtons.first().getAttribute('aria-pressed') === 'true'
    await page.waitForFunction(expected => document.querySelector('.model-stage').dataset.addonVisible === String(expected), attached)
  }
  await page.locator('.bottom-config [aria-pressed="true"]').click()
  await page.waitForFunction(() => document.querySelector('.model-stage').dataset.addonVisible === 'false')
  assert.equal((await read()).addonVisible, 'false')
  console.log('Navigation and all exclusive/toggle-off add-on states passed')

  const canvas = page.locator('canvas')
  await page.mouse.move(800, 300)
  const originalDistance = Number((await read()).cameraDistance)
  await page.mouse.wheel(0, -180)
  await page.waitForFunction(before => Math.abs(Number(document.querySelector('.model-stage').dataset.cameraDistance) - before) > .1, originalDistance)
  await page.waitForTimeout(1000)
  const before = await read()
  const visible = page.locator('.vehicle-hotspot[data-visible="true"]').first()
  await visible.locator('button').click()
  await page.waitForFunction(() => document.querySelectorAll('.vehicle-hotspot.is-open').length === 1)
  await page.waitForFunction(() => document.querySelector('.vehicle-hotspot.is-open')?.getBoundingClientRect().width > 300, undefined, { timeout: 3_000 })
  const after = await read()
  assert(Math.abs(Number(before.cameraDistance) - Number(after.cameraDistance)) < .005, 'Hotspot selection must preserve zoom')
  assert.equal(after.cameraPosition, before.cameraPosition, 'Hotspot must not move the camera')
  assert.equal(await page.locator('.anchored-hotspot-card').count(), 0)
  assert((await page.locator('.vehicle-hotspot.is-open').boundingBox()).width > 300)
  const openBounds = await page.locator('.vehicle-hotspot.is-open').boundingBox()
  const configurationBounds = await page.locator('.configuration-controls').boundingBox()
  assert(openBounds.y + openBounds.height < configurationBounds.y, 'Hotspot panel must stay clear of configuration controls')
  await page.screenshot({ path: '/tmp/nexus-experience-hotspot.png' })
  await page.mouse.click(820, 130)
  assert.equal(await page.locator('.vehicle-hotspot.is-open').count(), 0)
  await visible.locator('button').click()
  await page.keyboard.press('Escape')
  assert.equal(await page.locator('.vehicle-hotspot.is-open').count(), 0)
  const visibleButtons = page.locator('.vehicle-hotspot[data-visible="true"] button')
  if (await visibleButtons.count() > 1) {
    await visibleButtons.nth(0).click(); await visibleButtons.nth(1).click()
    assert.equal(await page.locator('.vehicle-hotspot.is-open').count(), 1)
  }
  assert.equal(await page.locator('.vehicle-hotspot').count(), 4)
  console.log('Zoom preservation, integrated expansion, one-open rule, outside click and Escape passed')

  // Orbit around the actual model and watch marker occlusion, including an in-progress fade.
  const seen = new Set()
  let faded = false, blurred = false, observedOcclusion = false
  for (let turn = 0; turn < 6; turn++) {
    await page.mouse.move(820, 240); await page.mouse.down()
    for (let step = 0; step < 5; step++) {
      await page.mouse.move(820 - (step + 1) * 38, 240, { steps: 2 })
      await page.waitForTimeout(80)
      const state = await page.evaluate(() => ({ blur: document.querySelector('.model-stage').dataset.motionBlurActive, markers: [...document.querySelectorAll('.vehicle-hotspot')].map(element => ({ id: element.dataset.hotspotId, visible: element.dataset.visible, occluded: element.dataset.occluded, opacity: Number(getComputedStyle(element).opacity), open: element.classList.contains('is-open') })) }))
      blurred ||= state.blur === 'true'
      for (const marker of state.markers) {
        if (marker.visible === 'true') seen.add(marker.id)
        if (marker.occluded === 'true') observedOcclusion = true
        if (marker.opacity > .02 && marker.opacity < .98) faded = true
        assert(!(marker.occluded === 'true' && marker.open), 'Occluded hotspot must close')
      }
    }
    await page.mouse.up(); await page.waitForTimeout(350)
  }
  assert(observedOcclusion, 'Expected model occlusion')
  assert(faded, 'Expected intermediate one-second opacity fades')
  assert(blurred, 'Expected subtle camera motion blur while orbiting')
  assert.equal(seen.size, 4, `All hotspots should be reachable; saw ${[...seen]}`)
  console.log('All four hotspots reachable; occlusion dismissal, opacity fading and camera motion blur passed')
  // Disable damping via the real reduced-motion preference before sampling idle frames.
  // Software rendering otherwise stretches the frame-based damping tail.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.waitForFunction(() => document.querySelector('.model-stage').dataset.motionBlurActive === 'false')
  let idleFrames = (await read()).renderedFrames
  let settledSamples = 0
  for (let attempt = 0; attempt < 8 && settledSamples < 2; attempt++) {
    await page.waitForTimeout(1000)
    const frames = (await read()).renderedFrames
    settledSamples = frames === idleFrames ? settledSamples + 1 : 0
    idleFrames = frames
  }
  assert.equal(settledSamples, 2, 'The renderer should stop drawing after final queued frames settle')
  await page.mouse.move(820, 240); await page.mouse.wheel(0, 120)
  await page.waitForTimeout(1000)
  assert.equal((await read()).motionBlurActive, 'false')
  await page.screenshot({ path: '/tmp/nexus-experience-rear.png' })
  const renderer = await canvas.evaluate(element => { const gl = element.getContext('webgl2'); const info = gl?.getExtension('WEBGL_debug_renderer_info'); return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'unavailable' })
  console.log(JSON.stringify({ renderer, telemetry: await read(), browserErrors: errors }, null, 2))
  assert.deepEqual(errors, [])
  await page.getByRole('button', { name: /^Return to Hub$/ }).click()
  await page.getByRole('heading', { name: 'Choose an Experience' }).waitFor()
} finally { await browser.close() }
