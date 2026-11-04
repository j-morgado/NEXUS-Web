import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'

const baseUrl = process.env.NEXUS_PREVIEW_URL ?? 'http://127.0.0.1:4177'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })

async function open(path) {
  const page = await browser.newPage({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 1 })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.addInitScript(() => {
    window.__nexusModuleEvents = []
    window.addEventListener('nexus:module', event => window.__nexusModuleEvents.push(event.detail))
  })
  await page.goto(`${baseUrl}${path}`, { waitUntil: 'networkidle' })
  const password = page.locator('#site-password')
  if (await password.count()) {
    await password.fill('nexus')
    await page.getByRole('button', { name: 'Enter site' }).click()
  }
  return { page, errors }
}

async function waitForModule(page, id, mode) {
  await page.waitForFunction(expected => {
    const root = document.querySelector('.configurator')
    const stage = document.querySelector('.model-stage')
    return root?.dataset.moduleId === expected.id && root?.dataset.hostMode === expected.mode && stage?.dataset.modelReady === 'true'
  }, { id, mode }, { timeout: 30_000 })
  await page.waitForFunction(moduleId => window.__nexusModuleEvents.some(event => event.type === 'module:ready' && event.moduleId === moduleId), id)
}

try {
  const hub = await open('/')
  await hub.page.getByRole('button', { name: /touch screen to begin/i }).click()
  assert.equal(await hub.page.getByRole('heading', { name: 'Training Rig' }).count(), 0, 'Template fixture must not add a hub card')
  await hub.page.locator('.hub-card-primary').click()
  await waitForModule(hub.page, 'jltv', 'hub')
  assert.equal(await hub.page.locator('.operator-trigger').count(), 1, 'Existing hub Dev Options trigger should remain')
  assert.deepEqual(hub.errors, [])
  await hub.page.close()

  const standalone = await open('/modules/jltv')
  await waitForModule(standalone.page, 'jltv', 'standalone')
  assert.equal(await standalone.page.locator('.operator-trigger').count(), 0, 'Standalone module must not expose creator controls')
  assert.equal(await standalone.page.getByRole('heading', { name: 'JLTV' }).count(), 1)
  assert.deepEqual(standalone.errors, [])
  await standalone.page.close()

  const fixture = await open('/modules/training-rig')
  await waitForModule(fixture.page, 'training-rig', 'standalone')
  assert.equal(await fixture.page.getByRole('heading', { name: 'Training Rig' }).count(), 1)
  assert.match(await fixture.page.locator('.model-stage').evaluate(element => getComputedStyle(element.querySelector('canvas')).backgroundColor), /rgba?\(/)
  assert.deepEqual(fixture.errors, [])
  await fixture.page.close()

  const missing = await open('/modules/not-packaged')
  await missing.page.getByRole('heading', { name: /not packaged/i }).waitFor()
  assert.equal(await missing.page.locator('canvas').count(), 0)
  assert.deepEqual(missing.errors, [])
  await missing.page.close()

  console.log('Hub, standalone JLTV, claim-free fixture, gate, no-creator-controls, lifecycle, and missing-module paths passed')
} finally {
  await browser.close()
}

