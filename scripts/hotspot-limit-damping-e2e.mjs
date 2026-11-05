import { chromium } from 'playwright-core'
import assert from 'node:assert/strict'

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const baseURL = process.env.NEXUS_PREVIEW_URL ?? 'http://127.0.0.1:4177'

try {
  const context = await browser.newContext({ viewport: { width: 960, height: 720 }, reducedMotion: 'reduce', serviceWorkers: 'block' })
  await context.addInitScript(() => {
    sessionStorage.setItem('nexus:access-granted', 'true')
    localStorage.setItem('nexus-operator-settings-v1', JSON.stringify({ inactivitySeconds: 60, qualityTier: 'low', hotspotMode: 'zoom-in-place', visual: { ssgi: false, ssgiSamples: 8, ssao: false, ssaoSamples: 8, ssr: false, ssrSteps: 16, motionBlur: false, motionBlurSamples: 3, resolutionScale: .5, maxDpr: 1, planarReflections: false, reflectionResolution: 256, shadowResolution: 512 }, updateChecksEnabled: false, locallyDisabledModuleIds: [] }))
  })
  const page = await context.newPage()
  const cdp = await context.newCDPSession(page)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto(baseURL)
  await page.getByRole('button', { name: /touch screen to begin/i }).click()
  await page.locator('.hub-card-primary').click()
  await page.locator('.experience-loading').waitFor({ state: 'detached', timeout: 90_000 })

  const stage = page.locator('.model-stage')
  const marker = page.locator('[data-hotspot-id="crew-protection"]')
  const read = () => stage.evaluate(element => ({ azimuth: Number(element.dataset.cameraAzimuth), polar: Number(element.dataset.cameraPolar), distance: Number(element.dataset.cameraDistance), resistance: Number(element.dataset.cameraLimitResistance), target: element.dataset.cameraTarget, limits: JSON.parse(element.dataset.orbitLimits), open: element.dataset.hotspotOpen }))
  const settled = locked => page.waitForFunction(expected => { const element = document.querySelector('.model-stage'); return element?.dataset.cameraLocked === String(expected) && element?.dataset.cameraTransitioning !== 'true' }, locked, { timeout: 60_000 })
  const refocus = async () => {
    if ((await read()).open === 'true') { await page.keyboard.press('Escape'); await settled(false) }
    await marker.locator('button').click(); await settled(true)
    return read()
  }
  const decreasingTail = values => {
    const changes = values.slice(1).map((value, index) => Math.abs(value - values[index])).filter(value => value > 1e-5)
    assert(changes.length >= 3, `Expected multiple camera changes, got ${changes}`)
    assert(changes.at(-1) < changes[0] * .75, `Expected movement to slow near the limit, got ${changes}`)
  }

  const focused = await refocus()
  assert.equal(await stage.getAttribute('data-hotspot-mode'), 'zoom-in-place')
  const anchorTarget = focused.target

  await page.mouse.move(180, 250); await page.mouse.down()
  const mouseTowardMin = [focused.azimuth]
  const mouseResistance = []
  for (let x = 185; x <= 245; x += 5) {
    await page.mouse.move(x, 250); await page.waitForTimeout(40)
    const state = await read(); mouseTowardMin.push(state.azimuth); mouseResistance.push(state.resistance)
  }
  const atMouseMin = await read()
  assert(atMouseMin.azimuth >= atMouseMin.limits.minAzimuth - 1e-4)
  decreasingTail(mouseTowardMin)
  assert(Math.min(...mouseResistance) < .5)
  await page.mouse.move(240, 250); await page.waitForTimeout(40)
  const mouseLeavingMin = await read()
  assert(mouseLeavingMin.azimuth > atMouseMin.azimuth + .015, 'Mouse movement away from the limit should remain responsive')
  assert(mouseLeavingMin.resistance > .99)

  const mouseTowardMax = [mouseLeavingMin.azimuth]
  for (let x = 235; x >= 115; x -= 5) {
    await page.mouse.move(x, 250); await page.waitForTimeout(40); mouseTowardMax.push((await read()).azimuth)
  }
  const atMouseMax = await read()
  await page.mouse.up()
  assert(atMouseMax.azimuth <= atMouseMax.limits.maxAzimuth + 1e-4)
  decreasingTail(mouseTowardMax)
  assert.equal(atMouseMax.target, anchorTarget)
  assert.equal(atMouseMax.open, 'true')

  await refocus()
  await page.mouse.move(820, 240)
  const mouseZoomIn = [(await read()).distance]
  const wheelResistance = []
  for (let index = 0; index < 8; index++) {
    await page.mouse.wheel(0, -100); await page.waitForTimeout(45)
    const state = await read(); mouseZoomIn.push(state.distance); wheelResistance.push(state.resistance)
  }
  const atZoomMin = await read()
  assert(atZoomMin.distance >= atZoomMin.limits.minDistance - .001)
  decreasingTail(mouseZoomIn)
  assert(Math.min(...wheelResistance) < .5)
  await page.mouse.wheel(0, 100); await page.waitForTimeout(45)
  const leavingZoomMin = await read()
  assert(leavingZoomMin.distance > atZoomMin.distance + .05)
  assert(leavingZoomMin.resistance > .99)
  for (let index = 0; index < 14; index++) { await page.mouse.wheel(0, 100); await page.waitForTimeout(35) }
  const atZoomMax = await read()
  assert(atZoomMax.distance <= atZoomMax.limits.maxDistance + .001)
  assert.equal(atZoomMax.target, anchorTarget)

  await refocus()
  const touch = (type, touchPoints) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints })
  await touch('touchStart', [{ id: 11, x: 180, y: 250 }])
  const touchTowardMin = [(await read()).azimuth]
  for (let x = 185; x <= 245; x += 5) { await touch('touchMove', [{ id: 11, x, y: 250 }]); await page.waitForTimeout(40); touchTowardMin.push((await read()).azimuth) }
  const atTouchMin = await read()
  assert(atTouchMin.azimuth >= atTouchMin.limits.minAzimuth - 1e-4)
  decreasingTail(touchTowardMin)
  await touch('touchMove', [{ id: 11, x: 240, y: 250 }]); await page.waitForTimeout(40)
  const touchLeavingMin = await read()
  assert(touchLeavingMin.azimuth > atTouchMin.azimuth + .015)
  assert(touchLeavingMin.resistance > .99)
  await touch('touchEnd', [])

  await refocus()
  const [pinchLeft, pinchRight] = await page.evaluate(() => {
    for (let y = 100; y < innerHeight - 120; y += 30) {
      const points = []
      for (let x = 40; x < innerWidth - 40; x += 20) if (document.elementFromPoint(x, y)?.tagName === 'CANVAS') points.push({ x, y })
      for (const left of points) {
        const right = points.find(point => point.x - left.x >= 160)
        if (right) return [left, right]
      }
    }
    throw new Error('Could not find two unobscured canvas points for pinch verification')
  })
  await touch('touchStart', [{ id: 21, ...pinchLeft }, { id: 22, ...pinchRight }])
  const pinchTowardMin = [(await read()).distance]
  for (let offset = 5; offset <= 50; offset += 5) { await touch('touchMove', [{ id: 21, ...pinchLeft }, { id: 22, x: pinchRight.x + offset, y: pinchRight.y }]); await page.waitForTimeout(40); pinchTowardMin.push((await read()).distance) }
  const atPinchMin = await read()
  assert(atPinchMin.distance >= atPinchMin.limits.minDistance - .001)
  decreasingTail(pinchTowardMin)
  await touch('touchMove', [{ id: 21, ...pinchLeft }, { id: 22, x: pinchRight.x + 45, y: pinchRight.y }]); await page.waitForTimeout(40)
  const pinchLeavingMin = await read()
  assert(pinchLeavingMin.distance > atPinchMin.distance + .015)
  assert(pinchLeavingMin.resistance > .99)
  await touch('touchEnd', [])

  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await refocus()
  await page.mouse.move(180, 250); await page.mouse.down()
  for (let x = 185; x <= 280; x += 5) { await page.mouse.move(x, 250); await page.waitForTimeout(35) }
  await page.mouse.up(); await page.waitForTimeout(1200)
  const dampedLimit = await read()
  assert(dampedLimit.azimuth >= dampedLimit.limits.minAzimuth - 1e-4)
  await page.mouse.move(280, 250); await page.mouse.down(); await page.mouse.move(260, 250, { steps: 4 }); await page.mouse.up(); await page.waitForTimeout(500)
  const dampedRelease = await read()
  assert(dampedRelease.azimuth > dampedLimit.azimuth + .01, 'Native damping must still release responsively away from the limit')

  const final = await read()
  assert.equal(final.target, anchorTarget)
  assert.equal(final.open, 'true')
  assert.deepEqual(errors, [])
  console.log(JSON.stringify({ mouseOrbitBothBounds: true, mouseWheelBothBounds: true, touchOrbitApproachAndRelease: true, touchPinchApproachAndRelease: true, nativeDampingRelease: true, hardLimitsRetained: true, hotspotAnchorStable: true }))
  await context.close()
} finally {
  await browser.close()
}
