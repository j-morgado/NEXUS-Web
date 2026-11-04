import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'

const baseURL = process.env.NEXUS_PREVIEW_URL ?? 'http://127.0.0.1:4177'
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox'],
})

const desktopContext = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  serviceWorkers: 'block',
})
const desktopPage = await desktopContext.newPage()
await desktopPage.goto(baseURL, { waitUntil: 'networkidle' })
await desktopPage.getByRole('heading', { name: 'NEXUS', exact: true }).waitFor()
const desktopCard = await desktopPage.locator('.access-card').boundingBox()
const desktopLogo = await desktopPage.getByRole('img', { name: 'Leidos' }).boundingBox()
const desktopInput = await desktopPage.getByLabel('Password').boundingBox()
const desktopButton = await desktopPage.getByRole('button', { name: 'Enter site' }).boundingBox()
const inputStyle = await desktopPage.getByLabel('Password').evaluate(element => {
  const style = getComputedStyle(element)
  return { borderColor: style.borderColor, borderWidth: style.borderWidth }
})
assert(desktopCard && desktopLogo && desktopLogo.x + desktopLogo.width > desktopCard.x + desktopCard.width - 2, 'Leidos logo is not right aligned')
assert(desktopInput && desktopButton && Math.abs(desktopInput.y - desktopButton.y) < 2, 'Password and Enter controls are not aligned in one row')
assert.equal(inputStyle.borderWidth, '1px', 'Password field must use a single-line outline')
assert.equal(inputStyle.borderColor, 'rgb(76, 50, 145)', 'Password field must use approved purple')
assert.equal(await desktopPage.getByText('Restricted Preview', { exact: true }).count(), 1)
assert.equal(await desktopPage.getByText('Enter NEXUS', { exact: true }).count(), 0)
assert.equal(await desktopPage.getByText('This working preview is intended for invited collaborators.', { exact: true }).count(), 0)
await desktopPage.screenshot({ path: '/tmp/nexus-access-desktop.png', fullPage: true })
await desktopContext.close()

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
  await page.getByRole('heading', { name: 'NEXUS', exact: true }).waitFor()
  assert.equal(await page.locator('.attract').count(), 0, 'Experience mounted before access was granted')

  const card = await page.locator('.access-card').boundingBox()
  const input = await page.getByLabel('Password').boundingBox()
  const button = await page.getByRole('button', { name: 'Enter site' }).boundingBox()
  assert(card && card.x >= 0 && card.x + card.width <= 390, 'Gate card overflows the phone viewport')
  assert(button && button.x >= 0 && button.x + button.width <= 390 && button.height >= 48, 'Gate action is clipped or undersized on phone')
  assert(input && Math.abs(input.y - button.y) < 2, 'Password and Enter controls do not remain together on phone')
  await page.screenshot({ path: '/tmp/nexus-access-mobile.png', fullPage: true })

  await page.getByLabel('Password').fill('wrong')
  await page.getByRole('button', { name: 'Enter site' }).click()
  await page.getByRole('alert').filter({ hasText: "That password isn't correct" }).waitFor()
  assert.equal(await page.locator('.attract').count(), 0, 'Wrong password exposed the experience')

  await page.getByLabel('Password').fill('nexus')
  await page.getByRole('button', { name: 'Enter site' }).click()
  await page.getByRole('button', { name: /touch screen to begin/i }).waitFor()
  assert.equal(await page.getByRole('heading', { name: 'NEXUS', exact: true }).count(), 0, 'Gate remained after successful entry')

  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /touch screen to begin/i }).waitFor()
  assert.equal(await page.getByLabel('Password').count(), 0, 'Gate did not persist access through a same-session reload')
  assert.deepEqual(browserErrors, [])

  console.log(JSON.stringify({ desktopLayout: '1440x900', logoRightAligned: true, approvedPurpleOutline: true, wrongPasswordBlocked: true, correctPasswordEntered: true, sessionReloadRemembered: true, phoneViewport: '390x844', controlsTogetherOnPhone: true, experienceReached: true }))
} finally {
  await context.close()
  await browser.close()
}

