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
  await page.goto(baseURL, { waitUntil: 'networkidle' })
  await unlock()
  await page.getByRole('button', { name: /touch screen to begin/i }).waitFor()
  assert.equal(await page.getByRole('navigation', { name: 'Environment preview' }).count(), 0, 'Environment controls leaked into the visitor root')

  await page.goto(`${baseURL}?environmentLab=1`, { waitUntil: 'networkidle' })
  await unlock()
  await page.getByRole('navigation', { name: 'Environment preview' }).waitFor()
  await page.waitForFunction(() => document.querySelector('.environment-lab')?.getAttribute('data-scene-ready') === 'true')
  await mkdir('review-evidence/environment-exploration', { recursive: true })

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
    if (kind !== 'land') {
      const first = await page.locator('canvas').screenshot()
      await page.waitForTimeout(700)
      const second = await page.locator('canvas').screenshot()
      assert.notEqual(createHash('sha256').update(first).digest('hex'), createHash('sha256').update(second).digest('hex'), `${kind} scene did not visibly animate`)
    }
  }

  await page.getByRole('button', { name: /creator tools/i }).click()
  await page.getByRole('heading', { name: 'Scene direction' }).waitFor()
  const creatorPath = 'review-evidence/environment-exploration/creator-tools.png'
  await page.screenshot({ path: creatorPath, fullPage: true })
  screenshots.push(creatorPath)
  const keyLight = page.getByLabel('Key light')
  await keyLight.fill('3.25')
  assert.equal(await keyLight.inputValue(), '3.25')
  await page.getByRole('button', { name: /copy json/i }).click()
  await page.getByText(/configuration copied|clipboard unavailable/i).waitFor()
  await page.getByRole('button', { name: /reset air/i }).click()
  assert.equal(await keyLight.inputValue(), '2.65')

  assert.deepEqual(browserErrors, [])
  console.log(JSON.stringify({ routeIsolation: true, environments: ['land', 'sea', 'air'], creatorControls: true, dynamicSea: true, dynamicAir: true, viewport: '1440x900', screenshots, browserErrors }, null, 2))
} finally {
  await context.close()
  await browser.close()
}
