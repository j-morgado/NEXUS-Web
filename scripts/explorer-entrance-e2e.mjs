import {chromium} from 'playwright-core'
import assert from 'node:assert/strict'
import { grantPreviewAccess } from './e2e-helpers.mjs'
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']})
try {
 const page=await browser.newPage({viewport:{width:1280,height:900},serviceWorkers:'block'});await grantPreviewAccess(page);const errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.goto(process.env.NEXUS_PREVIEW_URL ?? 'http://127.0.0.1:4177');await page.getByRole('button',{name:'Touch Screen to Begin'}).click();await page.getByRole('button',{name:/^Explorer/}).click()
 await page.locator('.catalog-explorer.is-presenting').waitFor()
 assert.equal(await page.locator('.market-toggle[aria-expanded="true"]').count(),0)
 const delays=await page.locator('.market-entrance').evaluateAll(es=>es.map(e=>parseFloat(getComputedStyle(e).animationDelay)));assert(delays.length>1&&delays[1]>delays[0])
 await page.locator('.market-toggle').first().and(page.locator('[aria-expanded="true"]')).waitFor()
 await page.locator('.catalog-feature button[aria-expanded="true"]').waitFor()
 const heroDelays=await page.locator('.catalog-hero-copy > *').evaluateAll(es=>es.map(e=>parseFloat(getComputedStyle(e).animationDelay)));assert(heroDelays.every((delay,i)=>i===0||delay>heroDelays[i-1]))
 const replay=await page.evaluate(async()=>{
  document.querySelectorAll('.product-list button')[1].click()
  await new Promise(resolve=>requestAnimationFrame(resolve))
  return {closed:!document.querySelector('.catalog-feature button[aria-expanded="true"]'),hero:document.querySelector('.catalog-hero-copy h2').getAnimations().some(a=>a.playState==='running'),features:document.querySelector('.catalog-feature').getAnimations().some(a=>a.playState==='running')}
 })
 assert.deepEqual(replay,{closed:true,hero:true,features:true})
 await page.locator('.catalog-feature button[aria-expanded="true"]').waitFor()
 assert.equal(await page.locator('.market-entrance').first().evaluate(e=>e.getAnimations().some(a=>a.playState==='running')),false)
 await page.emulateMedia({reducedMotion:'reduce'});await page.locator('.product-list button').nth(2).click();assert.equal(await page.locator('.catalog-feature').first().evaluate(e=>getComputedStyle(e).animationName),'none');await page.locator('.catalog-feature button[aria-expanded="true"]').waitFor()
 assert.deepEqual(errors,[]);console.log('Staggered market entrance and delayed opening, per-product feature/hero replay, stable market state, reduced motion passed')
}finally{await browser.close()}
