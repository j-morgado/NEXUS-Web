import {chromium} from 'playwright-core'
import assert from 'node:assert/strict'
import { grantPreviewAccess } from './e2e-helpers.mjs'
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']})
try {
 const page=await browser.newPage({viewport:{width:1280,height:900},serviceWorkers:'block'});await grantPreviewAccess(page);const errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.goto(process.env.NEXUS_PREVIEW_URL ?? 'http://127.0.0.1:4177');await page.getByRole('button',{name:'Touch Screen to Begin'}).click();await page.getByRole('button',{name:/^Explorer/}).click();await page.locator('.experience-loading').waitFor({state:'detached'})
 for(const kind of ['images','videos','Documents']) {
  await page.getByRole('button',{name:kind,exact:true}).click()
  const sample = async opening => page.evaluate(async opening=>{
   const values=[];const start=performance.now()
   const button=opening?document.querySelector('.media-grid > button'):document.querySelector('.lightbox-close')
   button.click()
   await new Promise(resolve=>{
    function tick(){const panel=document.querySelector('.media-lightbox'),overlay=document.querySelector('.media-overlay');if(panel)values.push({opacity:Number(getComputedStyle(panel).opacity),blur:parseFloat(getComputedStyle(overlay).backdropFilter.replace('blur(',''))});if(performance.now()-start<1250)requestAnimationFrame(tick);else resolve()}
    requestAnimationFrame(tick)
   });return values
  },opening)
  const opening=await sample(true)
  assert(opening.some(v=>v.opacity<.1));assert(opening.filter(v=>v.opacity>.1&&v.opacity<.9).length>=2);assert(opening.at(-1).opacity>.99);assert(opening.some(v=>v.blur>0&&v.blur<12))
  const closing=await sample(false);assert(closing.filter(v=>v.opacity>.1&&v.opacity<.9).length>=2);assert.equal(await page.locator('.media-overlay').count(),0)
  console.log(kind,'actual frames show opening and closing opacity/blur interpolation')
 }
 assert.deepEqual(errors,[])
}finally{await browser.close()}
