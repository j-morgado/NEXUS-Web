import { chromium } from 'playwright-core'
import assert from 'node:assert/strict'
const browser = await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']})
try {
 for(const width of [1280,390]) {
  const page=await browser.newPage({viewport:{width,height:844},serviceWorkers:'block'})
  const errors=[];page.on('pageerror',error=>errors.push(error.message))
  await page.goto(process.env.NEXUS_PREVIEW_URL ?? 'http://127.0.0.1:4177')
  const finish=async()=>{await page.locator('.experience-loading.is-leaving').waitFor();assert.equal(await page.locator('[data-quality-tier]').evaluate(e=>e.inert),true);await page.locator('.experience-loading').waitFor({state:'detached'});assert.equal(await page.locator('[data-quality-tier]').evaluate(e=>e.inert),false)}
  await page.getByRole('button',{name:'Touch Screen to Begin'}).click()
  await page.locator('.experience-loading[data-phase="covering"]').waitFor()
  const styles=await page.locator('.experience-progress').evaluate(e=>({height:getComputedStyle(e).height,radius:getComputedStyle(e).borderRadius}))
  assert.deepEqual(styles,{height:'3px',radius:'0px'})
  assert.equal((await page.locator('.experience-loading').innerText()).trim(),'Loading')
  await finish()
  for(let i=0;i<2;i++) {
   await page.getByRole('button',{name:/^Explorer/}).click()
   await page.locator('.experience-loading[data-phase="covering"]').waitFor()
   await finish();assert(await page.locator('.catalog-explorer').isVisible())
   await page.getByRole('button',{name:/Back to hub/}).click()
   await page.locator('.experience-loading[data-phase="covering"]').waitFor()
   await finish();assert(await page.getByRole('button',{name:/^Explorer/}).isVisible())
  }
  await page.emulateMedia({reducedMotion:'reduce'})
  await page.getByRole('button',{name:/^Explorer/}).click();await page.locator('.catalog-explorer').waitFor();await page.locator('.experience-loading').waitFor({state:'detached'})
  assert.deepEqual(errors,[]);console.log(width,'hub/explorer entrances, returns, repeat visits, thin square bar, inert gating and reduced motion passed');await page.close()
 }
} finally {await browser.close()}
