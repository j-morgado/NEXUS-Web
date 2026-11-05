import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright-core'

const baseURL = process.env.NEXUS_PREVIEW_URL ?? 'http://127.0.0.1:4177'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--use-gl=swiftshader'] })
const browserErrors = []
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' })
const page = await context.newPage()
page.on('pageerror', error => browserErrors.push(error.message))
page.on('console', message => { if (message.type() === 'error') browserErrors.push(message.text()) })

const unlock = async () => {
  if (await page.getByLabel('Password').count()) {
    await page.getByLabel('Password').fill('nexus')
    await page.getByRole('button', { name: 'Enter site' }).click()
  }
}

try {
  await page.goto(`${baseURL}?environmentLab=1`, { waitUntil: 'networkidle' })
  assert.equal(await page.getByLabel('Password').count(), 1, 'Environment harness bypassed the preview access gate')
  assert.equal(await page.getByRole('navigation', { name: 'Environment preview' }).count(), 0, 'Environment controls rendered before access was granted')
  assert.match(await page.locator('meta[name="robots"]').getAttribute('content'), /noindex/i, 'Preview lost its noindex directive')
  await unlock()
  await page.getByRole('navigation', { name: 'Environment preview' }).waitFor()

  await page.goto(baseURL, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /touch screen to begin/i }).waitFor()
  assert.equal(await page.getByRole('navigation', { name: 'Environment preview' }).count(), 0, 'Environment controls leaked into the visitor root')

  await page.goto(`${baseURL}?environmentLab=1`, { waitUntil: 'networkidle' })
  await unlock()
  await page.getByRole('navigation', { name: 'Environment preview' }).waitFor()
  await page.waitForFunction(() => document.querySelector('.environment-lab')?.getAttribute('data-scene-ready') === 'true')
  await mkdir('review-evidence/environment-exploration', { recursive: true })
  const canvas = page.locator('canvas')
  await canvas.evaluate(element => { element.dataset.contextIdentity = 'environment-lab-stable-canvas' })

  const screenshots = []
  for (const kind of ['land', 'sea', 'air']) {
    await page.getByRole('button', { name: new RegExp(kind, 'i') }).click()
    await page.waitForFunction(expected => document.querySelector('.environment-lab')?.getAttribute('data-environment') === expected && document.querySelector('.environment-lab')?.getAttribute('data-scene-ready') === 'true', kind)
    await page.waitForTimeout(650)
    assert.equal(await page.getByRole('heading', { name: new RegExp(`^${kind}$`, 'i') }).count(), 1)
    assert.equal(await page.getByRole('button', { pressed: true, name: new RegExp(kind, 'i') }).count(), 1)
    if (kind !== 'land') assert.equal(await page.getByText('CONCEPT STAND-IN · FINAL ART PENDING', { exact: true }).count(), 1)
    const path = `review-evidence/environment-exploration/${kind}.png`
    await page.screenshot({ path, fullPage: true })
    screenshots.push(path)
    assert.equal(await canvas.getAttribute('data-context-identity'), 'environment-lab-stable-canvas', `Canvas was recreated while switching to ${kind}`)
    if (kind === 'land') {
      assert.equal(await page.locator('.environment-canvas').getAttribute('data-frameloop'), 'demand')
      const first = await canvas.screenshot()
      await page.waitForTimeout(500)
      const second = await canvas.screenshot()
      assert.equal(createHash('sha256').update(first).digest('hex'), createHash('sha256').update(second).digest('hex'), 'Land scene rendered continuously instead of remaining static')
    } else {
      const first = await canvas.screenshot()
      await page.waitForTimeout(700)
      const second = await canvas.screenshot()
      assert.notEqual(createHash('sha256').update(first).digest('hex'), createHash('sha256').update(second).digest('hex'), `${kind} scene did not visibly animate`)
    }
    if (kind === 'sea') {
      const firstMotion = await canvas.evaluate(element => ({ wave: element.dataset.wavePhase, buoyancy: element.dataset.buoyancyHeight, foam: element.dataset.contactFoamPhase }))
      await page.waitForTimeout(450)
      const secondMotion = await canvas.evaluate(element => ({ wave: element.dataset.wavePhase, buoyancy: element.dataset.buoyancyHeight, foam: element.dataset.contactFoamPhase }))
      assert.notEqual(firstMotion.wave, secondMotion.wave, 'Ocean wave phase did not advance')
      assert.notEqual(firstMotion.buoyancy, secondMotion.buoyancy, 'Sampled vessel buoyancy did not advance')
      assert.notEqual(firstMotion.foam, secondMotion.foam, 'Hull contact-foam phase did not advance')
      const foamPath = 'review-evidence/environment-exploration/sea-contact-foam.png'
      await page.screenshot({ path: foamPath, clip: { x: 430, y: 220, width: 620, height: 470 } })
      screenshots.push(foamPath)
    }
  }

  for (const kind of ['land', 'sea', 'air', 'sea', 'land']) {
    await page.getByRole('navigation', { name: 'Environment preview' }).getByRole('button', { name: new RegExp(kind, 'i') }).click()
    await page.waitForFunction(expected => document.querySelector('.environment-lab')?.getAttribute('data-environment') === expected && document.querySelector('.environment-lab')?.getAttribute('data-scene-ready') === 'true', kind)
    assert.equal(await canvas.getAttribute('data-context-identity'), 'environment-lab-stable-canvas', `Canvas was recreated during repeated switch to ${kind}`)
  }

  await page.getByRole('button', { name: /open creator tools/i }).click()
  await page.getByRole('heading', { name: 'Scene direction' }).waitFor()
  await page.waitForTimeout(350)
  const desktopCreatorBox = await page.locator('.environment-creator').boundingBox()
  assert(desktopCreatorBox && desktopCreatorBox.x < 1100, 'Creator tools panel did not finish opening on desktop')
  assert.equal(await page.getByLabel('Ambient motion').count(), 0, 'Land exposed an unused ambient-motion control')
  assert.equal(await page.getByLabel('Ridge variation').count(), 1)
  const creatorPath = 'review-evidence/environment-exploration/creator-tools.png'
  await page.screenshot({ path: creatorPath, fullPage: true })
  screenshots.push(creatorPath)

  await page.getByRole('navigation', { name: 'Environment preview' }).getByRole('button', { name: /sea/i }).click()
  await page.waitForFunction(() => document.querySelector('.environment-lab')?.getAttribute('data-environment') === 'sea' && document.querySelector('.environment-lab')?.getAttribute('data-scene-ready') === 'true')
  assert.equal(await page.getByLabel('Wave energy').count(), 1)
  const keyLight = page.getByLabel('Key light')
  await keyLight.fill('3.25')
  assert.equal(await keyLight.inputValue(), '3.25')
  await page.getByRole('button', { name: /copy json/i }).click()
  await page.getByText(/configuration copied|clipboard unavailable/i).waitFor()
  await page.getByRole('button', { name: /reset sea/i }).click()
  assert.equal(await keyLight.inputValue(), '2.2')

  await page.setViewportSize({ width: 844, height: 390 })
  const mobilePath = 'review-evidence/environment-exploration/mobile-landscape-creator.png'
  await page.screenshot({ path: mobilePath, fullPage: true })
  screenshots.push(mobilePath)
  const headingBox = await page.getByRole('heading', { name: 'Scene direction' }).boundingBox()
  const closeBox = await page.getByRole('button', { name: /close creator tools/i }).boundingBox()
  assert(headingBox && closeBox)
  const overlaps = closeBox.x < headingBox.x + headingBox.width && closeBox.x + closeBox.width > headingBox.x && closeBox.y < headingBox.y + headingBox.height && closeBox.y + closeBox.height > headingBox.y
  assert.equal(overlaps, false, 'Mobile landscape creator close control obscured the Scene direction heading')

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('navigation', { name: 'Environment preview' }).waitFor()
  await page.getByRole('navigation', { name: 'Environment preview' }).getByRole('button', { name: /sea/i }).click()
  await page.waitForFunction(() => document.querySelector('.environment-lab')?.getAttribute('data-environment') === 'sea' && document.querySelector('.environment-lab')?.getAttribute('data-scene-ready') === 'true')
  assert.equal(await page.locator('.environment-lab').getAttribute('data-motion'), 'reduced')
  assert.equal(await page.locator('.environment-canvas').getAttribute('data-frameloop'), 'demand')
  const reducedFirst = await canvas.evaluate(element => ({ wave: element.dataset.wavePhase, buoyancy: element.dataset.buoyancyHeight, foam: element.dataset.contactFoamPhase }))
  await page.waitForTimeout(650)
  const reducedSecond = await canvas.evaluate(element => ({ wave: element.dataset.wavePhase, buoyancy: element.dataset.buoyancyHeight, foam: element.dataset.contactFoamPhase }))
  assert.deepEqual(reducedSecond, reducedFirst, 'Reduced motion did not pause sea animation')
  await page.getByRole('navigation', { name: 'Environment preview' }).getByRole('button', { name: /air/i }).click()
  await page.waitForFunction(() => document.querySelector('.environment-lab')?.getAttribute('data-environment') === 'air' && document.querySelector('.environment-lab')?.getAttribute('data-scene-ready') === 'true')
  const reducedAirFirst = await canvas.screenshot()
  await page.waitForTimeout(650)
  const reducedAirSecond = await canvas.screenshot()
  assert.equal(createHash('sha256').update(reducedAirFirst).digest('hex'), createHash('sha256').update(reducedAirSecond).digest('hex'), 'Reduced motion did not pause air animation')

  assert.deepEqual(browserErrors, [])
  console.log(JSON.stringify({ accessGate: true, noindex: true, routeIsolation: true, stableCanvas: true, repeatedSwitches: true, environments: ['land', 'sea', 'air'], creatorControls: true, landDemandRendering: true, dynamicSea: { waves: true, sampledBuoyancy: true, contactFoam: true }, dynamicAir: true, reducedMotion: true, viewports: ['1440x900', '844x390'], screenshots, browserErrors }, null, 2))
} finally {
  await context.close()
  await browser.close()
}
