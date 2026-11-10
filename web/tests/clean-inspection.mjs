import assert from "node:assert/strict"
import {spawn} from "node:child_process"
import {mkdir} from "node:fs/promises"
import {chromium} from "playwright"

const base="http://127.0.0.1:4179/factory/"
const server=spawn(process.execPath,["node_modules/vite/bin/vite.js","preview","--host","127.0.0.1","--port","4179","--strictPort"],{cwd:process.cwd(),stdio:["ignore","pipe","pipe"]})
let browser,failed=false
try{
 await mkdir("test-results",{recursive:true})
 for(let n=0;n<80;n++){try{if((await fetch(base)).ok)break}catch{}await new Promise(r=>setTimeout(r,300))}
 browser=await chromium.launch({headless:true,args:["--no-sandbox"]})
 const page=await browser.newPage({viewport:{width:1440,height:900}})
 const errors=[]
 page.on("pageerror",e=>errors.push(e.message))
 await page.goto(base,{waitUntil:"networkidle"})
 await page.locator(".department-tile").first().waitFor()
 const id="SO-2026-1023-018",flow=page.locator(".journey-dialog"),form=page.locator("#module-form")
 async function route(dept,feature){
  await page.evaluate(hash=>{location.hash=hash},`#/departments/${dept}/${feature}`)
  await page.locator(".native-business .legacy-root").waitFor({state:"visible",timeout:16000})
  await page.waitForFunction(()=>document.querySelector('.native-business #view')?.textContent?.length>80)
 }
 async function closeFlow(){await page.evaluate(()=>window.FactoryFlowUI?.dismiss?.())}
 async function taskAction(taskId,action){
  await route("production","tasks")
  await page.locator(`[data-task-row="${taskId}"] [data-op-action="task:${action}"]`).click()
  await flow.waitFor({state:"visible",timeout:10000})
  await closeFlow()
 }
 async function taskReport(taskId){
  await route("production","tasks")
  await page.locator(`[data-task-row="${taskId}"] [data-op-action="task:qc"]`).click()
  const r=await page.evaluate(t=>window.FactoryModules.state.cleanReports.find(x=>x.task===t&&x.status==="待判定"),taskId)
  assert.ok(r,"A real pending QC report must be linked to the executed cleaning job")
  await route("quality","qaCleanInspection")
  return r
 }
 async function openInspect(reportId){
  const table=page.locator(".mw-table tbody tr").filter({hasText:reportId})
  await table.locator('[data-module-action="clean:inspect"]').click()
  await form.waitFor({state:"visible",timeout:8000})
 }
 async function fillQc(results){
  for(let i=0;i<4;i++)await form.locator(`[name="check${i}"]`).selectOption(results[i])
  await form.locator('[name="basis"]').fill("清洗标准卡 SOP / 现场目视检查")
  await form.locator('[name="observations"]').fill("现场检查接触面、管路、清场状态和清洗记录，并记录观察情况。")
 }
 await route("production","tasks")
 await page.evaluate(order=>{
  const ops=window.FactoryOperations;ops.state.flows[order].stage="issued";ops.getOrder(order).status="物料已发放"
 },id)
 await route("sales","orders")
 await route("production","tasks")
 for(const action of ["blendStart","blendFinish"]){
  await page.locator(`[data-op-action="flow:${action}"][data-op-id="${id}"]`).click()
  await flow.waitFor({state:"visible"});await closeFlow()
 }
 const task=await page.evaluate(order=>window.FactoryOperations.taskGateForOrder(order,"清洗"),id)
 assert.ok(task.id.startsWith("CLN-"))
 for(const action of ["start","finish"])await taskAction(task.id,action)
 const first=await taskReport(task.id)
 assert.equal(first.order,id)
 assert.equal(first.submittedBy,"小明")
 assert.equal(first.status,"待判定")
 assert.equal(await page.locator('[data-module-action="form:clean"]').count(),0,
  "QC cannot create a fake inspection from a single free-text input")
 await openInspect(first.id)
 assert.equal(await form.locator(".mw-clean-check-row").count(),4)
 assert.match(await form.locator(".mw-clean-info").textContent(),new RegExp(id))
 const rect=await page.locator(".mw-modal").boundingBox()
 assert.ok(rect&&rect.y>=10&&rect.y+rect.height<=900-10,
  "The entire cleaning inspection modal must fit within the browser viewport, not be clipped by the workbench")
 assert.ok(await page.getByRole("heading",{name:/清洗报检 · QC 逐项检验/}).isVisible(),
  "QC inspection title must be visible")
 assert.ok(await form.locator('button[type="submit"]').isVisible(),
  "QC submit action must stay visible, even when the checklist is longer than the screen")
 assert.equal(await page.locator("body > .legacy-modules-portal-root #modules-modal-host").count(),1,
  "The QC modal host is attached directly to the body rather than the clipped workbench")
 await page.screenshot({path:"test-results/clean-qc-01-real-linked-form.png"})
 await fillQc(["符合","符合","不符合","符合"])
 await form.locator('button[type="submit"]').click()
 assert.match(await page.locator(".mw-modal-error").textContent(),/不合格部位或原因/,
  "A failed check cannot be approved without explaining the actual anomaly")
 await form.locator('[name="failureReason"]').fill("管路出口发现上一生产任务的残液，需重新清洗复核")
 await form.locator('button[type="submit"]').click()
 await flow.waitFor({state:"visible"})
 let result=await page.evaluate(reportId=>window.FactoryModules.state.cleanReports.find(r=>r.id===reportId),first.id)
 assert.equal(result.status,"不合格")
 assert.equal(result.items[2].result,"不符合")
 assert.equal(result.checkedBy,"小明")
 assert.ok(result.checkedAt)
 assert.equal(await page.evaluate(order=>window.FactoryOperations.taskGateForOrder(order,"清洗").status,id),"待开始",
  "The original cleaning job must be returned for re-cleaning after failed QC")
 assert.equal(await page.evaluate(reportId=>window.FactoryModules.state.ncr.filter(n=>n.source==="清洗报检"&&n.ref===reportId).length,first.id),1,
  "A failed QC creates a traceable nonconformance against the inspection record")
 await page.screenshot({path:"test-results/clean-qc-02-failed-return.png"})
 await closeFlow()
 for(const action of ["start","finish"])await taskAction(task.id,action)
 const second=await taskReport(task.id)
 assert.notEqual(second.id,first.id,"Re-clean must create a new inspection record, not overwrite the failure")
 await openInspect(second.id)
 await fillQc(["符合","符合","符合","符合"])
 await page.screenshot({path:"test-results/clean-qc-03-complete-reinspection.png"})
 await form.locator('button[type="submit"]').click()
 await flow.waitFor({state:"visible"})
 result=await page.evaluate(reportId=>window.FactoryModules.state.cleanReports.find(r=>r.id===reportId),second.id)
 assert.equal(result.status,"合格")
 assert.equal(result.items.length,4)
 assert.equal(result.checkedBy,"小明")
 assert.ok(result.checkedAt)
 assert.equal(await page.evaluate(order=>window.FactoryOperations.taskGateForOrder(order,"清洗").status,id),"待复核")
 await closeFlow()
 await route("quality","qaCleanInspection")
 await page.locator(".mw-table tbody tr").filter({hasText:second.id}).locator('[data-module-action="clean:detail"]').click()
 await form.waitFor({state:"visible"})
 assert.equal(await form.locator(".mw-clean-result.ok").count(),4)
 assert.equal(await form.locator('button[type="submit"]').count(),0,"Completed QC is read-only")
 await page.screenshot({path:"test-results/clean-qc-04-signed-history.png"})
 await page.locator('[data-module-action="closeModal"]').last().click()
 await taskAction(task.id,"verify")
 assert.equal(await page.evaluate(order=>window.FactoryOperations.state.flows[order].stage,id),"semi_qc")
 assert.deepEqual(errors,[],"No page JS errors")
 console.log("PASS: production submitted linked QC; 4 required checks; failed QC requires reason, NCR and re-clean; new report passes; signed read-only history; production continues")
}catch(e){failed=true;console.error(e)}
finally{await browser?.close();server.kill("SIGTERM")}
if(failed)process.exit(1)
