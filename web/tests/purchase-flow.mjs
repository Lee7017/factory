import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { chromium } from "playwright"

const base="http://127.0.0.1:4175/factory/"
const server=spawn(process.execPath,["node_modules/vite/bin/vite.js","preview","--host","127.0.0.1","--port","4175","--strictPort"],{cwd:process.cwd(),stdio:["ignore","pipe","pipe"]})
let browser,failed=false
try {
  for(let i=0;i<80;i++){try{if((await fetch(base)).ok)break}catch{}await new Promise(r=>setTimeout(r,300))}
  browser=await chromium.launch({headless:true,args:["--no-sandbox"]})
  const page=await browser.newPage({viewport:{width:1440,height:900}})
  const errors=[]
  page.on("pageerror",err=>errors.push(err.stack??err.message))
  await page.goto(base,{waitUntil:"networkidle"})
  await page.locator(".department-tile").first().waitFor()
  const getData=()=>page.evaluate(()=>JSON.parse(localStorage.getItem("factory-workspace-v2")||"{}"))
  async function asEmployee(id){
    const employee=await page.evaluate(id=>{
      const a=window.FactoryAccess
      const who=a?.staff.find(p=>p.id===id)
      if(!who)throw Error("Missing employee "+id)
      if(!a.switchCurrent(id))throw Error("Switch rejected")
      return who
    },id)
    // Reinitialize React's access hook and business engine permission state via focus.
    await page.evaluate(()=>window.dispatchEvent(new Event("focus")))
    await page.getByRole("button",{name:"切换当前员工"}).getByText(employee.name).waitFor()
    return employee
  }
  async function navigate(dept,feature){
    await page.evaluate(hash=>{location.hash=hash},`#/departments/${dept}/${feature}`)
    await page.locator(".native-business .legacy-root").waitFor({state:"visible",timeout:12000})
    await page.waitForFunction(()=>document.querySelector(".native-business #view")?.textContent?.trim().length>20)
  }
  await asEmployee("E014")
  await navigate("purchase","purchase")
  // Original engine initializes the seeded purchase PO-001 only after this mount.
  const previous=(await getData()).ops?.purchases?.length??0
  const create=page.locator('[data-proc-action="newPurchase"]')
  await create.waitFor({state:"visible"})
  await create.click()
  const form=page.locator("#proc-form")
  await form.waitFor({state:"visible"})
  await form.locator('[name="material"]').selectOption("RM-001")
  await form.locator('[name="qty"]').fill("12")
  await form.locator('[name="supplier"]').fill("测试供应商")
  await form.locator('button[type="submit"]').click()
  await page.waitForFunction(prev=>{
    const x=JSON.parse(localStorage.getItem("factory-workspace-v2")||"{}")
    return x.ops?.purchases?.length===prev+1
  },previous)
  let data=await getData()
  const record=data.ops.purchases.find(x=>x.supplier==="测试供应商")
  assert.equal(record?.status,"待审批")
  assert.equal(record?.createdBy,"E014")
  const poId=record.id
  await navigate("purchase","purchase")
  // The creator must not be able to approve their own purchase order.
  assert.equal(await page.locator(`[data-proc-action="approve"][data-proc-id="${poId}"]`).count(),0,"Creator cannot approve")
  await asEmployee("E021")
  await navigate("purchase","purchase")
  const approve=page.locator(`[data-proc-action="approve"][data-proc-id="${poId}"]`)
  await approve.waitFor({state:"visible"})
  await approve.click()
  await page.waitForFunction(po=>{
    const x=JSON.parse(localStorage.getItem("factory-workspace-v2")||"{}")
    return x.ops.purchases.find(p=>p.id===po)?.status==="待到货"
  },poId)
  await asEmployee("E009")
  await navigate("warehouse","warehouseIncoming")
  const receive=page.locator(`[data-proc-action="newReceipt"][data-proc-id="${poId}"]`)
  await receive.waitFor({state:"visible"})
  await receive.click()
  const receiptForm=page.locator("#proc-form")
  await receiptForm.waitFor({state:"visible"})
  await receiptForm.locator('[name="qty"]').fill("12")
  await receiptForm.locator('[name="supplierLot"]').fill("QA-TEST-LOT")
  await receiptForm.locator('button[type="submit"]').click()
  await page.waitForFunction(po=>{
    const x=JSON.parse(localStorage.getItem("factory-workspace-v2")||"{}")
    return x.modules?.incoming?.some(r=>r.purchase===po&&r.status==="待QC")
  },poId)
  data=await getData()
  const rec=data.modules.incoming.find(r=>r.purchase===poId)
  assert.ok(data.modules.inspections.some(r=>r.incoming===rec.id&&r.status==="待判定"),"QC inspection auto-created")
  assert.ok(!data.modules.batches.some(r=>r.incoming===rec.id),"No stock batch without QC")
  const beforeStock=data.ops.stock["RM-001"]
  assert.equal(beforeStock,500,"Stock cannot increase before QC")
  const inspection=data.modules.inspections.find(r=>r.incoming===rec.id)
  await asEmployee("E006")
  await navigate("quality","qaQc")
  const pass=page.locator(`[data-module-action="qc:pass"][data-mid="${inspection.id}"]`)
  await pass.waitFor({state:"visible"})
  await pass.click()
  await page.waitForFunction(id=>{
    const x=JSON.parse(localStorage.getItem("factory-workspace-v2")||"{}")
    return x.modules?.inspections?.find(r=>r.id===id)?.status==="合格"
  },inspection.id)
  data=await getData()
  assert.equal(data.modules.incoming.find(r=>r.id===rec.id).status,"合格待入库","QC must release to warehouse")
  assert.equal(data.ops.stock["RM-001"],beforeStock,"QC pass alone must not increase inventory")
  await asEmployee("E009")
  await navigate("warehouse","warehouseIncoming")
  const store=page.locator(`[data-proc-action="storeReceipt"][data-proc-id="${rec.id}"]`)
  await store.waitFor({state:"visible"})
  await store.click()
  await page.waitForFunction(id=>{
    const x=JSON.parse(localStorage.getItem("factory-workspace-v2")||"{}")
    return x.modules?.incoming?.find(r=>r.id===id)?.status==="已入库"
  },rec.id)
  data=await getData()
  assert.equal(data.ops.stock["RM-001"],beforeStock+12,"Warehouse must post exactly 12 units after QC")
  assert.equal(data.modules.batches.filter(r=>r.incoming===rec.id).length,1,"Exactly one qualified batch")
  assert.equal(data.modules.batches.find(r=>r.incoming===rec.id).quality,"合格","Stored batch must be qualified")
  assert.equal(data.ops.purchases.find(r=>r.id===poId).status,"已入库")
  await navigate("warehouse","warehouseIncoming")
  assert.equal(await page.locator(`[data-proc-action="storeReceipt"][data-proc-id="${rec.id}"]`).count(),0,"Cannot store twice")
  assert.deepEqual(errors,[],"No uncaught errors during purchase, QC and stock receipt")
  console.log("PASS: purchase → separate approval → receiving → QC → qualified inventory, single batch, no double posting")
}catch(e){failed=true;console.error(e)}finally{await browser?.close();server.kill("SIGTERM")}
if(failed)process.exit(1)
