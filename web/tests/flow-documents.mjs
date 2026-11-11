import assert from "node:assert/strict"
import {spawn} from "node:child_process"
import {mkdir} from "node:fs/promises"
import {chromium} from "playwright"

const base="http://127.0.0.1:4180/factory/"
const server=spawn(process.execPath,["node_modules/vite/bin/vite.js","preview","--host","127.0.0.1","--port","4180","--strictPort"],{cwd:process.cwd(),stdio:["ignore","pipe","pipe"]})
let browser,failed=false
try{
 await mkdir("test-results",{recursive:true})
 for(let i=0;i<75;i++){try{if((await fetch(base)).ok)break}catch{}await new Promise(r=>setTimeout(r,300))}
 browser=await chromium.launch({headless:true,args:["--no-sandbox"]})
 const page=await browser.newPage({viewport:{width:1440,height:900}})
 const errors=[]
 page.on("pageerror",e=>errors.push(e.message))
 await page.goto(base,{waitUntil:"networkidle"})
 await page.locator(".department-band-button").first().waitFor()
 await page.evaluate(()=>{location.hash="#/departments/sales/orders"})
 await page.locator('.native-business [data-op-action="detailFlow"]').first().waitFor({state:"visible",timeout:15000})
 const id="SO-2026-1023-018"
 await page.evaluate(order=>{
  const m=window.FactoryModules.state,o=window.FactoryOperations.state;
  o.flows[order].stage="delivered";
  o.purchases.unshift({id:"PO-LINK-001",sourceOrder:order,material:"PK-001",qty:100,status:"已入库",supplier:"测试供应商",totalAmount:500});
  m.incoming.unshift({id:"IN-LINK-001",purchase:"PO-LINK-001",material:"PK-001",qty:100,actualQty:100,status:"已入库",supplierLot:"SUP-001"});
  m.inspections.unshift(
   {id:"QC-LINK-SEMI",order,phase:"半成品",status:"合格",date:"2026-11-11",material:"FG-001"},
   {id:"QC-LINK-FINAL",order,phase:"成品",status:"合格",date:"2026-11-11",material:"FG-001"},
   {id:"IQC-LINK-001",incoming:"IN-LINK-001",phase:"来料",status:"合格",date:"2026-11-11",material:"PK-001"}
  );
  m.cleanReports.unshift(
   {id:"CLQC-LINK-BLEND",order,phase:"配制",task:"CLN-LINK-BLEND",line:"L01 配制一线",status:"合格",checkedBy:"小明",checkedAt:"11/11 11:22"},
   {id:"CLQC-LINK-PACK",order,phase:"包装",task:"CLN-LINK-PACK",line:"S03-4# 瓶装线",status:"合格",checkedBy:"小明",checkedAt:"11/11 12:00"}
  );
  m.ncr.unshift({id:"NCR-LINK-001",source:"报检",ref:"QC-LINK-FINAL",reason:"包装曾需复核",status:"已处置"});
  m.materialRequests.unshift({id:"MR-LINK-001",order,type:"领料",material:"RM-001",qty:300,status:"已双签",warehouseBy:"仓库甲",shopBy:"生产乙"});
  m.batches.unshift(
   {id:"LOT-LINK-001",order,group:"成品",material:"FG-001",qty:150,unit:"箱",quality:"合格",received:"2026-11-11"},
   {id:"LOT-PURCH-001",incoming:"IN-LINK-001",group:"原辅料",material:"PK-001",qty:100,unit:"kg",quality:"合格"}
  );
  m.outbound.unshift(
   {id:"OB-LINK-001",order,qty:40,destination:"客户甲",status:"已出库",allocations:[{id:"LOT-LINK-001",qty:40}],createdBy:"仓库甲",shippedAt:"11/11 12:05"},
   {id:"OB-LINK-002",order,qty:110,destination:"客户甲",status:"已出库",allocations:[{id:"LOT-LINK-001",qty:110}],createdBy:"仓库乙",shippedAt:"11/11 13:00"}
  );
 },id)
 const dialog=page.locator(".journey-dialog"),modal=page.locator(".mw-modal")
 const orderFlow=async(stage="delivered")=>{
  await page.evaluate(({order,stage})=>window.FactoryFlowUI.openDocument({
   kind:"order",ref:order,stage,docType:"销售订单",summary:"真实单据关联测试",
   nextOpen:{dept:"sales",feature:"orders",record:order}
  }),{order:id,stage})
  await dialog.waitFor({state:"visible"})
 }
 const card=name=>dialog.locator(".journey-card").filter({has:page.locator(".journey-task").getByText(name,{exact:true})})
 const docButton=name=>card(name).locator("[data-flow-document-step]")
 const closeRecord=async()=>{await modal.locator('[data-module-action="closeModal"]').first().click();await modal.waitFor({state:"hidden"})}
 await orderFlow()
 assert.equal(await card("发布正式排程").locator(".journey-state").textContent(),"已办理",
  "A completed step without a separate business document keeps 已办理")
 assert.equal(await docButton("配制线清洗执行与复核").textContent(),"查看清洗报检单")
 assert.equal(await docButton("半成品检验判定").textContent(),"查看半成品检验单")
 assert.equal(await docButton("确认领料发料").textContent(),"查看领料单")
 assert.equal(await docButton("成品入库").textContent(),"查看成品库存批次")
 assert.equal(await docButton("按销售订单成品出库").textContent(),"查看成品出库单（2）")
 assert.equal(await docButton("确认物料齐套并锁库").textContent(),"查看采购单")
 assert.equal(await card("包装开工").locator(".journey-state").textContent(),"已办理")
 await page.screenshot({path:"test-results/flow-doc-01-order-cards.png"})
 await docButton("配制线清洗执行与复核").click()
 await modal.waitFor({state:"visible"})
 assert.match(await modal.textContent(),/CLQC-LINK-BLEND/)
 assert.match(await modal.textContent(),/合格/)
 assert.equal(await modal.locator('button[type="submit"]').count(),0,"Linked document opens read-only")
 await page.screenshot({path:"test-results/flow-doc-02-clean-detail.png"})
 await closeRecord()
 await orderFlow()
 await docButton("半成品检验判定").click()
 await modal.waitFor({state:"visible"})
 assert.match(await modal.textContent(),/QC-LINK-SEMI/)
 assert.match(await modal.textContent(),/半成品/)
 await closeRecord()
 await orderFlow()
 await docButton("按销售订单成品出库").click()
 const picker=page.locator(".journey-doc-picker")
 await picker.waitFor({state:"visible"})
 assert.equal(await picker.locator("[data-flow-document-choice]").count(),2)
 assert.match(await picker.textContent(),/OB-LINK-001/)
 assert.match(await picker.textContent(),/OB-LINK-002/)
 await page.screenshot({path:"test-results/flow-doc-03-shipment-picker.png"})
 await picker.getByText("OB-LINK-002").click()
 await modal.waitFor({state:"visible"})
 assert.match(await modal.textContent(),/OB-LINK-002/)
 assert.match(await modal.textContent(),/110/)
 assert.equal(await modal.locator('button[type="submit"]').count(),0)
 await page.screenshot({path:"test-results/flow-doc-04-outbound-detail.png"})
 await closeRecord()
 await orderFlow()
 await docButton("成品检验判定并放行").click()
 await picker.waitFor({state:"visible"})
 assert.equal(await picker.locator("[data-flow-document-choice]").count(),2,
  "Quality step displays both actual inspection and NCR, not an invented link")
 await picker.getByText("NCR-LINK-001").click()
 await modal.waitFor({state:"visible"})
 assert.match(await modal.textContent(),/NCR-LINK-001/)
 await closeRecord()
 // A running step keeps its original tracking action, even if a future record exists in the fixture.
 await orderFlow("blending")
 assert.equal(await card("配制任务完成").locator("[data-flow-track]").textContent(),"跟踪当前环节 →")
 assert.equal(await docButton("配制线清洗执行与复核").count(),0)
 await page.evaluate(()=>window.FactoryFlowUI.dismiss())
 // Procurement's own flow also uses real warehouse receipt and QC records.
 await page.evaluate(()=>window.FactoryFlowUI.openDocument({kind:"purchase",ref:"PO-LINK-001",status:"已入库",docType:"采购单"}))
 await dialog.waitFor({state:"visible"})
 assert.equal(await docButton("仓库登记到货").textContent(),"查看采购到货单")
 assert.equal(await docButton("QC 来料检验").textContent(),"查看来料检验单")
 await docButton("仓库登记到货").click()
 await modal.waitFor({state:"visible"})
 assert.match(await modal.textContent(),/IN-LINK-001/)
 assert.match(await modal.textContent(),/SUP-001/)
 await page.screenshot({path:"test-results/flow-doc-05-purchase-receipt.png"})
 await closeRecord()

 // Research how multiple reports arise: a failed QC must not hide its earlier document.
 await page.evaluate(order=>{
  window.FactoryModules.state.cleanReports.push({
   id:"CLQC-LINK-BLEND-FAILED",order,phase:"配制",task:"CLN-LINK-BLEND",
   line:"L01 配制一线",status:"不合格",checkedAt:"11/11 10:05",remark:"清洗后仍有残留"
  })
 },id)
 await orderFlow()
 assert.equal(await docButton("配制线清洗执行与复核").textContent(),"查看清洗报检单（2）",
  "Keep both reports: they are two real QC submissions linked to the same cleaning job")
 await docButton("配制线清洗执行与复核").click()
 await picker.waitFor({state:"visible"})
 assert.match(await picker.locator(".journey-doc-explanation").textContent(),/同一清洗工单/)
 assert.match(await picker.locator(".journey-doc-explanation").textContent(),/检验不合格/)
 assert.match(await picker.locator(".journey-doc-explanation").textContent(),/重新清洗/)
 assert.match(await picker.locator(".journey-doc-explanation").textContent(),/不是两条产线/)
 assert.equal(await picker.locator("[data-flow-document-choice]").count(),2)
 assert.match(await picker.textContent(),/CLQC-LINK-BLEND-FAILED/)
 assert.match(await picker.textContent(),/L01 配制一线/)
 assert.match(await picker.textContent(),/不合格/)
 await page.screenshot({path:"test-results/flow-doc-06-why-two-rewashing.png"})
 await picker.getByText("CLQC-LINK-BLEND-FAILED").click()
 await modal.waitFor({state:"visible"})
 assert.match(await modal.textContent(),/CLQC-LINK-BLEND-FAILED/)
 assert.match(await modal.textContent(),/清洗后仍有残留/)
 await closeRecord()

 // Different cleaning work orders on the same line are not automatically evidence of failed QC.
 await page.evaluate(()=>{
  const reports=window.FactoryModules.state.cleanReports
  const original=reports.find(r=>r.id==="CLQC-LINK-BLEND-FAILED")
  Object.assign(original,{id:"CLQC-LINK-BLEND-OTHER",task:"CLN-LINK-OTHER",status:"合格",remark:""})
 })
 await orderFlow()
 await docButton("配制线清洗执行与复核").click()
 await picker.waitFor({state:"visible"})
 assert.match(await picker.locator(".journey-doc-explanation").textContent(),/不同/)
 assert.match(await picker.locator(".journey-doc-explanation").textContent(),/同一条产线/)
 assert.match(await picker.locator(".journey-doc-explanation").textContent(),/不能认定/)
 await page.screenshot({path:"test-results/flow-doc-07-same-line-different-task-unknown-cause.png"})
 await picker.locator("[data-flow-document-dismiss]").click()

 // Two distinct physical lines are identified from the source line, not invented from the report count.
 await page.evaluate(()=>{
  const report=window.FactoryModules.state.cleanReports.find(r=>r.id==="CLQC-LINK-BLEND-OTHER")
  report.line="L02 配制二线"
 })
 await orderFlow()
 await docButton("配制线清洗执行与复核").click()
 await picker.waitFor({state:"visible"})
 assert.match(await picker.locator(".journey-doc-explanation").textContent(),/2 条产线/)
 assert.match(await picker.locator(".journey-doc-explanation").textContent(),/L01 配制一线/)
 assert.match(await picker.locator(".journey-doc-explanation").textContent(),/L02 配制二线/)
 await page.screenshot({path:"test-results/flow-doc-08-two-different-lines.png"})
 await picker.locator("[data-flow-document-dismiss]").click()
 assert.deepEqual(errors,[],"No browser JavaScript errors")
 console.log("PASS: all real documents retained; same-task failed QC explains rewash; different tasks on same line preserve uncertainty; different physical lines explicitly identified")
}catch(e){failed=true;console.error(e)}
finally{await browser?.close();server.kill("SIGTERM")}
if(failed)process.exit(1)
