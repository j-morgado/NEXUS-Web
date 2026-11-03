import { chromium } from 'playwright-core'
import assert from 'node:assert/strict'
const browser = await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']})
try {
for (const width of [1280,390]) {
 const page=await browser.newPage({viewport:{width,height:844},serviceWorkers:'block'});const errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.addInitScript(()=>{window.tileAnimations=[];const animate=Element.prototype.animate;Element.prototype.animate=function(frames,options){if(this.matches('.media-grid > button'))window.tileAnimations.push({id:this.dataset.mediaId,frames,options});return animate.call(this,frames,options)}})
 await page.goto(process.env.NEXUS_PREVIEW_URL ?? 'http://127.0.0.1:4177');await page.getByRole('button',{name:'Touch Screen to Begin'}).click();await page.getByRole('button',{name:/^Explorer/}).click()
 await page.locator('.media-grid > button').first().waitFor()
 const delays=await page.evaluate(()=>window.tileAnimations.map(a=>a.options.delay));assert(delays.length>2);assert(delays[1]>delays[0]);
 await page.waitForTimeout(850);await page.evaluate(()=>window.tileAnimations=[])
 await page.getByRole('button',{name:'Documents',exact:true}).click();assert(await page.evaluate(()=>window.tileAnimations.some(a=>a.frames[0].transform.startsWith('translate('))))
 await page.getByRole('button',{name:'All media',exact:true}).click();await page.getByRole('button',{name:'videos',exact:true}).click();await page.getByRole('button',{name:'images',exact:true}).click();await page.waitForTimeout(850)
 assert(await page.locator('.media-grid > button').count()>0);assert.equal(await page.locator('.media-grid > button').evaluateAll(tiles=>tiles.some(t=>t.getAnimations().some(a=>a.playState==='running'))),false)
 await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>window.tileAnimations=[]);await page.getByRole('button',{name:'All media',exact:true}).click();assert.equal(await page.evaluate(()=>window.tileAnimations.length),0)
 await page.locator('.product-list button').nth(1).click();assert.equal(await page.getByRole('button',{name:'All media',exact:true}).getAttribute('aria-pressed'),'true')
 assert.deepEqual(errors,[]);console.log(width,'stagger, layout movement, rapid filtering, reduced motion, product reset passed');await page.close()
}
}finally{await browser.close()}
