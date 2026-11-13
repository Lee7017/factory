import assert from "node:assert/strict"
import {spawn} from "node:child_process"
import {mkdir} from "node:fs/promises"
import {chromium} from "playwright"

const base="http://127.0.0.1:4176/factory/"
const server=spawn(process.execPath,["node_modules/vite/bin/vite.js","preview","--host","127.0.0.1","--port","4176","--strictPort"],{cwd:process.cwd(),stdio:["ignore","pipe","pipe"]})
let browser,failed=false
try{
 await mkdir("test-results",{recursive:true})
 for(let i=0;i<75;i++){try{if((await fetch(base)).ok)break}catch{}await new Promise(r=>setTimeout(r,300))}
 browser=await chromium.launch({headless:true,args:["--no-sandbox"]})
 const page=await browser.newPage({viewport:{width:1440,height:900}})
 const errors=[]
 page.on("pageerror",err=>errors.push(err.message))
 await page.goto(base,{waitUntil:"networkidle"})
 await page.locator(".department-band-button").first().waitFor()
 const orderId="SO-2026-1023-018"
 const dialog=page.locator(".journey-dialog")
 const stage=()=>page.evaluate(id=>window.FactoryOperations.state.flows[id].stage,orderId)
 const taskRow=id=>page.locator(`[data-task-row="${id}"]`)
 const currentStep=()=>dialog.locator(".journey-card.is-current .journey-task").textContent()
 async function assertTrackedTask(taskId,expectedAction){
  const row=taskRow(taskId)
  await page.waitForFunction(id=>
    document.querySelector('[data-task-row="'+id+'"]')?.classList.contains("bottleneck-track-highlight"),
    taskId,{timeout:8000})
  const state=await row.evaluate(el=>{
    const first=el.querySelector("td")
    const button=el.querySelector(".bottleneck-track-action")
    return {highlight:el.classList.contains("bottleneck-track-highlight"),
      current:el.getAttribute("aria-current"),
      background:first?getComputedStyle(first).backgroundColor:"",
      leftMarker:first?getComputedStyle(first).boxShadow:"",
      action:button?.getAttribute("data-op-action")||"",
      buttonBackground:button?getComputedStyle(button).backgroundColor:""}
  })
  assert.equal(state.highlight,true,"Corresponding work order must be highlighted")
  assert.equal(state.current,"location","Tracking marks the selected work order")
  assert.equal(state.background,"rgb(255, 242, 203)",
    "Amber selected row must override flattened white table cells")
  assert.ok(state.leftMarker.includes("187, 129, 27"),"Selected row has a strong left marker")
  assert.equal(state.action,expectedAction,"Highlight must point to the next available action")
  // The legacy primary button is dark already; the tracking cue is the gold
  // focus ring, which distinguishes the exact action from every other button.
  const buttonRing=await row.locator(".bottleneck-track-action").evaluate(el=>getComputedStyle(el).boxShadow)
  assert.ok(buttonRing.includes("187, 129, 27"),
    "Next action button must show its amber tracking ring: "+buttonRing)
  assert.equal(await page.locator(".bottleneck-track-highlight").count(),1,
    "Only the exact work order may be highlighted")
 }

 const close=async()=>page.evaluate(()=>window.FactoryFlowUI?.dismiss?.())
 async function route(dept,feature){
  await page.evaluate(hash=>{location.hash=hash},`#/departments/${dept}/${feature}`)
  await page.locator(".native-business .legacy-root").waitFor({state:"visible",timeout:15000})
  await page.waitForFunction(()=>document.querySelector(".native-business #view")?.textContent?.trim().length>20)
 }
 async function op(action,id=orderId){
  await page.locator(`[data-op-action="flow:${action}"][data-op-id="${id}"]`).click()
  await dialog.waitFor({state:"visible",timeout:12000})
 }
 async function takeQcDecision(report,decision){
  await route("quality","qaCleanInspection")
  const row=page.locator(".mw-table tbody tr").filter({hasText:report})
  await row.locator(`[data-module-action="clean:${decision}"]`).click()
  await dialog.waitFor({state:"visible"})
  await close()
 }
 async function cleanTask(taskId){
  await route("production","nonProductionTasks")
  const row=taskRow(taskId)
  if(await row.locator('[data-op-action="task:start"]').count()){await row.locator('[data-op-action="task:start"]').click();await close()}
  if(await row.locator('[data-op-action="task:finish"]').count()){await row.locator('[data-op-action="task:finish"]').click();await close()}
  await row.locator('[data-op-action="task:qc"]').click()
  const report=await page.evaluate(id=>window.FactoryModules.state.cleanReports.find(r=>r.task===id&&r.status==='待判定')?.id,taskId)
  assert.ok(report,"QC report must be created on the actual cleaning work order")
  await page.locator('.native-business [data-module-page="qaCleanInspection"]').waitFor({state:"visible",timeout:12000})
  const inspectRow=page.locator(".mw-table tbody tr").filter({hasText:report})
  await inspectRow.locator('[data-module-action="clean:inspect"]').click()
  const qcForm=page.locator("#module-form")
  await qcForm.waitFor({state:"visible"})
  assert.equal(await qcForm.locator('[name="result"]').count(),1)
  assert.equal(await qcForm.locator('[name="remark"]').count(),1)
  await qcForm.locator('[name="result"]').selectOption("合格")
  await page.screenshot({path:"test-results/cleaning-inspection-01-simple-form.png"})
  await qcForm.locator('button[type="submit"]').click()
  await dialog.waitFor({state:"visible"})
  await close()
  await route("production","nonProductionTasks")
  await taskRow(taskId).locator('[data-op-action="task:verify"]').click()
  await dialog.waitFor({state:"visible"})
 }

 await route("production","tasks")
 // Set only the starting fixture to "material issued"; all remaining transitions use real UI actions.
 await page.evaluate(id=>{
  const ops=window.FactoryOperations
  ops.state.flows[id].stage="issued"
  ops.getOrder(id).status="物料已发放"
 },orderId)
 await route("sales","orders")
 await route("production","tasks")
 assert.equal(await page.locator(`[data-op-action="flow:blendStart"][data-op-id="${orderId}"]`).count(),1)
 await op("blendStart")
 assert.equal(await stage(),"blending","Blending must start without any pre-start cleaning")
 assert.equal(await currentStep(),"配制任务完成")
 assert.equal(await page.evaluate(id=>window.FactoryOperations.state.flows[id].stage,orderId),"blending")
 const beforeClean=await page.evaluate(()=>window.FactoryOperations.state.logs.length)
 assert.equal(await page.evaluate(id=>window.FactoryOperations.taskGateForOrder(id,"清洗")?.id||null,orderId),null,
  "No cleaning should be attached to the blending order before task completion")
 await page.screenshot({path:"test-results/production-01-blending-starts-without-cleaning.png"})
 await close()

 await op("blendFinish")
 assert.equal(await stage(),"blend_clean")
 assert.equal(await currentStep(),"配制线清洗执行与复核")
 const blendTask=await page.evaluate(id=>window.FactoryOperations.taskGateForOrder(id,"清洗"),orderId)
 assert.ok(blendTask&&blendTask.orderId===orderId)
 assert.ok(blendTask.id.startsWith("CLN-"),"Each cleanup is a new job only after the completed production run")
 assert.equal(blendTask.cleanPhase,"配制")
 assert.ok(blendTask.line.includes("配制"))
 assert.equal(await page.evaluate(id=>window.FactoryModules.state.inspections.some(r=>r.order===id&&r.phase==="半成品"),orderId),false,
  "Semi-finished goods cannot be sent to QC until post-blending cleaning is completed")
 assert.equal(await dialog.locator(".journey-card.is-current [data-flow-track]").count(),1)
 await page.screenshot({path:"test-results/production-02-blending-clean-after-task.png"})
 await dialog.locator(".journey-card.is-current [data-flow-track]").click()
 await page.locator('.native-business .op-task-inbox').waitFor({state:"visible",timeout:14000})
 assert.match(new URL(page.url()).hash,/#\/departments\/production\/nonProductionTasks$/,"Tracking must open workshop nonproduction task list")
 assert.equal(await taskRow(blendTask.id).count(),1)
 await assertTrackedTask(blendTask.id,"task:start")
 assert.equal(await taskRow(blendTask.id).locator('[data-op-action="task:start"]').count(),1,
  "New post-blending cleaning must begin with execution, not skip to QC or review")
 await page.screenshot({path:"test-results/production-03-blending-clean-todo.png"})
 await cleanTask(blendTask.id)
 assert.equal(await stage(),"semi_qc")
 assert.equal(await currentStep(),"半成品检验判定")
 assert.equal(await page.evaluate(id=>window.FactoryModules.state.inspections.filter(r=>r.order===id&&r.phase==="半成品"&&r.status==="待判定").length,orderId),1)
 await page.screenshot({path:"test-results/production-04-clean-verified-next-qc.png"})
 await close()

 await route("quality","qaQc")
 const semiId=await page.evaluate(id=>window.FactoryModules.state.inspections.find(r=>r.order===id&&r.phase==="半成品"&&r.status==="待判定")?.id,orderId)
 await page.locator(".mw-table tbody tr").filter({hasText:semiId}).locator('[data-module-action="qc:pass"]').click()
 await dialog.waitFor({state:"visible"})
 assert.equal(await stage(),"semi_ok")
 assert.equal(await currentStep(),"调机调线执行与复核")
 await close()

 await route("production","tasks")
 await op("packStart")
 assert.equal(await stage(),"semi_ok","Packaging start is blocked until line setup is done")
 assert.match(await dialog.locator(".journey-blocker").textContent(),/调机调线/)
 assert.equal(await currentStep(),"调机调线执行与复核")
 const setupTask=await page.evaluate(id=>window.FactoryOperations.taskGateForOrder(id,"调机调线"),orderId)
 assert.ok(setupTask&&setupTask.orderId===orderId)
 await page.screenshot({path:"test-results/production-05-packaging-setup-before-start.png"})
 await dialog.locator(".journey-card.is-current [data-flow-track]").click()
 await page.locator('.native-business .op-task-inbox').waitFor({state:"visible",timeout:14000})
 assert.match(new URL(page.url()).hash,/#\/departments\/production\/nonProductionTasks$/,"Tracking must open workshop nonproduction task list")
 await assertTrackedTask(setupTask.id,"task:start")
 for(const mode of ["start","finish","verify"]){
  await taskRow(setupTask.id).locator(`[data-op-action="task:${mode}"]`).click()
  await dialog.waitFor({state:"visible"})
  await close()
 }
 assert.equal(await page.evaluate(id=>window.FactoryOperations.taskGateForOrder(id,"调机调线").status,orderId),"已完成")
 await route("production","tasks")
 await op("packStart")
 assert.equal(await stage(),"packaging")
 assert.equal(await currentStep(),"包装任务完成")
 await close()

 await op("packFinish")
 assert.equal(await stage(),"pack_clean")
 assert.equal(await currentStep(),"包装线清洗执行与复核")
 const packTask=await page.evaluate(id=>window.FactoryOperations.taskGateForOrder(id,"清洗"),orderId)
 assert.ok(packTask&&packTask.orderId===orderId)
 assert.equal(packTask.cleanPhase,"包装")
 assert.ok(packTask.line.includes("瓶装")||packTask.line.includes("包装"))
 assert.notEqual(packTask.id,blendTask.id,"Packaging and blending cleaning are distinct work orders")
 assert.equal(await page.evaluate(id=>window.FactoryModules.state.inspections.some(r=>r.order===id&&r.phase==="成品"),orderId),false)
 await page.screenshot({path:"test-results/production-06-packaging-clean-after-task.png"})
 await dialog.locator(".journey-card.is-current [data-flow-track]").click()
 await page.locator('.native-business .op-task-inbox').waitFor({state:"visible",timeout:14000})
 await assertTrackedTask(packTask.id,"task:start")
 await page.screenshot({path:"test-results/production-06-packaging-clean-tracked.png"})
 await cleanTask(packTask.id)
 assert.equal(await stage(),"final_qc")
 assert.equal(await currentStep(),"成品检验判定并放行")
 await page.screenshot({path:"test-results/production-07-packaging-clean-verified.png"})
 await close()

 // Each completed production run needs a new cleaning task, including rework of the same order.
 await route("quality","qaQc")
 const final1=await page.evaluate(id=>window.FactoryModules.state.inspections.find(r=>r.order===id&&r.phase==="成品"&&r.status==="待判定")?.id,orderId)
 await page.locator(".mw-table tbody tr").filter({hasText:final1}).locator('[data-module-action="qc:fail"]').click()
 await dialog.waitFor({state:"visible"})
 assert.equal(await stage(),"packaging")
 await close()
 await route("production","tasks")
 await op("packFinish")
 assert.equal(await stage(),"pack_clean")
 const packAgain=await page.evaluate(id=>window.FactoryOperations.taskGateForOrder(id,"清洗"),orderId)
 assert.notEqual(packAgain.id,packTask.id,"Every repeat packaging task must have a new cleanup")
 assert.equal(packAgain.cleanPhase,"包装")
 await close()
 await cleanTask(packAgain.id)
 assert.equal(await stage(),"final_qc")
 await close()
 await route("quality","qaQc")
 const final2=await page.evaluate(id=>window.FactoryModules.state.inspections.find(r=>r.order===id&&r.phase==="成品"&&r.status==="待判定")?.id,orderId)
 assert.ok(final2&&final2!==final1,"Rework requires a fresh inspection record")
 await page.locator(".mw-table tbody tr").filter({hasText:final2}).locator('[data-module-action="qc:pass"]').click()
 await dialog.waitFor({state:"visible"})
 assert.equal(await stage(),"released")
 assert.equal(await dialog.locator(".journey-task").count(),19)
 await page.screenshot({path:"test-results/production-08-complete-production-rules.png"})
 assert.deepEqual(errors,[],"No uncaught JavaScript errors")
 console.log("PASS: blending → blending clean → semi QC → setup → packaging → packaging clean → final QC; rework creates fresh cleaning and QC")
}catch(e){failed=true;console.error(e)}
finally{await browser?.close();server.kill("SIGTERM")}
if(failed)process.exit(1)
