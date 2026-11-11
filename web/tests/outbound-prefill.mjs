import assert from "node:assert/strict"
import {spawn} from "node:child_process"
import {mkdir} from "node:fs/promises"
import {chromium} from "playwright"

const base="http://127.0.0.1:4178/factory/"
const server=spawn(process.execPath,["node_modules/vite/bin/vite.js","preview","--host","127.0.0.1","--port","4178","--strictPort"],{cwd:process.cwd(),stdio:["ignore","pipe","pipe"]})
let browser,failed=false
try{
 await mkdir("test-results",{recursive:true})
 for(let i=0;i<70;i++){try{if((await fetch(base)).ok)break}catch{}await new Promise(r=>setTimeout(r,300))}
 browser=await chromium.launch({headless:true,args:["--no-sandbox"]})
 const page=await browser.newPage({viewport:{width:1440,height:900}})
 const errors=[]
 page.on("pageerror",error=>errors.push(error.message))
 await page.goto(base,{waitUntil:"networkidle"})
 await page.locator(".department-band-button").first().waitFor()
 const first="SO-2026-1023-018",second="SO-2026-1106-003"
 const form=page.locator("#module-form")
 const dismiss=()=>page.evaluate(()=>window.FactoryFlowUI?.dismiss?.())
 async function route(dept,feature){
  await page.evaluate(hash=>{location.hash=hash},`#/departments/${dept}/${feature}`)
  await page.locator(".native-business .legacy-root").waitFor({state:"visible",timeout:15000})
  await page.locator('.native-business [data-module-page="warehouseOutbound"]').waitFor({state:"visible",timeout:15000})
 }
 await route("warehouse","warehouseOutbound")
 const data=()=>page.evaluate(()=>({
  outbound:window.FactoryModules.state.outbound.map(r=>({order:r.order,qty:r.qty,status:r.status})),
  first:window.FactoryOperations.state.flows["SO-2026-1023-018"].stage,
  second:window.FactoryOperations.state.flows["SO-2026-1106-003"].stage
 }))
 await page.evaluate(({first,second})=>{
  const operations=window.FactoryOperations
  const modules=window.FactoryModules.state
  const a=operations.getOrder(first),b=operations.getOrder(second)
  a.qty=3000;a.spec="5L × 4桶";b.spec="1L × 12瓶"
  operations.state.flows[first].stage="dispatch"
  operations.state.flows[second].stage="dispatch"
  a.status="待成品出库";b.status="待成品出库"
  modules.outbound=modules.outbound.filter(r=>r.order!==first&&r.order!==second)
  modules.batches=modules.batches.filter(r=>r.order!==first&&r.order!==second)
  modules.batches.unshift(
   {id:"TEST-FG-01",group:"成品",material:"FG-001",order:first,qty:150,unit:"箱",received:"2026-11-01",quality:"合格",source:"生产入库"},
   {id:"TEST-FG-02",group:"成品",material:"FG-002",order:second,qty:65,unit:"箱",received:"2026-11-01",quality:"合格",source:"生产入库"}
  )
 },{first,second})
 await page.evaluate(()=>{location.hash="#/departments/sales/orders"})
 await page.locator('.native-business .biz-order-panel[data-order-panel="orders"]').waitFor({state:"visible",timeout:15000})
 await route("warehouse","warehouseOutbound")
 assert.equal(await page.locator(`[data-module-action="form:outbound"][data-mid="${first}"]`).count(),1)
 await page.locator(`[data-module-action="form:outbound"][data-mid="${first}"]`).click()
 await form.waitFor({state:"visible"})
 assert.equal(await form.locator('[name="order"]').inputValue(),first)
 assert.equal(await form.locator('[name="qty"]').inputValue(),"150",
  "First shipment automatically fills all 150 cases from the order")
 assert.match(await form.locator('[data-outbound-summary]').textContent(),/订单数量.*3,000 L/)
 assert.match(await form.locator('[data-outbound-summary]').textContent(),/剩余待发.*150 箱/)
 await page.screenshot({path:"test-results/outbound-01-order-prefilled.png"})

 // One click from a specific sales-order row must not demand quantity entry from scratch.
 await form.locator('[name="qty"]').fill("40")
 await form.locator('button[type="submit"]').click()
 await page.waitForFunction(id=>window.FactoryModules.state.outbound.some(r=>r.order===id&&r.status==="已出库"&&r.qty===40),first)
 await dismiss()
 assert.equal((await data()).first,"shipping")
 await page.locator(`[data-module-action="form:outbound"][data-mid="${first}"]`).click()
 await form.waitFor({state:"visible"})
 assert.equal(await form.locator('[name="qty"]').inputValue(),"110","Second shipment fills remaining 110 cases")
 assert.match(await form.locator('[data-outbound-summary]').textContent(),/已出库.*40 箱/)
 await page.screenshot({path:"test-results/outbound-02-remaining-prefilled.png"})

 // Changing the sales order must immediately update the quantity and the order summary.
 await form.locator('[name="order"]').selectOption(second)
 assert.equal(await form.locator('[name="qty"]').inputValue(),"65",
  "When qualified stock is short (65 vs 150 cases), prefill actual shippable quantity")
 assert.match(await form.locator('[data-outbound-summary]').textContent(),/订单应发.*150 箱/)
 assert.match(await form.locator('[data-outbound-summary]').textContent(),/合格可发.*65 箱/)
 assert.match(await form.locator('[data-outbound-summary]').textContent(),/仍缺 85 箱/)
 await page.screenshot({path:"test-results/outbound-03-change-order-and-stock-shortage.png"})
 await form.locator('[name="order"]').selectOption(first)
 assert.equal(await form.locator('[name="qty"]').inputValue(),"110",
  "Switching the order back restores the correct remaining quantity")
 await form.locator('[name="qty"]').fill("200")
 await form.locator('button[type="submit"]').click()
 assert.match(await page.locator(".mw-modal-error").textContent(),/不能超过订单尚未安排的待发数量 110 箱/)
 assert.equal((await data()).outbound.filter(r=>r.order===first&&r.status==="已出库").length,1,
  "Over-shipment cannot create a second outbound record")
 await form.locator('[name="qty"]').fill("110")
 await form.locator('button[type="submit"]').click()
 await page.waitForFunction(id=>window.FactoryOperations.state.flows[id].stage==="shipped",first)
 await dismiss()
 const final=await data()
 assert.equal(final.first,"shipped")
 assert.equal(final.outbound.filter(r=>r.order===first&&r.status==="已出库").reduce((n,r)=>n+r.qty,0),150)
 await page.screenshot({path:"test-results/outbound-04-order-fully-shipped.png"})
 assert.deepEqual(errors,[],"No uncaught page errors")
 console.log("PASS: sales order prefill 150 cases, 40 shipped -> 110 remain, switching order adapts to 65 qualified cases, no over-shipping")
}catch(error){failed=true;console.error(error)}
finally{await browser?.close();server.kill("SIGTERM")}
if(failed)process.exit(1)
