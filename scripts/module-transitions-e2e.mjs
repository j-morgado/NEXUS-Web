import { chromium } from 'playwright-core'
import assert from 'node:assert/strict'
import { grantPreviewAccess } from './e2e-helpers.mjs'
const browser = await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']})
try {
 for(const width of [1280,390]) {
  const page=await browser.newPage({viewport:{width,height:844},serviceWorkers:'block'});await grantPreviewAccess(page)
  const errors=[];page.on('pageerror',error=>errors.push(error.message))
  await page.addInitScript(() => { window.loadingPhases=[]; document.addEventListener('DOMContentLoaded',()=>new MutationObserver(()=>{const e=document.querySelector('.experience-loading');if(e)window.loadingPhases.push(e.dataset.phase)}).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['data-phase']})) })
  await page.goto(process.env.NEXUS_PREVIEW_URL ?? 'http://127.0.0.1:4177')
  const finish=async()=>{await page.locator('.experience-loading').waitFor({state:'detached'});assert.equal(await page.locator('[data-quality-tier]').evaluate(e=>e.inert),false)}
  await page.getByRole('button',{name:'Touch Screen to Begin'}).click()
  await page.locator('.reference-hub.is-entering-from-attract').waitFor()
  assert.equal(await page.locator('.experience-loading').count(),0)
  assert.equal(await page.locator('.hub-carousel').evaluate(e=>getComputedStyle(e).animationName),'hub-cards-enter')
  assert.equal(await page.locator('.hub-explorer').evaluate(e=>getComputedStyle(e).animationName),'hub-explorer-enter')
  assert.equal(await page.locator('.hub-arrows').evaluate(e=>getComputedStyle(e).animationName),'hub-copy-enter')
  assert.equal(await page.locator('.shared-loop-media video').evaluate(v=>v.paused),false)
  await page.waitForTimeout(850)
  for(let i=0;i<2;i++) {
   await page.getByRole('button',{name:/^Explorer/}).click()
   await page.locator('.experience-loading[data-phase="covering"]').waitFor()
   await finish();assert(await page.locator('.catalog-explorer').isVisible())
   const styles=await page.locator('.catalog-explorer').evaluate(e=>e.inert);assert.equal(styles,false)
   await page.getByRole('button',{name:/Back to hub/}).click()
   await page.locator('.experience-loading[data-phase="covering"]').waitFor()
   await finish();assert(await page.getByRole('button',{name:/^Explorer/}).isVisible())
  }
  assert(await page.evaluate(()=>window.loadingPhases.includes('revealing')))
  await page.emulateMedia({reducedMotion:'reduce'})
  await page.getByRole('button',{name:/^Explorer/}).click();await page.locator('.catalog-explorer').waitFor();await page.locator('.experience-loading').waitFor({state:'detached'})
  assert.deepEqual(errors,[]);console.log(width,'hub/explorer entrances, returns, repeat visits, thin square bar, inert gating and reduced motion passed');await page.close()
 }
} finally {await browser.close()}
