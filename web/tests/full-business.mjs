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
        await page.locator(".business-native-list [data-slot='table']").waitFor({state:"visible",timeout:15000})
      }else{
        await page.locator(".native-business .legacy-root").waitFor({state:"visible",timeout:15000})
        await page.waitForFunction(()=>{
          const view=document.querySelector(".native-business #view")
          return Boolean(view?.querySelector(".ops-workbench,.mw-page,.proc-page,[data-slot=table],button"))
        },null,{timeout:12000})
      }
      const heading=await page.locator('.feature-band-button[aria-current="page"]').textContent()
      if(!heading?.trim())missing.push(`${name}: ${feature} active feature title missing`)
      if(await page.locator("iframe").count())missing.push(`${name}: ${feature} still uses iframe`)
      const appearance=await page.evaluate(()=>{
        const frame=document.querySelector(".business-page-frame")
        if(!frame)return null
        const rect=frame.getBoundingClientRect()
        const style=getComputedStyle(frame)
        return {
          family:frame.getAttribute("data-business-family"),
          frames:document.querySelectorAll(".business-page-frame").length,
          title:document.querySelector('.feature-band-button[aria-current="page"]')?.textContent?.trim(),
          featureBandHeight:Math.round(document.querySelector(".feature-band")?.getBoundingClientRect().height??0),
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
      if(appearance&&appearance.featureBandHeight!==48)missing.push(`${name}: ${feature} feature band height is ${appearance.featureBandHeight}px`)
      if(["leave","leaveApproval","employees","skills"].includes(feature)){
        const native=await page.evaluate(()=>{
          const list=document.querySelector(".business-native-list")
          const toolbar=list?.querySelector(".business-native-list-toolbar")
          const table=list?.querySelector(".business-native-list-table")
          if(!list||!toolbar||!table)return null
          const l=list.getBoundingClientRect(),t=toolbar.getBoundingClientRect(),b=table.getBoundingClientRect()
          return {
            toolbarHeight:Math.round(t.height),
            toolbarTopGap:Math.round(t.top-l.top),
            tableGap:Math.round(b.top-t.bottom),
            duplicateHeading:!!document.querySelector(".business-native-page h1,.business-native-page h2")
          }
        })
        if(!native)missing.push(`${name}: ${feature} missing native shared list foundation`)
        else{
          if(native.toolbarHeight>58)missing.push(`${name}: ${feature} native toolbar too tall (${native.toolbarHeight}px)`)
          if(Math.abs(native.toolbarTopGap)>2)missing.push(`${name}: ${feature} native toolbar not attached to list surface`)
          if(Math.abs(native.tableGap)>2)missing.push(`${name}: ${feature} native table detached from toolbar`)
          if(native.duplicateHeading)missing.push(`${name}: ${feature} duplicates title inside content`)
        }
      }
      const boxes=await page.evaluate(()=>{
        const selectors=[".shell-content",".business-page-frame",".business-page-body",".legacy-root",".legacy-workbench",".ops-workbench",".proc-page",".proc-top",".proc-approval-banner",".op-table-wrap",".op-table",".mw-page",".mw-content",".mw-table-scroll"]
        return selectors.flatMap(selector=>{
          const element=document.querySelector(selector)
          if(!element)return []
          const r=element.getBoundingClientRect(),c=getComputedStyle(element)
          return [{selector,height:Math.round(r.height),top:Math.round(r.top),bottom:Math.round(r.bottom),minHeight:c.minHeight,padding:c.padding,display:c.display,flex:c.flex,overflow:c.overflow}]
        })
      })
      // Shared visual rules must be checked on every route, not just on one sample page.
      const layout=await page.evaluate(()=>{
        const frame=document.querySelector(".business-page-frame")
        const root=frame?.querySelector(".legacy-root")
        const view=root?.querySelector("#view")
        const command=view?.querySelector(".ops-workbench > .ops-command-row")
        const workbench=view?.querySelector(".ops-workbench,.mw-page,.proc-page")
        const main=frame?.querySelector(".business-page-body")
        const toBox=element=>{
          if(!element)return null
          const r=element.getBoundingClientRect()
          return {top:r.top,bottom:r.bottom,height:r.height,left:r.left,right:r.right}
        }
        const f=toBox(frame),m=toBox(main),w=toBox(workbench),c=toBox(command)
        const gapToTable=command?.nextElementSibling?.matches(".op-table-wrap")
          ?toBox(command.nextElementSibling).top-c.bottom:null
        const buttons=[...(command?.querySelectorAll("button")??[])]
          .filter(el=>getComputedStyle(el).display!=="none")
        const b=buttons[0]?toBox(buttons[0]):null
        const h=command?.querySelector(".business-help")
        const help=h?toBox(h):null
        return {
          frameBackground:frame?getComputedStyle(frame).backgroundColor:null,
          frameBorder:frame?getComputedStyle(frame).borderTopWidth:null,
          firstContentGap:f&&w?Math.round(w.top-f.top):f&&m?Math.round(m.top-f.top):null,
          commandHeight:c?Math.round(c.height):null,
          commandTableGap:gapToTable===null?null:Math.round(gapToTable),
          commandAlignment:b&&help?Math.round(Math.abs((b.top+b.bottom-help.top-help.bottom)/2)):null,
          hasDetachedToolbar:!!view?.querySelector(".ops-workbench > .ops-heading"),
          hasDetachedHelp:!!view?.querySelector(".ops-workbench > .business-help"),
          legacyCssLinks:document.querySelectorAll('link[href*="legacy-business.css"]').length,
          moduleDetachedCommand:!!view?.querySelector(".mw-page > .mw-commandbar"),
          moduleTableToolbarHeight:(()=>{
            const el=view?.querySelector(".mw-table-scroll > .mw-table-toolbar")
            return el?Math.round(el.getBoundingClientRect().height):null
          })(),
          moduleToolbarInsideTable:(()=>{
            const el=view?.querySelector(".mw-table-scroll > .mw-table-toolbar")
            return el?el.parentElement?.classList.contains("mw-table-scroll")??false:null
          })()
        }
      })
      if(layout.legacyCssLinks!==1)missing.push(`${name}: ${feature} legacy CSS must be loaded once in document head`)
      if(layout.frameBorder!=="0px")missing.push(`${name}: ${feature} duplicate outer card border`)
      if(layout.firstContentGap!==null&&layout.firstContentGap>85)
        missing.push(`${name}: ${feature} has ${layout.firstContentGap}px blank top area`)
      if(layout.commandHeight!==null&&layout.commandHeight>62)
        missing.push(`${name}: ${feature} command row too tall (${layout.commandHeight}px)`)
      if(layout.commandTableGap!==null&&(layout.commandTableGap<0||layout.commandTableGap>22))
        missing.push(`${name}: ${feature} command/table gap ${layout.commandTableGap}px`)
      if(layout.commandAlignment!==null&&layout.commandAlignment>20)
        missing.push(`${name}: ${feature} action/help alignment off by ${layout.commandAlignment}px`)
      if(layout.hasDetachedToolbar||layout.hasDetachedHelp)
        missing.push(`${name}: ${feature} still has split legacy toolbar/help`)
      if(layout.moduleDetachedCommand)
        missing.push(`${name}: ${feature} still has detached module command bar`)
      if(layout.moduleTableToolbarHeight!==null&&layout.moduleTableToolbarHeight>54)
        missing.push(`${name}: ${feature} module table toolbar too tall (${layout.moduleTableToolbarHeight}px)`)
      if(layout.moduleToolbarInsideTable===false)
        missing.push(`${name}: ${feature} module action toolbar is not inside table surface`)
      visualAudit.push({department:dept,feature,...appearance,boxes,layout})
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
  // The order-status rail is collapsible; create/search/filter stay visible.
  const salesPanel=page.locator('.native-business .biz-order-panel[data-order-panel="orders"]')
  await salesPanel.waitFor({state:"visible"})
  assert.equal(await salesPanel.locator(".biz-order-stat").count(),5,"Sales has five status counts")
  assert.equal(await salesPanel.locator(".biz-order-stats").isVisible(),true,"Status counts initially visible")
  assert.equal(await salesPanel.locator(".biz-order-toolbar [data-op-action='newOrder']").count(),1,"Create action stays in the filtering toolbar")
  const salesFold=salesPanel.locator(".biz-order-fold")
  await salesFold.click()
  assert.equal(await salesPanel.locator(".biz-order-stats").isVisible(),false,"Folding hides only status counts")
  const contextTools=page.locator(".business-context-tools")
  await contextTools.waitFor({state:"visible"})
  const contextSearch=contextTools.locator(".business-context-search input")
  assert.equal(await contextSearch.isVisible(),true,"Context search stays visible in the feature band after folding")
  assert.equal(await salesPanel.locator(".biz-order-search").isVisible(),false,"Legacy duplicate search is hidden")
  assert.equal(await salesPanel.locator(".biz-order-status").isVisible(),false,"Legacy duplicate status select is hidden")
  assert.equal(await salesPanel.locator("[data-op-action='newOrder']").isVisible(),true,"Create stays visible after folding")
  await contextSearch.fill("INVALID-NO-MATCH")
  await page.waitForTimeout(80)
  assert.equal(await salesPanel.locator(".biz-order-row:visible").count(),0,"Feature-band search filters actual order rows")
  await contextSearch.fill("")
  await page.waitForTimeout(80)
  const statusButtons=contextTools.locator(".business-context-status button")
  assert.ok(await statusButtons.count()>1,"Real order states are exposed as contextual status buttons")
  const totalSales=await salesPanel.locator(".biz-order-row").count()
  await statusButtons.nth(1).click()
  await page.waitForTimeout(80)
  const filteredSales=await salesPanel.locator(".biz-order-row:visible").count()
  assert.ok(filteredSales>0&&filteredSales<=totalSales,"Context status filters actual order rows")
  await statusButtons.first().click()
  await page.waitForTimeout(80)
  assert.equal(await salesPanel.locator(".biz-order-row:visible").count(),totalSales,"All status restores the complete order list")
  await salesFold.click()
  assert.equal(await salesPanel.locator(".biz-order-stats").isVisible(),true,"Stats can be expanded again")
  await page.screenshot({path:"test-results/sales-orders-table-toolbar.png",fullPage:false})
  console.log("SALES ORDER FOLD & FILTER CHECK",JSON.stringify({realStatus}))
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
  // The original animated cross-department journey must remain visible in React,
  // including its running border, full-page overlay and precise bottleneck tracking.
  await page.locator('.native-business [data-op-action="detailFlow"]').first().waitFor({state:"visible"})
  await page.locator('.native-business [data-op-action="detailFlow"]').first().click()
  const flow=page.locator('body > .legacy-flow-portal-root #flow-transition-host')
  await flow.locator('.journey-dialog').waitFor({state:"visible",timeout:8000})
  assert.equal(await page.locator('.native-business #flow-transition-host').count(),0,"Flow must not be clipped inside business glass")
  const flowRect=await flow.boundingBox()
  assert.ok(flowRect&&Math.abs(flowRect.x)<=2&&Math.abs(flowRect.y)<=2,
    "Journey overlay must cover viewport, not only business workbench")
  const runningBorder=flow.locator('.journey-marquee rect').first()
  await runningBorder.waitFor({state:"attached",timeout:7000})
  const borderAnimation=await runningBorder.evaluate(el=>getComputedStyle(el).animationName)
  assert.ok(borderAnimation.includes("journey-border-march"),"Animated journey border must retain running animation")
  // Current flow UX: no order tabs; first two cards open a right-side order details drawer.
  assert.equal(await flow.locator('[data-journey-tab]').count(),0)
  assert.equal(await flow.locator('[data-flow-order-content]').count(),2)
  assert.equal(await flow.locator('.journey-return-overview,.journey-step-count,.journey-step-returns').count(),0)
  await page.screenshot({path:"test-results/order-animated-journey.png",fullPage:false})
  await flow.locator('[data-flow-order-content]').first().click()
  const details=flow.locator('.journey-order-panel')
  await details.waitFor({state:"visible",timeout:7000})
  assert.ok((await details.textContent())?.includes("订单编号"),"Order content opens in the right drawer")
  const drawerRight=await details.evaluate(el=>({right:el.getBoundingClientRect().right,viewport:window.innerWidth}))
  assert.ok(Math.abs(drawerRight.right-drawerRight.viewport)<40,"Order details should be aligned to the right edge")
  await details.locator('[data-flow-order-dismiss]').click()
  await details.waitFor({state:"detached",timeout:5000})
  const currentCard=flow.locator('.journey-card.is-current').first()
  await currentCard.waitFor({state:"visible",timeout:7000})
  const tracking=currentCard.locator('[data-flow-track]')
  if(await tracking.count()){
    const sourceHash=await page.evaluate(()=>location.hash)
    await tracking.click()
    await page.waitForFunction(source=>location.hash!==source,sourceHash,{timeout:8000})
    const tracked=page.locator('.native-business .bottleneck-track-highlight')
    await tracked.first().waitFor({state:"visible",timeout:9000})
    console.log("JOURNEY BOTTLENECK TRACKING",JSON.stringify({
      borderAnimation,target:await page.evaluate(()=>location.hash),
      trackedText:(await tracked.first().textContent())?.slice(0,80)
    }))
  }else{
    // Read-only flow details may not have a navigable next step; the current card must show history.
    await currentCard.click()
    await details.waitFor({state:"visible",timeout:7000})
    assert.ok((await details.textContent())?.includes("记录"))
    await details.locator('[data-flow-order-dismiss]').click()
    await page.evaluate(()=>window.FactoryFlowUI?.dismiss?.())
  }
  // Inventory batches are the representative module-record page:
  // summary first, actual ledger table second, create action belongs to that ledger table.
  activeFeature="warehouse/warehouseOps"
  await page.evaluate(()=>{location.hash="#/departments/warehouse/warehouseOps"})
  await page.locator('.native-business [data-module-page="warehouseOps"]').waitFor({state:"visible",timeout:10000})
  const warehouseLayout=await page.evaluate(()=>{
    const page=document.querySelector('[data-module-page="warehouseOps"]')
    const overview=page?.querySelector(".mw-stock-overview")
    const ledger=page?.querySelector(".mw-ledger-panel")
    const head=ledger?.querySelector(":scope > .mw-ledger-head")
    const action=head?.querySelector('[data-module-action="form:batch"]')
    const table=ledger?.querySelector(":scope > .mw-table-scroll")
    if(!page||!overview||!ledger||!head||!action||!table)return null
    const o=overview.getBoundingClientRect(),l=ledger.getBoundingClientRect()
    const h=head.getBoundingClientRect(),a=action.getBoundingClientRect(),t=table.getBoundingClientRect()
    return {
      overviewHeight:Math.round(o.height),
      headHeight:Math.round(h.height),
      actionInside:a.top>=h.top-1&&a.bottom<=h.bottom+1,
      tableGap:Math.round(t.top-h.bottom),
      detached:!!page.querySelector(":scope > .mw-commandbar,.mw-section-head,.mw-data-note"),
      ledgerBelowOverview:l.top>=o.bottom
    }
  })
  assert.ok(warehouseLayout,"Warehouse batches must render compact overview and ledger surfaces")
  assert.equal(warehouseLayout.detached,false,"Warehouse batches must not contain detached headings, notes, or command bars")
  assert.equal(warehouseLayout.actionInside,true,"Register batch action must sit inside ledger title bar")
  assert.equal(warehouseLayout.ledgerBelowOverview,true,"Inventory overview must precede the actual batch ledger")
  assert.ok(warehouseLayout.headHeight<=52,`Warehouse ledger title bar too tall: ${JSON.stringify(warehouseLayout)}`)
  assert.ok(Math.abs(warehouseLayout.tableGap)<=2,`Warehouse table must directly follow ledger title: ${JSON.stringify(warehouseLayout)}`)
  await page.screenshot({path:"test-results/warehouse-batches-unified.png",fullPage:false})
  console.log("WAREHOUSE UNIFIED LAYOUT CHECK",JSON.stringify(warehouseLayout))

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
    title:document.querySelector('.feature-band-button[aria-current="page"]')?.textContent
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
