import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'

const baseURL = process.env.NEXUS_PREVIEW_URL ?? 'http://127.0.0.1:4177'
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox'],
})
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  serviceWorkers: 'block',
  isMobile: true,
  hasTouch: true,
})
const page = await context.newPage()
const browserErrors = []
page.on('pageerror', error => browserErrors.push(error.message))
page.on('console', message => { if (message.type() === 'error') browserErrors.push(message.text()) })

try {
  await page.goto(baseURL, { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: 'Enter NEXUS' }).waitFor()
  assert.equal(await page.locator('.attract').count(), 0, 'Experience mounted before access was granted')

  const card = await page.locator('.access-card').boundingBox()
  const button = await page.getByRole('button', { name: 'Enter site' }).boundingBox()
  assert(card && card.x >= 0 && card.x + card.width <= 390, 'Gate card overflows the phone viewport')
  assert(button && button.x >= 0 && button.x + button.width <= 390 && button.height >= 48, 'Gate action is clipped or undersized on phone')

  await page.getByLabel('Password').fill('wrong')
  await page.getByRole('button', { name: 'Enter site' }).click()
  await page.getByRole('alert').filter({ hasText: "That password isn't correct" }).waitFor()
  assert.equal(await page.locator('.attract').count(), 0, 'Wrong password exposed the experience')

  await page.getByLabel('Password').fill('nexus')
  await page.getByRole('button', { name: 'Enter site' }).click()
  await page.getByRole('button', { name: /touch screen to begin/i }).waitFor()
  assert.equal(await page.getByRole('heading', { name: 'Enter NEXUS' }).count(), 0, 'Gate remained after successful entry')

  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /touch screen to begin/i }).waitFor()
  assert.equal(await page.getByLabel('Password').count(), 0, 'Gate did not persist access through a same-session reload')
  assert.deepEqual(browserErrors, [])

  console.log(JSON.stringify({ wrongPasswordBlocked: true, correctPasswordEntered: true, sessionReloadRemembered: true, phoneViewport: '390x844', experienceReached: true }))
} finally {
  await context.close()
  await browser.close()
}

