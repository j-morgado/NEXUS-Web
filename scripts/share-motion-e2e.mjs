import {chromium} from 'playwright-core'
import assert from 'node:assert/strict'
import { grantPreviewAccess } from './e2e-helpers.mjs'
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']})
try {
 const page=await browser.newPage({viewport:{width:1920,height:1080},serviceWorkers:'block'});await grantPreviewAccess(page)
 const errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.goto(process.env.NEXUS_PREVIEW_URL ?? 'http://127.0.0.1:4177')
 await page.getByRole('button',{name:'Touch Screen to Begin'}).click();await page.getByRole('button',{name:/^Explorer/}).click();await page.locator('.experience-loading').waitFor({state:'detached'})
 const open=async()=>{await page.getByRole('button',{name:/^Share/}).click();await page.locator('.share-overlay').waitFor()}
 await open()
 assert.equal(await page.locator('.catalog-body').evaluate(element=>element.inert),true)
 const dialog=page.getByRole('dialog',{name:'Share'});await page.keyboard.press('Shift+Tab');assert(await dialog.evaluate(element=>element.contains(document.activeElement)));await page.keyboard.press('Tab');assert(await dialog.evaluate(element=>element.contains(document.activeElement)))
 const frames=await page.locator('.share-overlay').evaluate(e=>{
  const panel=e.querySelector('.share-lightbox');const backdrop=e.getAnimations()[0],content=panel.getAnimations()[0];backdrop.pause();content.pause();backdrop.currentTime=262.5;content.currentTime=262.5;
  const result={opacity:Number(getComputedStyle(panel).opacity),blur:getComputedStyle(e).backdropFilter,bg:getComputedStyle(e).backgroundColor};backdrop.finish();content.finish();return result
 })
 assert(frames.opacity>0&&frames.opacity<1);assert.notEqual(frames.blur,'blur(0px)');assert.notEqual(frames.blur,'blur(12px)')
 await page.getByRole('textbox',{name:'Full name',exact:true}).click();await page.getByRole('button',{name:'Type q',exact:true}).click();assert.equal(await page.getByRole('textbox',{name:'Full name',exact:true}).inputValue(),'q');assert.equal(await page.locator('.share-overlay.is-closing').count(),0)
 await page.getByRole('button',{name:'Close share dialog'}).click();await page.locator('.share-overlay.is-closing').waitFor();assert(await page.locator('.share-overlay').isVisible());await page.locator('.share-overlay').waitFor({state:'detached'})
 await open();await page.locator('.share-lightbox header h2').click();await page.locator('.share-overlay.is-closing').waitFor();await page.locator('.share-overlay').waitFor({state:'detached'})
 await open();await page.mouse.click(5,5);await page.locator('.share-overlay.is-closing').waitFor();await page.locator('.share-overlay').waitFor({state:'detached'})
 await open();await page.keyboard.press('Escape');await page.locator('.share-overlay').waitFor({state:'detached'})
 await page.emulateMedia({reducedMotion:'reduce'});await open();assert.equal(await page.locator('.share-overlay').evaluate(e=>getComputedStyle(e).animationName),'none');await page.getByRole('button',{name:'Close share dialog'}).click();await page.locator('.share-overlay').waitFor({state:'detached'})
 assert.deepEqual(errors,[]);console.log('Synchronized backdrop/panel fade, input and keyboard interaction, X/header/outside/Escape dismissal, fade-out retention and reduced motion passed')
}finally{await browser.close()}
