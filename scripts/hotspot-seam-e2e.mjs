import { chromium } from 'playwright-core'
import assert from 'node:assert/strict'

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const baseURL = process.env.NEXUS_PREVIEW_URL ?? 'http://127.0.0.1:4177'
const unwrap = (value, reference) => reference + ((value - reference + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI

try {
  const context = await browser.newContext({ viewport: { width: 960, height: 720 }, reducedMotion: 'reduce', serviceWorkers: 'block' })
  await context.addInitScript(() => {
    sessionStorage.setItem('nexus:access-granted', 'true')
    localStorage.setItem('nexus-operator-settings-v1', JSON.stringify({ inactivitySeconds: 60, qualityTier: 'low', hotspotMode: 'zoom-in-place', visual: { ssgi: false, ssgiSamples: 8, ssao: false, ssaoSamples: 8, ssr: false, ssrSteps: 16, motionBlur: false, motionBlurSamples: 3, resolutionScale: .5, maxDpr: 1, planarReflections: false, reflectionResolution: 256, shadowResolution: 512 }, updateChecksEnabled: false, locallyDisabledModuleIds: [] }))
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto(baseURL)
  await page.getByRole('button', { name: /touch screen to begin/i }).click()
  await page.locator('.hub-card-primary').click()
  await page.locator('.experience-loading').waitFor({ state: 'detached', timeout: 90_000 })
  await page.waitForFunction(() => document.querySelector('.model-stage')?.dataset.modelReady === 'true')
  await page.waitForFunction(() => [...document.querySelectorAll('.vehicle-hotspot')].some(element => element.dataset.visible === 'true'))

  const stage = page.locator('.model-stage')
  const marker = page.locator('[data-hotspot-id="crew-protection"]')
  const read = () => stage.evaluate(element => ({ azimuth: Number(element.dataset.cameraAzimuth), resistance: Number(element.dataset.cameraLimitResistance), limits: JSON.parse(element.dataset.orbitLimits), open: element.dataset.hotspotOpen }))
  const settled = locked => page.waitForFunction(expected => { const element = document.querySelector('.model-stage'); return element?.dataset.cameraLocked === String(expected) && element?.dataset.cameraTransitioning !== 'true' }, locked, { timeout: 60_000 })
  const findCanvasPoint = () => page.evaluate(() => {
    for (let y = 100; y < innerHeight - 140; y += 30) for (let x = 120; x < innerWidth - 120; x += 20) if (document.elementFromPoint(x, y)?.tagName === 'CANVAS') return { x, y }
    throw new Error('Could not find an unobscured canvas point')
  })

  const normal = await read()
  const target = 2.97
  const delta = unwrap(target, normal.azimuth) - normal.azimuth
  const orbitPoint = { x: 180, y: 250 }
  const startX = delta > 0 ? Math.max(orbitPoint.x, 520) : Math.min(orbitPoint.x, 440)
  const endX = startX - delta * 720 / (Math.PI * 2)
  await page.mouse.move(startX, orbitPoint.y); await page.mouse.down(); await page.mouse.move(endX, orbitPoint.y, { steps: 12 }); await page.mouse.up(); await page.waitForTimeout(120)
  await marker.locator('button').evaluate(button => button.click()); await settled(true)

  const seamFocus = await read()
  const direction = seamFocus.limits.maxAzimuth > Math.PI ? 1 : seamFocus.limits.minAzimuth < -Math.PI ? -1 : 0
  assert.notEqual(direction, 0, `Expected wrapped seam bounds, got ${JSON.stringify(seamFocus.limits)}`)
  const center = (seamFocus.limits.minAzimuth + seamFocus.limits.maxAzimuth) / 2
  const point = await findCanvasPoint()
  const samples = [unwrap(seamFocus.azimuth, center)]
  const resistance = []
  await page.mouse.move(point.x, point.y); await page.mouse.down()
  for (let offset = 5; offset <= 10; offset += 5) {
    await page.mouse.move(point.x - direction * offset, point.y); await page.waitForTimeout(40)
    const state = await read(); samples.push(unwrap(state.azimuth, center)); resistance.push(state.resistance)
  }
  const edge = await read()
  assert.equal(edge.open, 'true', 'Seam hotspot must remain open during the resistance probe')
  const unwrappedEdge = unwrap(edge.azimuth, center)
  if (direction > 0) assert(unwrappedEdge <= edge.limits.maxAzimuth + 1e-4)
  else assert(unwrappedEdge >= edge.limits.minAzimuth - 1e-4)
  assert(direction * (samples.at(-1) - samples[0]) > 0, 'Seam input must move toward its wrapped bound')
  assert(Math.min(...resistance) < .999, 'Approaching the wrapped bound must receive resistance')
  await page.mouse.move(point.x - direction * 5, point.y); await page.waitForTimeout(40)
  const release = await read()
  assert(direction * (unwrap(release.azimuth, center) - unwrappedEdge) < -.015, 'Reversing at the seam must move away without a jump')
  assert(release.resistance > .99)
  await page.mouse.up()
  assert.deepEqual(errors, [])
  console.log(JSON.stringify({ piSeamHotspotMotion: true, hotspotStayedOpen: true, wrappedDirectionResistance: true, reversalNoJump: true }))
  await context.close()
} finally {
  await browser.close()
}
