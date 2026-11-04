import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const context = await browser.newContext({ viewport: { width: 960, height: 620 }, serviceWorkers: 'block', reducedMotion: 'reduce', hasTouch: true })
await context.addInitScript(() => sessionStorage.setItem('nexus:access-granted', 'true'))
const page = await context.newPage()
const errors = []
page.on('pageerror', error => errors.push(error.message))
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })

const openBottomMarker = async () => {
  const markers = page.locator('.vehicle-hotspot[data-visible="true"]')
  await page.waitForFunction(() => [...document.querySelectorAll('.vehicle-hotspot')].some(element => element.dataset.visible === 'true'))
  const count = await markers.count()
  let selected = markers.first()
  let bottom = -Infinity
  for (let index = 0; index < count; index += 1) {
    const candidate = markers.nth(index)
    const bounds = await candidate.boundingBox()
    if (bounds && bounds.y > bottom) { selected = candidate; bottom = bounds.y }
  }
  const id = await selected.getAttribute('data-hotspot-id')
  assert(id)
  selected = page.locator(`[data-hotspot-id="${id}"]`)
  const before = await selected.boundingBox()
  await selected.locator('button').evaluate(button => button.click())
  await page.waitForFunction(() => document.querySelectorAll('.vehicle-hotspot.is-open').length === 1)
  const after = await selected.boundingBox()
  assert(before && after)
  assert(Math.abs((before.x + 21) - (after.x + 21)) < 1, 'Opening moved the hotspot anchor horizontally')
  assert(Math.abs((before.y + 21) - (after.y + 21)) < 1, 'Opening moved the hotspot anchor vertically')
  return selected
}

const touchGesture = async (from, to) => {
  await page.evaluate(({ from, to }) => {
    document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 71, pointerType: 'touch', isPrimary: true, clientX: from.x, clientY: from.y }))
    if (to) document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 71, pointerType: 'touch', isPrimary: true, clientX: to.x, clientY: to.y }))
    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 71, pointerType: 'touch', isPrimary: true, clientX: to?.x ?? from.x, clientY: to?.y ?? from.y }))
  }, { from, to })
}

try {
  await page.goto(process.env.NEXUS_PREVIEW_URL ?? 'http://127.0.0.1:4177', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /touch screen to begin/i }).click()
  await page.locator('.hub-card-primary').click()
  await page.locator('.experience-loading').waitFor({ state: 'detached', timeout: 90_000 })
  const stage = page.locator('.model-stage')
  const canvas = page.locator('canvas')

  let marker = await openBottomMarker()
  const button = marker.locator('button')
  await button.click()
  assert.equal(await page.locator('.vehicle-hotspot.is-open').count(), 0)
  await button.click()
  assert.equal(await page.locator('.vehicle-hotspot.is-open').count(), 1)

  const canvasBounds = await canvas.boundingBox()
  assert(canvasBounds)
  const start = { x: canvasBounds.x + canvasBounds.width * .72, y: canvasBounds.y + canvasBounds.height * .42 }
  await page.evaluate(({ start }) => {
    document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 17, pointerType: 'mouse', isPrimary: true, clientX: start.x, clientY: start.y }))
    document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 17, pointerType: 'mouse', isPrimary: true, clientX: start.x + 18, clientY: start.y + 3 }))
    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 17, pointerType: 'mouse', isPrimary: true, clientX: start.x + 18, clientY: start.y + 3 }))
  }, { start })
  assert.equal(await stage.getAttribute('data-hotspot-open'), 'true', 'Mouse orbit drag dismissed the hotspot')

  await page.mouse.click(start.x, start.y)
  assert.equal(await stage.getAttribute('data-hotspot-open'), 'false', 'Outside mouse click did not dismiss the hotspot')

  marker = await openBottomMarker()
  await touchGesture(start, { x: start.x + 20, y: start.y + 2 })
  assert.equal(await stage.getAttribute('data-hotspot-open'), 'true', 'Touch drag dismissed the hotspot')
  await touchGesture(start)
  assert.equal(await stage.getAttribute('data-hotspot-open'), 'false', 'Outside touch tap did not dismiss the hotspot')

  await page.setViewportSize({ width: 390, height: 844 })
  marker = await openBottomMarker()
  const mobileBounds = await marker.boundingBox()
  assert(mobileBounds && Math.abs((mobileBounds.x + 21) - Number(await marker.evaluate(element => parseFloat(element.style.left)))) < 1)
  await page.screenshot({ path: '/tmp/nexus-hotspot-anchor-mobile.png' })
  await marker.locator('button').evaluate(button => button.click())

  await page.setViewportSize({ width: 960, height: 620 })
  marker = await openBottomMarker()
  const selectedId = await marker.getAttribute('data-hotspot-id')
  let closedByOcclusion = false
  for (let turn = 0; turn < 10 && !closedByOcclusion; turn += 1) {
    await page.mouse.move(760, 260)
    await page.mouse.down()
    await page.mouse.move(230, 260, { steps: 8 })
    await page.mouse.up()
    await page.waitForTimeout(160)
    closedByOcclusion = await stage.getAttribute('data-hotspot-open') === 'false' && await page.locator(`[data-hotspot-id="${selectedId}"]`).getAttribute('data-occluded') === 'true'
  }
  assert(closedByOcclusion, 'Vehicle occlusion did not hide and close the selected hotspot')
  assert.deepEqual(errors, [])
  console.log(JSON.stringify({ anchorStableDesktop: true, anchorStableMobile: true, repeatedToggle: true, mouseDragRetained: true, mouseClickDismissed: true, touchDragRetained: true, touchTapDismissed: true, occlusionClosed: true }))
} finally {
  await context.close()
  await browser.close()
}

