import {chromium} from 'playwright-core'
import assert from 'node:assert/strict'
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']})
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]))
try {
 const page=await browser.newPage({viewport:{width:960,height:720},reducedMotion:'reduce',serviceWorkers:'block'});const errors=[]
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
 await page.addInitScript(()=>sessionStorage.setItem('nexus:access-granted','true'))
 await page.addInitScript(()=>localStorage.setItem('nexus-operator-settings-v1',JSON.stringify({inactivitySeconds:60,qualityTier:'low',visual:{ssgi:false,ssgiSamples:8,ssao:false,ssaoSamples:8,ssr:false,ssrSteps:16,motionBlur:false,motionBlurSamples:3,resolutionScale:.5,maxDpr:1,planarReflections:false,reflectionResolution:256,shadowResolution:512},updateChecksEnabled:false,locallyDisabledModuleIds:[]})))
 await page.goto(process.env.NEXUS_PREVIEW_URL ?? 'http://127.0.0.1:4177');await page.getByRole('button',{name:'Touch Screen to Begin'}).click();await page.locator('.hub-card-primary').click();await page.locator('.experience-loading').waitFor({state:'detached',timeout:90000})
 const stage=page.locator('.model-stage'),marker=page.locator('[data-hotspot-id="crew-protection"]'),button=marker.locator('button')
 const camera=async()=>stage.evaluate(e=>({position:e.dataset.cameraPosition.split(',').map(Number),target:e.dataset.cameraTarget.split(',').map(Number),distance:Number(e.dataset.cameraDistance)}))
 const settled=async locked=>page.waitForFunction(locked=>{const e=document.querySelector('.model-stage');return e?.dataset.cameraLocked===String(locked)&&e?.dataset.cameraTransitioning!=='true'},locked,{timeout:60000})
 const mode=async value=>{await page.keyboard.press('Control+Shift+d');const panel=page.getByRole('dialog',{name:'Dev Options'});await panel.getByLabel('Hotspot preview mode').selectOption(value);await panel.getByRole('button',{name:'Close Dev Options'}).click();await settled(false)}
 const original=await camera()
 await button.click();await page.waitForTimeout(200);const inPlace=await camera();assert(distance(original.position,inPlace.position)<.001);assert(distance(original.target,inPlace.target)<.001);await page.waitForFunction(()=>document.querySelector('[data-hotspot-id="crew-protection"]').getBoundingClientRect().height>42);assert((await marker.boundingBox()).height>42);await button.click()
 console.log('In place preserves camera and expands the same marker')
 await mode('zoom-in-place');await button.click();await settled(true)
 const focused=await camera();assert(focused.distance<3.3&&focused.distance>2.3);assert(distance(original.target,focused.target)>1)
 await page.mouse.move(130,260);await page.mouse.down();await page.mouse.move(420,280,{steps:4});await page.mouse.up();await settled(true)
 const moved=await camera();assert(distance(focused.position,moved.position)>.01);assert(distance(focused.target,moved.target)<.002);assert(moved.distance>=2.34&&moved.distance<=3.26);assert.equal(await stage.getAttribute('data-hotspot-open'),'true')
 await page.keyboard.press('Escape');await settled(false);let restored=await camera();assert(distance(restored.position,original.position)<.02);assert(distance(restored.target,original.target)<.02)
 console.log('Zoom in place: close-up, limited orbit, drag retention, Escape and view restoration passed')
 await mode('zoom-sidebar');await page.emulateMedia({reducedMotion:'no-preference'})
 const morph=await marker.evaluate(async element=>{
  element.dataset.identityProbe='same-marker';element.querySelector('button').click();const samples=[],started=performance.now()
  await new Promise(resolve=>{function sample(){samples.push(element.getBoundingClientRect().width);if(performance.now()-started<12000 && !(element.classList.contains('is-sidebar') && element.getBoundingClientRect().width>=359.9))requestAnimationFrame(sample);else resolve()}requestAnimationFrame(sample)})
  return {samples,duration:getComputedStyle(element).transitionDuration,properties:getComputedStyle(element).transitionProperty,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,classes:element.className}
 })
 assert(morph.samples.some(width=>width>43&&width<359),'Sidebar morph must include intermediate widths');await settled(true);await page.waitForFunction(()=>document.querySelector('[data-hotspot-id="crew-protection"]')?.dataset.morphProgress==='1',null,{timeout:60000})
 assert.equal(await marker.getAttribute('data-identity-probe'),'same-marker');assert(await marker.locator('[role="region"]').isVisible());let bounds=await marker.boundingBox();assert(Math.abs(bounds.x-576)<2&&Math.abs(bounds.width-360)<2&&bounds.height>400)
 assert.equal(await button.evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(115, 76, 221)')
 assert.equal(await page.locator('.vehicle-hotspot:not(.is-open)[data-visible="true"]').count(),0)
 await page.screenshot({path:'/tmp/nexus-hotspot-sidebar-desktop.png'})
 await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:390,height:844});await settled(true)
 await page.waitForFunction(()=>{const e=document.querySelector('.vehicle-hotspot.is-sidebar');if(!e)return false;const r=e.getBoundingClientRect();return r.x>0&&r.right<=innerWidth&&r.width>150&&r.width<220&&e.dataset.morphProgress==='1'})
 bounds=await marker.boundingBox();assert(bounds.width>150&&bounds.x>150&&bounds.x+bounds.width<=390);await page.screenshot({path:'/tmp/nexus-hotspot-sidebar-mobile.png'})
 await page.mouse.click(50,300);await settled(false);restored=await camera();assert(distance(restored.position,original.position)<.02)
 assert.deepEqual(errors,[]);console.log('Zoom side bar: real morph, purple header, cleared markers, desktop/mobile framing, outside dismissal and restoration passed')
}finally{await browser.close()}
