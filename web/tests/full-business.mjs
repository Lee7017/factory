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
  assert.ok(await page.locator(".kpi-value").nth(0).textContent(),"Active orders show in the dashboard")
  assert.equal(await page.locator("iframe").count(),0,"No iframe in dashboard")
  const missing=[]
  const visualAudit=[]
  for(const [dept,feature,name] of features){
    activeFeature=`${dept}/${feature}`
    await page.evaluate(hash=>{location.hash=hash},`#/departments/${dept}/${feature}`)
    try {
      if(["leave","leaveApproval","employees","skills"].includes(feature)){
        await page.locator(".glass-panel [data-slot='table']").waitFor({state:"visible",timeout:15000})
      }else{
        await page.locator(".native-business .legacy-root").waitFor({state:"visible",timeout:15000})
        await page.waitForFunction(()=>{
          const view=document.querySelector(".native-business #view")
          return Boolean(view?.textContent?.trim().length>15)
        },null,{timeout:12000})
      }
      const heading=await page.locator(".crumb-current").textContent()
      if(!heading?.trim())missing.push(`${name}: ${feature} title missing`)
      if(await page.locator("iframe").count())missing.push(`${name}: ${feature} still uses iframe`)
      const appearance=await page.evaluate(()=>{
        const frame=document.querySelector(".business-page-frame")
        if(!frame)return null
        const rect=frame.getBoundingClientRect()
        const style=getComputedStyle(frame)
        return {
          family:frame.getAttribute("data-business-family"),
          frames:document.querySelectorAll(".business-page-frame").length,
          title:document.querySelector(".crumb-current")?.textContent?.trim(),
          infoButton:!!document.querySelector(`button[aria-label^="查看"][aria-label$="介绍"]`),
          redundantTitle:!!frame.querySelector(".business-page-heading"),
          borderRadius:style.borderRadius,
          width:Math.round(rect.width),
          viewport:window.innerWidth,
          horizontalOverflow:document.documentElement.scrollWidth>window.innerWidth+4
        }
      })
      if(!appearance||appearance.frames!==1||!appearance.family||!appearance.title||appearance.redundantTitle)
        missing.push(`${name}: ${feature} missing shared business frame`)
      if(appearance?.horizontalOverflow)missing.push(`${name}: ${feature} causes horizontal page overflow`)
      if(!appearance?.infoButton)missing.push(`${name}: ${feature} missing topbar info button`)
      const boxes=await page.evaluate(()=>{
        const selectors=[".shell-content",".business-page-frame",".business-page-body",".legacy-root",".legacy-workbench",".ops-workbench",".proc-page",".proc-top",".proc-approval-banner",".op-table-wrap",".op-table",".mw-page",".mw-content",".mw-table-scroll"]
        return selectors.flatMap(selector=>{
          const element=document.querySelector(selector)
          if(!element)return []
          const r=element.getBoundingClientRect(),c=getComputedStyle(element)
          return [{selector,height:Math.round(r.height),top:Math.round(r.top),bottom:Math.round(r.bottom),minHeight:c.minHeight,padding:c.padding,display:c.display,flex:c.flex,overflow:c.overflow}]
        })
      })
      visualAudit.push({department:dept,feature,...appearance,boxes})
      if(dept==="purchase"&&feature==="purchase")console.log("PURCHASE LAYOUT AUDIT",JSON.stringify(boxes))
      await page.screenshot({
        path:`test-results/business-${dept}-${feature}.jpg`,
        type:"jpeg",quality:55,fullPage:false
      })
    }catch(error){
      missing.push(`${name} / ${feature}: ${error.message.split("\n")[0]}`)
      if(missing.length>=3)break
    }
  }
  await writeFile("test-results/business-visual-audit.json",JSON.stringify(visualAudit,null,2))
  assert.equal(visualAudit.length,features.length,"Each business feature has a captured browser screenshot")
  assert.deepEqual(missing,[],"Every department feature must render inside its shared page family")
  assert.deepEqual(errors,[],"No uncaught errors in business modules")
  // Exercise an actual write through the original MES engine and shared workspace.
  activeFeature="sales/orders"
  await page.evaluate(()=>{location.hash="#/departments/sales/orders"})
  await page.locator(".native-business .legacy-root").waitFor({state:"visible"})
  // Sales-order layout must never separate the help label and create button
  // with a tall blank header. Measure what the browser actually rendered.
  const salesLayout=await page.evaluate(()=>{
    const root=document.querySelector(".native-business .ops-workbench")
    const row=root?.querySelector(":scope > .ops-command-row")
    const help=row?.querySelector(".business-help")
    const button=row?.querySelector('[data-op-action="newOrder"]')
    const table=root?.querySelector(":scope > .op-table-wrap")
    if(!root||!row||!help||!button||!table)return null
    const a=row.getBoundingClientRect(),b=help.getBoundingClientRect()
    const c=button.getBoundingClientRect(),d=table.getBoundingClientRect()
    return {
      rowHeight:Math.round(a.height),
      tableGap:Math.round(d.top-a.bottom),
      helpCenter:Math.round((b.top+b.bottom)/2),
      buttonCenter:Math.round((c.top+c.bottom)/2),
      duplicateHeading:!!root.querySelector(":scope > .ops-heading"),
      separateHelp:!!root.querySelector(":scope > .business-help")
    }
  })
  assert.ok(salesLayout,"Sales orders must use shared compact command row")
  assert.ok(salesLayout.rowHeight<=55,`Sales toolbar has excessive whitespace: ${JSON.stringify(salesLayout)}`)
  assert.ok(salesLayout.tableGap>=0&&salesLayout.tableGap<=20,`Sales table does not follow actions: ${JSON.stringify(salesLayout)}`)
  assert.ok(Math.abs(salesLayout.helpCenter-salesLayout.buttonCenter)<=18,`Help and create action must align: ${JSON.stringify(salesLayout)}`)
  assert.equal(salesLayout.duplicateHeading,false,"Remove duplicate operation heading")
  assert.equal(salesLayout.separateHelp,false,"Help must not occupy a second row")
  await page.screenshot({path:"test-results/sales-orders-command-row.png",fullPage:false})
  console.log("SALES COMMAND ROW VISUAL CHECK",JSON.stringify(salesLayout))
  const create=page.locator('.native-business [data-op-action="newOrder"]')
  await create.first().waitFor({state:"visible",timeout:10000})
  assert.equal(await create.first().getAttribute("data-slot"),"button","MES action buttons should be rendered using shadcn Button")
  assert.ok(await page.locator(".native-business [data-slot=table]").count()>0,"MES tables should be React shadcn Table elements")
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
  await page.waitForTimeout(350)
  console.log("PERMISSION DEBUG",JSON.stringify(await page.evaluate(()=>({
    selectedOption:document.querySelector("#perm-employee")?.value,
    selectedEmployee:window.FactoryAccess?.selectedEmployee,
    selectedText:document.querySelector(".access-selected-user strong")?.textContent,
    title:document.querySelector(".crumb-current")?.textContent
  }))))
  await page.waitForFunction(()=>document.querySelector(".access-selected-user strong")?.textContent==="孙浩",null,{timeout:6000})
  assert.equal(await page.locator(".access-selected-user strong").textContent(),"孙浩",
    "Employee selection updates access rights and the displayed employee")
  await page.locator("#perm-dept").selectOption("quality")
  await page.waitForFunction(()=>document.querySelector("#perm-dept")?.value==="quality",null,{timeout:6000})
  assert.equal(await page.locator("#perm-dept").inputValue(),"quality",
    "Changing department updates the permission matrix")

  // Native shadcn employee directory: authorized edits share the same ops.staffEdits data.
  activeFeature="it/employees"
  await page.evaluate(()=>{location.hash="#/departments/it/employees"})
  await page.getByRole("button",{name:"编辑孙浩的档案"}).click()
  const editDialog=page.getByRole("dialog",{name:/编辑员工档案/})
  await editDialog.getByRole("textbox",{name:"联系电话"}).fill("010-5555-0109")
  await editDialog.getByRole("button",{name:"保存档案"}).click()
  await page.waitForFunction(()=>{
    const x=JSON.parse(localStorage.getItem("factory-workspace-v4")||"{}")
    return x.ops?.staffEdits?.E009?.phone==="010-5555-0109"
  },null,{timeout:6000})
  await page.reload({waitUntil:"networkidle"})
  await page.getByText("010-5555-0109").waitFor({state:"visible",timeout:6000})
  assert.equal(await page.locator("iframe").count(),0,"Employee directory is a native shadcn page")

  // React skill matrix shares the live MES skills and the original L2 minimum for scheduling.
  activeFeature="hr/skills"
  await page.evaluate(()=>{location.hash="#/departments/hr/skills"})
  const worker=await page.evaluate(()=>window.FactoryAccess.staff.find(p=>p.dept==="生产车间"))
  await page.getByRole("button",{name:`评定${worker.name}技能`}).click()
  await page.getByRole("dialog").getByRole("combobox",{name:/评定等级/}).click()
  await page.getByRole("option",{name:"L3"}).click()
  await page.getByRole("dialog").getByRole("button",{name:"保存技能等级"}).click()
  await page.waitForFunction(id=>{
    const x=JSON.parse(localStorage.getItem("factory-workspace-v4")||"{}")
    return x.ops?.skills?.[id]?.["配料"]==="L3"
  },worker.id,{timeout:6000})
  await page.reload({waitUntil:"networkidle"})
  assert.ok(await page.getByRole("table").count(),"Native shadcn skills table survives reload")
  assert.equal(await page.locator("iframe").count(),0,"Skill matrix must not be embedded in an iframe")

  // Back up the same browser records before deploying or rolling back.
  await page.getByRole("button",{name:"切换当前员工"}).click()
  const [download]=await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button",{name:/导出数据和权限/}).click()
  ])
  assert.ok(download.suggestedFilename().startsWith("factory-browser-backup-"))
  const backup=JSON.parse(await readFile(await download.path(),"utf8"))
  assert.equal(backup.format,"factory-browser-backup-v2")
  assert.ok(!Object.hasOwn(backup.storage,"factory-workspace-v2"),"Obsolete v2 records must not enter current backups")
  assert.ok(JSON.parse(backup.storage["factory-workspace-v4"]).orders.some(o=>o.product==="自动化测试产品"))
  assert.ok(JSON.parse(backup.storage["factory-permissions-v2"]).current,"Staff permissions are included")

  // A v2-only backup must be rejected. No backward import is offered.
  const oldBackup={format:"factory-browser-backup-v1",storage:{"factory-workspace-v2":"{}","factory-permissions-v2":"{}"}}
  await writeFile("test-results/obsolete-backup.json",JSON.stringify(oldBackup))
  await page.getByRole("button",{name:/从备份恢复数据/}).click()
  await page.locator('input[type="file"]').setInputFiles("test-results/obsolete-backup.json")
  await page.getByRole("alert").filter({hasText:"备份格式不匹配"}).waitFor({state:"visible"})
  assert.ok(await page.getByRole("button",{name:/覆盖并恢复/}).isDisabled(),"Cannot restore old data")
  await page.keyboard.press("Escape")
  // Restore a modified current-version backup through the real shadcn dialog.
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
