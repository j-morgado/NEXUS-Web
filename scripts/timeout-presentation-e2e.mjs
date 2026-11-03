import { chromium } from 'playwright-core'
import assert from 'node:assert/strict'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] })
try {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 960, height: 640 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport, serviceWorkers: 'block' })
    await page.goto(`${process.env.NEXUS_PREVIEW_URL ?? 'http://127.0.0.1:4177'}?testTimeout=3`)
    await page.getByRole('button', { name: 'Touch Screen to Begin' }).click()
    const dialog = page.getByRole('alertdialog')
    await dialog.waitFor()
    const bounds = await dialog.boundingBox()
    assert(Math.abs(bounds.x + bounds.width / 2 - viewport.width / 2) < 1)
    assert(Math.abs(bounds.y + bounds.height / 2 - viewport.height / 2) < 1)
    assert(bounds.x >= 0 && bounds.x + bounds.width <= viewport.width)
    const sample = () => page.evaluate(() => {
      const overlay = document.querySelector('.timeout-scrim'), dialog = document.querySelector('.timeout-warning')
      return { opacity: Number(getComputedStyle(dialog).opacity), blur: parseFloat(getComputedStyle(overlay).backdropFilter.match(/[\d.]+/)[0]), background: getComputedStyle(overlay).backgroundColor, portal: overlay.parentNode === document.body }
    })
    await page.evaluate(() => {
      const overlay = document.querySelector('.timeout-scrim'), dialog = document.querySelector('.timeout-warning')
      const fade = dialog.getAnimations().find(animation => animation.animationName === 'timeout-dialog')
      const backdrop = overlay.getAnimations().find(animation => animation.animationName === 'timeout-backdrop')
      if (!fade || !backdrop) throw new Error('Expected dialog and backdrop animations')
      if (fade.effect.getTiming().duration !== 350 || backdrop.effect.getTiming().duration !== 1200) throw new Error('Unexpected animation duration')
      for (const animation of [fade, backdrop]) { animation.pause(); animation.currentTime = 120 }
    })
    const early = await sample()
    assert(early.opacity > 0 && early.opacity < 1)
    assert(early.blur > 0 && early.blur < 12)
    assert(early.portal)
    await page.evaluate(() => {
      for (const element of document.querySelectorAll('.timeout-scrim,.timeout-warning')) {
        for (const animation of element.getAnimations()) animation.currentTime = 1200
      }
    })
    const late = await sample()
    assert.equal(late.opacity, 1)
    assert(late.blur > early.blur && late.blur >= 11.9)
    assert.notEqual(late.background, early.background)
    await page.screenshot({ path: `/tmp/nexus-timeout-${viewport.width}.png` })
    await dialog.evaluate(element => element.click())
    assert.equal(await page.getByRole('alertdialog').count(), 0)
    console.log(`${viewport.width}x${viewport.height}: viewport-centered, responsive, fading dialog, gradual background blur/dimming and dismissal passed`)
    await page.close()
  }
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' })
  await page.goto('http://127.0.0.1:4177?testTimeout=3')
  await page.getByRole('button', { name: 'Touch Screen to Begin' }).click()
  await page.getByRole('alertdialog').waitFor()
  await page.waitForTimeout(50)
  assert.equal(await page.getByRole('alertdialog').evaluate(element => getComputedStyle(element).opacity), '1')
  await page.getByRole('button', { name: 'Touch Screen to Begin' }).waitFor({ timeout: 5000 })
  console.log('Reduced motion and timeout reset to attract passed')
} finally { await browser.close() }
