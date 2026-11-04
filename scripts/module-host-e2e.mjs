import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright-core'

const mime = { '.css': 'text/css', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.mp4': 'video/mp4', '.otf': 'font/otf', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp' }
let server
let baseUrl = process.env.NEXUS_PREVIEW_URL

if (!baseUrl) {
  const distRoot = path.resolve('dist')
  server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://static.test').pathname)
      let filePath = path.resolve(distRoot, `.${pathname}`)
      if (!filePath.startsWith(`${distRoot}${path.sep}`) && filePath !== distRoot) throw new Error('Invalid path')
      const info = await stat(filePath)
      if (info.isDirectory()) filePath = path.join(filePath, 'index.html')
      const body = await readFile(filePath)
      response.writeHead(200, { 'content-type': mime[path.extname(filePath)] ?? 'application/octet-stream', 'cache-control': 'no-store' })
      response.end(body)
    } catch {
      response.writeHead(404, { 'content-type': 'text/plain' })
      response.end('Not found')
    }
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })

async function open(route) {
  const page = await browser.newPage({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 1 })
  const errors = [], moduleEvents = [], activityEvents = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.exposeFunction('__recordModuleEvent', event => moduleEvents.push(event))
  await page.exposeFunction('__recordActivityEvent', event => activityEvents.push(event))
  await page.addInitScript(() => {
    const tracked = new Set(['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'keydown'])
    window.__trackedDocumentListeners = Object.fromEntries([...tracked].map(type => [type, new Set()]))
    const add = document.addEventListener.bind(document), remove = document.removeEventListener.bind(document)
    document.addEventListener = (type, listener, options) => {
      if (tracked.has(type)) window.__trackedDocumentListeners[type].add(listener)
      return add(type, listener, options)
    }
    document.removeEventListener = (type, listener, options) => {
      if (tracked.has(type)) window.__trackedDocumentListeners[type].delete(listener)
      return remove(type, listener, options)
    }
    window.addEventListener('nexus:module', event => window.__recordModuleEvent(event.detail))
    window.addEventListener('nexus:activity', event => window.__recordActivityEvent(event.detail))
  })
  const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' })
  assert.equal(response.status(), 200, `${route} should be emitted as a static route shell`)
  const password = page.locator('#site-password')
  if (await password.count()) {
    await password.fill('nexus')
    await page.getByRole('button', { name: 'Enter site' }).click()
  }
  return { page, errors, moduleEvents, activityEvents }
}

async function waitForModule(page, id, mode) {
  await page.waitForFunction(expected => {
    const root = document.querySelector('.configurator')
    const stage = document.querySelector('.model-stage')
    return root?.dataset.moduleId === expected.id && root?.dataset.hostMode === expected.mode && stage?.dataset.modelReady === 'true'
  }, { id, mode }, { timeout: 30_000 })
}

async function waitForRecord(records, predicate, message) {
  const deadline = Date.now() + 5_000
  while (Date.now() < deadline) {
    if (predicate(records)) return
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  assert.fail(message)
}

try {
  if (server) {
    assert.equal((await fetch(`${baseUrl}/modules/jltv`)).status, 200)
    assert.equal((await fetch(`${baseUrl}/modules/jltv/index.html`)).status, 200)
    assert.equal((await fetch(`${baseUrl}/modules/not-packaged`)).status, 404, 'Strict server must not mask missing files with SPA fallback')
  }

  const hub = await open('/')
  await hub.page.getByRole('button', { name: /touch screen to begin/i }).click()
  assert.equal(await hub.page.getByRole('heading', { name: 'Training Rig' }).count(), 0, 'Template fixture must not add a hub card')
  await hub.page.locator('.hub-card-primary').click()
  await waitForModule(hub.page, 'jltv', 'hub')
  const stage = hub.page.locator('.model-stage')
  assert.equal(await stage.getAttribute('data-configured-vehicle-node'), 'JLTV')
  assert.equal(await stage.getAttribute('data-configured-model-url'), '/assets/jltv-runtime.glb')
  assert.deepEqual(JSON.parse(await stage.getAttribute('data-configured-addon-nodes')), ['Addon 1'])
  assert.deepEqual(JSON.parse(await stage.getAttribute('data-model-nodes')).map(node => node.name), ['JLTV', 'Addon_1'])
  assert.equal(await hub.page.getByRole('button', { name: 'Add-on 2' }).isDisabled(), true)
  await hub.page.getByRole('button', { name: 'Add-on 1' }).click()
  await hub.page.waitForFunction(() => JSON.parse(document.querySelector('.model-stage').dataset.visibleAddonIds).includes('addon-1'))
  assert(hub.activityEvents.some(event => event.type === 'activity' && event.moduleId === 'jltv'))
  assert.equal(await hub.page.locator('.operator-trigger').count(), 1)

  await hub.page.getByRole('button', { name: /^Return to Hub$/ }).click()
  await hub.page.getByRole('heading', { name: 'Choose an Experience' }).waitFor()
  assert.equal(hub.moduleEvents.filter(event => event.type === 'module:exit' && event.moduleId === 'jltv').length, 1)
  assert.deepEqual(await hub.page.evaluate(() => Object.fromEntries(Object.entries(window.__trackedDocumentListeners).map(([type, listeners]) => [type, listeners.size]))), { pointerdown: 0, pointermove: 0, pointerup: 0, pointercancel: 0, keydown: 0 })

  await hub.page.locator('.hub-card-primary').click()
  await waitForModule(hub.page, 'jltv', 'hub')
  await waitForRecord(hub.moduleEvents, events => events.filter(event => event.type === 'module:ready' && event.moduleId === 'jltv').length === 2, 'Second hub entry did not emit ready')
  assert.equal(hub.moduleEvents.filter(event => event.type === 'module:ready' && event.moduleId === 'jltv').length, 2)
  await hub.page.getByRole('button', { name: /^Return to Hub$/ }).click()
  await hub.page.getByRole('heading', { name: 'Choose an Experience' }).waitFor()
  assert.deepEqual(await hub.page.evaluate(() => Object.fromEntries(Object.entries(window.__trackedDocumentListeners).map(([type, listeners]) => [type, listeners.size]))), { pointerdown: 0, pointermove: 0, pointerup: 0, pointercancel: 0, keydown: 0 })
  assert.deepEqual(hub.errors, [])
  await hub.page.close()

  const standalone = await open('/modules/jltv')
  await waitForModule(standalone.page, 'jltv', 'standalone')
  assert.equal(await standalone.page.locator('.operator-trigger').count(), 0)
  await standalone.page.reload({ waitUntil: 'networkidle' })
  await waitForModule(standalone.page, 'jltv', 'standalone')
  await standalone.page.getByRole('button', { name: /^Return to Hub$/ }).click()
  await standalone.page.getByRole('button', { name: /touch screen to begin/i }).waitFor()
  assert(standalone.moduleEvents.some(event => event.type === 'module:exit' && event.moduleId === 'jltv'))
  assert.deepEqual(standalone.errors, [])
  await standalone.page.close()

  const fixture = await open('/modules/training-rig')
  await waitForModule(fixture.page, 'training-rig', 'standalone')
  assert.equal(await fixture.page.locator('.vehicle-heading h1').textContent(), 'Training Rig')
  assert.equal(await fixture.page.locator('.model-stage').getAttribute('data-scene-background'), '#334765')
  assert.deepEqual(JSON.parse(await fixture.page.locator('.model-stage').getAttribute('data-camera-start')).position, [8.2, 3.4, 8.4])
  const alpha = fixture.page.getByRole('button', { name: 'Training add-on A' })
  const beta = fixture.page.getByRole('button', { name: 'Training add-on B' })
  await alpha.click()
  await fixture.page.waitForFunction(() => JSON.parse(document.querySelector('.model-stage').dataset.visibleAddonIds).join(',') === 'training-alpha')
  await beta.click()
  await fixture.page.waitForFunction(() => JSON.parse(document.querySelector('.model-stage').dataset.visibleAddonIds).join(',') === 'training-beta')
  await beta.click()
  await fixture.page.waitForFunction(() => JSON.parse(document.querySelector('.model-stage').dataset.visibleAddonIds).length === 0)
  assert.deepEqual(fixture.errors, [])
  await fixture.page.close()

  const failure = await open('/modules/jltv?fault=model')
  await failure.page.getByRole('heading', { name: /JLTV is temporarily unavailable/i }).waitFor({ timeout: 30_000 })
  await new Promise(resolve => setTimeout(resolve, 50))
  assert(failure.moduleEvents.some(event => event.type === 'module:error' && event.moduleId === 'jltv'))
  assert(failure.errors.length > 0, 'The injected model-load failure should be observable')
  await failure.page.close()

  console.log('Strict static routes, reload/exit/error/activity lifecycle, repeat-entry cleanup, configured nodes, two-node add-on switching, scene values, and hub/standalone paths passed')
} finally {
  await browser.close()
  if (server) await new Promise(resolve => server.close(resolve))
}

