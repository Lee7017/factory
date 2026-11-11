import assert from "node:assert/strict"
import {spawn} from "node:child_process"
import {mkdir} from "node:fs/promises"
import {chromium} from "playwright"

const base="http://127.0.0.1:4181/factory/"
const server=spawn(process.execPath,["node_modules/vite/bin/vite.js","preview","--host","127.0.0.1","--port","4181","--strictPort"],{cwd:process.cwd(),stdio:["ignore","pipe","pipe"]})
let browser,failed=false
try{
 await mkdir("test-results",{recursive:true})
 for(let i=0;i<75;i++){try{if((await fetch(base)).ok)break}catch{}await new Promise(r=>setTimeout(r,300))}
 browser=await chromium.launch({headless:true,args:["--no-sandbox"]})
 const page=await browser.newPage({viewport:{width:1440,height:900}})
 const errors=[]
 page.on("pageerror",err=>errors.push(err.message))
 await page.goto(base,{waitUntil:"networkidle"})
 await page.locator(".department-tile").first().waitFor()
 const testPo="PO-RECEIPT-MODAL"
 async function route(dept,feature){
  await page.evaluate(hash=>{location.hash=hash},`#/departments/${dept}/${feature}`)
  await page.locator(".native-business .legacy-root").first().waitFor({state:"visible",timeout:16000})
  await page.waitForFunction(()=>document.querySelector(".native-business #view")?.textContent?.trim().length>60)
 }
 await route("warehouse","warehouseIncoming")
 await page.evaluate(id=>{
  const purchases=window.FactoryOperations.state.purchases
  purchases.unshift({id,material:"RM-001",qty:80,status:"待到货",supplier:"测试供应商",purchaseBy:"小明",submittedAt:new Date().toISOString(),history:[]})
 },testPo)
 await route("sales","orders")
 await route("warehouse","warehouseIncoming")
 const open=page.locator(`[data-proc-action="newReceipt"][data-proc-id="${testPo}"]`)
 await open.waitFor({state:"visible",timeout:15000})
 await open.click()
 const modal=page.locator(".proc-modal"),form=page.locator("#proc-form")
 await modal.waitFor({state:"visible",timeout:8000})
 assert.equal(await form.getAttribute("data-kind"),"receipt")
 assert.equal(await form.locator('[name="qty"]').inputValue(),"80","Receipt quantity is prefilled with the PO remaining quantity")
 assert.equal(await page.evaluate(()=>document.querySelector("#proc-modal-host")?.parentElement?.classList.contains("legacy-proc-portal-root")),true,
  "Procurement dialog must be portalled outside the card with overflow/backdrop-filter")
 assert.equal(await page.evaluate(()=>document.querySelector("#proc-modal-host")?.parentElement?.parentElement===document.body),true,
  "Dialog's portal is an immediate body child")
 assert.equal(await page.locator(".native-business #proc-modal-host").count(),0,
  "No duplicated procurement modal host may remain inside the workbench")
 async function checkViewport(width,height,label){
  await page.setViewportSize({width,height})
  const geometry=await page.evaluate(()=>{
   const popup=document.querySelector(".proc-modal"),header=popup.querySelector("header"),
    submit=popup.querySelector('#proc-form button[type="submit"]'),
    fields=popup.querySelector(".proc-fields"),overlay=document.querySelector(".proc-overlay");
   const box=el=>{const b=el.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height,bottom:b.bottom,right:b.right}}
   return {popup:box(popup),header:box(header),submit:box(submit),fields:box(fields),
    overlay:box(overlay),scrollHeight:fields.scrollHeight,clientHeight:fields.clientHeight,
    window:{w:innerWidth,h:innerHeight},position:getComputedStyle(popup).position}
  })
  assert.equal(geometry.position,"fixed",`${label}: modal must remain fixed to viewport`)
  assert.ok(geometry.popup.x>=9&&geometry.popup.right<=geometry.window.w-9&&geometry.popup.y>=9&&geometry.popup.bottom<=geometry.window.h-9,
   `${label}: full popup must stay inside viewport; ${JSON.stringify(geometry)}`)
  assert.ok(geometry.header.y>=geometry.popup.y&&geometry.header.bottom<=geometry.popup.bottom,
   `${label}: title/header cannot be clipped`)
  assert.ok(geometry.submit.y>=geometry.popup.y&&geometry.submit.bottom<=geometry.popup.bottom,
   `${label}: confirm receipt button must stay visible without scrolling`)
  assert.ok(geometry.overlay.x<=0&&geometry.overlay.y<=0&&geometry.overlay.right>=geometry.window.w-1&&geometry.overlay.bottom>=geometry.window.h-1,
   `${label}: backdrop must cover whole viewport, not just the card`)
  assert.equal(await modal.getByRole("heading",{name:"登记本次采购到货"}).isVisible(),true)
  assert.equal(await form.getByRole("button",{name:"确认到货并送检"}).isVisible(),true)
  await page.screenshot({path:`test-results/receipt-modal-${label}.png`})
  return geometry
 }
 const desktop=await checkViewport(1440,900,"desktop")
 await checkViewport(1000,580,"narrow")
 const short=await checkViewport(900,320,"short")
 assert.ok(short.scrollHeight>short.clientHeight+10,"Short viewport should scroll the field section, not hide the footer")
 await form.locator(".proc-fields").evaluate(el=>el.scrollTop=el.scrollHeight)
 assert.equal(await form.getByRole("button",{name:"确认到货并送检"}).isVisible(),true,
  "Receipt submit remains visible after the fields scroll")
 await checkViewport(390,620,"mobile")
 await page.setViewportSize({width:1440,height:900})
 await form.locator('[name="supplierLot"]').fill("SUP-TEST-MODAL")
 await form.getByRole("button",{name:"确认到货并送检"}).click()
 await page.waitForFunction(id=>window.FactoryModules.state.incoming.some(r=>r.purchase===id&&r.supplierLot==="SUP-TEST-MODAL"),testPo)
 const receipt=await page.evaluate(id=>window.FactoryModules.state.incoming.find(r=>r.purchase===id),testPo)
 assert.equal(receipt.qty,80)
 assert.equal(receipt.status,"待QC")
 assert.ok(await page.evaluate(id=>window.FactoryModules.state.inspections.some(x=>x.incoming===id&&x.status==="待判定"),receipt.id),
  "Submitting receipt must still create a real incoming-QC work item")
 await page.evaluate(()=>window.FactoryFlowUI?.dismiss?.())
 await page.screenshot({path:"test-results/receipt-modal-created.png"})
 assert.deepEqual(errors,[],"No JavaScript errors after portalling procurement form")
 console.log("PASS: warehouse receipt portal fixed; desktop, narrow, 320px viewport and mobile bounds; scrollable fields; fixed header and footer; receipt submits and creates QC")
}catch(err){failed=true;console.error(err)}
finally{await browser?.close();server.kill("SIGTERM")}
if(failed)process.exit(1)
