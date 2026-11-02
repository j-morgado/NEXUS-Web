import { chromium } from 'playwright-core'

const baseURL = process.env.NEXUS_PREVIEW_URL ?? 'http://127.0.0.1:4177'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })

await page.goto(baseURL, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: /touch screen to begin/i }).click()
await page.getByRole('heading', { name: /choose an experience/i }).waitFor()
const startedAt = await page.evaluate(() => {
  window.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
  return performance.now()
})
await page.getByRole('alertdialog').waitFor({ timeout: 63_000 })
const warning = await page.evaluate((start) => ({ elapsed: performance.now() - start, text: document.querySelector('[role="alertdialog"]')?.textContent }), startedAt)
await page.getByRole('button', { name: /touch screen to begin/i }).waitFor({ timeout: 12_000 })
const expiredAt = await page.evaluate(() => performance.now())
await browser.close()

const expiresElapsed = expiredAt - startedAt
if (warning.elapsed < 59_500 || warning.elapsed > 61_500 || !warning.text?.includes(':10')) throw new Error(`Warning timing incorrect: ${JSON.stringify(warning)}`)
if (expiresElapsed < 69_500 || expiresElapsed > 71_500) throw new Error(`Expiry timing incorrect: ${expiresElapsed}`)
console.log(JSON.stringify({ warningElapsedMs: Math.round(warning.elapsed), warningText: warning.text, expiryElapsedMs: Math.round(expiresElapsed) }, null, 2))
