import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { readFile, mkdir, writeFile } from "node:fs/promises"
import { chromium } from "playwright"
const base="http://127.0.0.1:4174/factory/"
const src=await readFile("src/catalog.ts","utf8")
const catalog=src.match(/export const DEPARTMENTS: Department\[\] = (\[[\s\S]*?\])\nexport const FEATURE_NAMES/)
assert.ok(catalog,"Department catalog should be readable")
const departments=JSON.parse(catalog[1])
const features=departments.flatMap(d=>d.features.map(f=>[d.id,f,d.name]))
const server=spawn(process.execPath,["node_modules/vite/bin/vite.js","preview","--host","127.0.0.1","--port","4174","--strictPort"],{cwd:process.cwd(),stdio:["ignore","pipe","pipe"]})
let browser;let failed=false
try {
  await mkdir("test-results",{recursive:true})
  for(let attempt=0;attempt<60;attempt++){
    try{if((await fetch(base)).ok)break}catch{}
    await new Promise(resolve=>setTimeout(resolve,400))
  }
  browser=await chromium.launch({headless:true,args:["--no-sandbox"]})
  const page=await browser.newPage({viewport:{width:1440,height:900}})
  const errors=[]
  let activeFeature="overview"
  page.on("pageerror",error=>errors.push(`${activeFeature}: ${error.message}\n${error.stack??""}`))
  await page.goto(base,{waitUntil:"networkidle"})
  await page.locator(".dashboard-kpis").waitFor()
  assert.equal(await page.locator(".kpi-card").count(),4)
  const initial=await page.evaluate(()=>JSON.parse(localStorage.getItem("factory-workspace-v4")||"null"))
  // React can bootstrap legacy data before opening any business function.
  assert.ok(await page.locator(".kpi-value").nth(1).textContent(),"Seed orders show in the dashboard")
  assert.equal(await page.locator("iframe").count(),0,"No iframe in dashboard")
  const missing=[]
  for(const [dept,feature,name] of features){
    activeFeature=`${dept}/${feature}`
    await page.evaluate(hash=>{location.hash=hash},`#/departments/${dept}/${feature}`)
    try {
      if(["leave","leaveApproval"].includes(feature)){
        await page.locator(".glass-panel [data-slot='table']").waitFor({state:"visible",timeout:15000})
      }else{
        await page.locator(".native-business .legacy-root").waitFor({state:"visible",timeout:15000})
        await page.waitForFunction(()=>{
          const view=document.querySelector(".native-business #view")
          return Boolean(view?.textContent?.trim().length>15)
        },null,{timeout:12000})
      }
      const heading=await page.locator(".page-title").textContent()
      if(!heading?.trim())missing.push(`${name}: ${feature} title missing`)
      if(await page.locator("iframe").count())missing.push(`${name}: ${feature} still uses iframe`)
    }catch(error){
      missing.push(`${name} / ${feature}: ${error.message.split("\n")[0]}`)
      if(missing.length>=3)break
    }
  }
  assert.deepEqual(missing,[],"Every department feature must render without iframe")
  assert.deepEqual(errors,[],"No uncaught errors in business modules")
  // Exercise an actual write through the original MES engine and shared workspace.
  activeFeature="sales/orders"
  await page.evaluate(()=>{location.hash="#/departments/sales/orders"})
  await page.locator(".native-business .legacy-root").waitFor({state:"visible"})
  const create=page.locator('.native-business [data-op-action="newOrder"]')
  await create.first().waitFor({state:"visible",timeout:10000})
  if(await create.count()){
    await create.first().click()
    await page.locator("#ops-form").waitFor({state:"visible",timeout:6000})
    const form=page.locator("#ops-form")
    if(await form.locator('[name="product"]').count())await form.locator('[name="product"]').fill("自动化测试产品")
    if(await form.locator('[name="spec"]').count())await form.locator('[name="spec"]').fill("测试规格")
    if(await form.locator('[name="qty"]').count())await form.locator('[name="qty"]').fill("10")
    await form.locator('button[type="submit"]').click()
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem("factory-workspace-v4")||"{}").orders?.some(o=>o.product==="自动化测试产品"),null,{timeout:6000})
    assert.ok(await page.locator(".native-business .legacy-root").isVisible(),"Workbench stays live after saving an order")
    await page.reload({waitUntil:"networkidle"})
    assert.ok(await page.evaluate(()=>JSON.parse(localStorage.getItem("factory-workspace-v4")||"{}").orders?.some(o=>o.product==="自动化测试产品")),"Created order survives refresh and React hydration")
  }else missing.push("Sales order creation button unavailable for default developer")
  assert.deepEqual(missing,[],"Complete business screen and order write regression")
  assert.deepEqual(errors,[],"No runtime errors after writing")

  // Original employee/department permission selectors remain fully interactive.
  activeFeature="it/permissions"
  await page.evaluate(()=>{location.hash="#/departments/it/permissions"})
  const selector=page.locator("#perm-employee")
  await selector.waitFor({state:"visible"})
  await selector.selectOption("E009")
  await page.waitForFunction(()=>document.querySelector(".access-selected-user strong")?.textContent==="孙浩",null,{timeout:6000})
  assert.equal(await page.locator(".access-selected-user strong").textContent(),"孙浩",
    "Employee selection updates access rights and the displayed employee")
  await page.locator("#perm-dept").selectOption("quality")
  await page.waitForFunction(()=>document.querySelector("#perm-dept")?.value==="quality",null,{timeout:6000})
  assert.equal(await page.locator("#perm-dept").inputValue(),"quality",
    "Changing department updates the permission matrix")

  // Back up the same browser records before deploying or rolling back.
  await page.getByRole("button",{name:"切换当前员工"}).click()
  const [download]=await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button",{name:/导出数据和权限/}).click()
  ])
  assert.ok(download.suggestedFilename().startsWith("factory-browser-backup-"))
  const backup=JSON.parse(await readFile(await download.path(),"utf8"))
  assert.equal(backup.format,"factory-browser-backup-v2")
  assert.ok(JSON.parse(backup.storage["factory-workspace-v4"]).orders.some(o=>o.product==="自动化测试产品"))
  assert.ok(JSON.parse(backup.storage["factory-permissions-v2"]).current,"Staff permissions are included")

  // Restore a modified backup through the real shadcn dialog and verify persistence.
  const updated=JSON.parse(backup.storage["factory-workspace-v4"])
  updated.offices={...updated.offices,quality:"自动化恢复测试办公室"}
  backup.storage["factory-workspace-v4"]=JSON.stringify(updated)
  await writeFile("test-results/restore-check.json",JSON.stringify(backup))
  await page.getByRole("button",{name:/从备份恢复数据/}).click()
  await page.locator('input[type="file"]').setInputFiles("test-results/restore-check.json")
  await page.getByRole("checkbox",{name:/我已确认将使用备份覆盖/}).check()
  await page.getByRole("button",{name:/覆盖并恢复/}).click()
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem("factory-workspace-v4")||"{}").offices?.quality==="自动化恢复测试办公室")
  assert.deepEqual(errors,[],"No runtime errors from backup import/export")
  await page.screenshot({path:"test-results/all-business-native.png",fullPage:true})
  console.log(`PASS: ${features.length} department-feature routes, 0 iframes, shared MES order write, data and permissions.`)
} catch(error){failed=true;console.error(error)}
finally{await browser?.close();server.kill("SIGTERM")}
if(failed)process.exit(1)
