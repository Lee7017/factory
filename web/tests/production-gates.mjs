import assert from "node:assert/strict"
import {spawn} from "node:child_process"
import {mkdir} from "node:fs/promises"
import {chromium} from "playwright"

const base="http://127.0.0.1:4176/factory/"
const server=spawn(process.execPath,["node_modules/vite/bin/vite.js","preview","--host","127.0.0.1","--port","4176","--strictPort"],{cwd:process.cwd(),stdio:["ignore","pipe","pipe"]})
let browser,failed=false
try {
 await mkdir("test-results",{recursive:true})
 for(let i=0;i<75;i++){try{if((await fetch(base)).ok)break}catch{}await new Promise(r=>setTimeout(r,300))}
 browser=await chromium.launch({headless:true,args:["--no-sandbox"]})
 const page=await browser.newPage({viewport:{width:1440,height:900}})
 const errors=[]
 page.on("pageerror",err=>errors.push(err.message))
 await page.goto(base,{waitUntil:"networkidle"})
 await page.locator(".department-tile").first().waitFor()
 const orderId="SO-2026-1023-018"
 async function route(dept,feature){
  await page.evaluate(hash=>{location.hash=hash},`#/departments/${dept}/${feature}`)
  await page.locator(".native-business .legacy-root").waitFor({state:"visible",timeout:16000})
  await page.waitForFunction(()=>document.querySelector(".native-business #view")?.textContent?.trim().length>20)
 }
 // Advance only the seed fixture to the issued stage; execute all remaining steps through actual UI buttons.
 await route("production","tasks")
 await page.evaluate(id=>{
  const engine=window.FactoryOperations
  engine.state.flows[id].stage="issued"
  const o=engine.getOrder(id);o.status="已发料"
 },orderId)
 await route("sales","orders")
 await route("production","tasks")
 assert.equal(await page.locator(`[data-op-action="flow:blendStart"][data-op-id="${orderId}"]`).count(),1)
 await page.locator(`[data-op-action="flow:blendStart"][data-op-id="${orderId}"]`).click()
 const dialog=page.locator(".journey-dialog")
 await dialog.waitFor({state:"visible",timeout:10000})
 const blocker=dialog.locator(".journey-blocker")
 assert.match(await blocker.textContent(),/TK-001/)
 assert.match(await blocker.textContent(),/待复核/)
 assert.equal(await dialog.locator(".journey-card.is-current .journey-task").textContent(),"清洗执行与复核")
 assert.equal(await dialog.locator(".journey-card.is-current [data-flow-track]").count(),1)
 assert.equal(await dialog.locator(".journey-task").count(),18)
 await page.screenshot({path:"test-results/production-01-cleaning-gate.png"})
 const linked=await page.evaluate(id=>window.FactoryOperations.taskGateForOrder(id,"清洗"),orderId)
 assert.equal(linked.id,"TK-001")
 assert.equal(linked.orderId,orderId)
 const todo=await page.evaluate(()=>window.FactoryOperations.pendingForDept("production"))
 assert.ok(todo.some(x=>x.id==="TK-001"&&x.feature==="tasks"),"Cleaning task appears in production departmental todo")
 await dialog.locator(".journey-card.is-current [data-flow-track]").click()
 await page.locator('.native-business .op-task-inbox').waitFor({state:"visible",timeout:12000})
 const task=page.locator('[data-task-row="TK-001"]')
 assert.equal(await task.locator('[data-op-action="task:qc"]').count(),1)
 const heading=page.locator('.op-task-inbox')
 const orderPanel=page.locator('.biz-order-panel[data-order-panel="tasks"]')
 const taskTop=await heading.evaluate(el=>el.getBoundingClientRect().top)
 const orderTop=await orderPanel.evaluate(el=>el.getBoundingClientRect().top)
 assert.ok(taskTop<orderTop,"Actual task inbox must appear above the unrelated large order table")
 await page.screenshot({path:"test-results/production-02-actionable-task.png"})
 await task.locator('[data-op-action="task:qc"]').click()
 const reportId=await page.evaluate(()=>window.FactoryModules.state.cleanReports.find(r=>r.task==="TK-001"&&r.status==="待判定")?.id)
 assert.ok(reportId,"Submitting cleaning QC creates exactly one record")
 await page.locator('.native-business [data-module-page="qaCleanInspection"]').waitFor({state:"visible",timeout:14000})
 const qc=page.locator(".mw-table tbody tr").filter({hasText:reportId})
 await qc.locator('[data-module-action="clean:pass"]').waitFor({state:"visible"})
 assert.equal(await page.evaluate(()=>window.FactoryModules.state.cleanReports.filter(r=>r.task==="TK-001"&&r.status==="待判定").length),1)
 await page.screenshot({path:"test-results/production-03-linked-cleaning-qc.png"})
 await qc.locator('[data-module-action="clean:pass"]').click()
 await dialog.waitFor({state:"visible"})
 assert.equal(await page.evaluate(()=>window.FactoryModules.hasCleaningPass("TK-001")),true)
 await dialog.locator("[data-flow-track]").click()
 await page.locator('.native-business .op-task-inbox').waitFor({state:"visible",timeout:14000})
 await page.locator('[data-task-row="TK-001"] [data-op-action="task:verify"]').click()
 await dialog.waitFor({state:"visible"})
 const cleanDone=dialog.locator(".journey-card.is-done").filter({hasText:"清洗执行与复核"})
 assert.equal(await cleanDone.count(),1)
 assert.equal(await dialog.locator(".journey-card.is-current .journey-task").textContent(),"配制开工")
 await page.screenshot({path:"test-results/production-04-cleaning-unblocked.png"})
 await dialog.locator(".journey-card.is-current [data-flow-track]").click()
 await page.locator(`[data-op-action="flow:blendStart"][data-op-id="${orderId}"]`).click()
 assert.equal(await page.evaluate(id=>window.FactoryOperations.state.flows[id].stage,orderId),"blending")
 assert.ok(errors.length===0,errors.join("\n"))
 console.log("PASS: issued order → cleaning TK-001 blocked → exact workflow track → linked QC → review → blend begins")
} catch(e){failed=true;console.error(e)}
finally {await browser?.close();server.kill("SIGTERM")}
if(failed)process.exit(1)
