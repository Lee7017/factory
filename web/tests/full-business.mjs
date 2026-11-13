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
          const toolbar=document.querySelector("#business-context-tools-host .business-context-tools")
          const table=list?.querySelector(".business-native-list-table")
          if(!list||!toolbar||!table)return null
          const t=toolbar.getBoundingClientRect(),b=table.getBoundingClientRect()
          return {
            toolbarHeight:Math.round(t.height),
            toolbarAboveTable:t.bottom<=b.top,
            topRight:t.right<=innerWidth,
            noInternalToolbar:!list.querySelector(".business-native-list-toolbar"),
            duplicateHeading:!!document.querySelector(".business-native-page h1,.business-native-page h2")
          }
        })
        if(!native)missing.push(`${name}: ${feature} missing native shared list foundation`)
        else{
          if(native.toolbarHeight>58)missing.push(`${name}: ${feature} native toolbar too tall (${native.toolbarHeight}px)`)
          if(!native.toolbarAboveTable||!native.topRight||!native.noInternalToolbar)
            missing.push(`${name}: ${feature} toolbar did not move to top-right feature band`)
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
      // Every unfinished legacy business route follows the same five ERP table
      // rules; APS/Gantt and earlier completed sales, procurement, PMC are excluded.
      if(!["sales","purchase","pmc"].includes(dept)&&
         !["leave","leaveApproval","employees","skills"].includes(feature)){
        const standardized=await page.evaluate(()=>{
          const root=document.querySelector(".remaining-business-ledger")
          if(!root)return null
          const tables=[...root.querySelectorAll("table[data-flat-ledger-table]")]
          const toolbarSources=[...root.querySelectorAll("[data-flat-toolbar-action]")]
          const topActions=[...document.querySelectorAll("#business-context-tools-host button.business-context-create")]
          const allHeaders=tables.flatMap(table=>[...table.querySelectorAll("thead th")])
          const statusNames=/^(?:状态|审批状态|处理状态|执行状态|流程状态|质量状态|订单状态|审核状态|工单状态|任务状态|当前状态|开工前 Gate|QC 判定|判定状态|检验结果|操作结果|结论|状态 \/ 质检)$/
          const filterHeadings=allHeaders.filter(el=>statusNames.test(el.querySelector(".flat-ledger-filter-control > span")?.textContent?.trim()??el.textContent?.trim()??""))
          const filters=[...root.querySelectorAll("[data-flat-ledger-filter]")]
          const badge=root.querySelector(".mw-status:not(.mw-alert),.op-badge:not(.danger):not(.warning)")
          const actualButton=tables.flatMap(table=>[...table.querySelectorAll("tbody tr td:last-child button")]).find(
            button=>button.getBoundingClientRect().width>0)
          const lastTd=actualButton?.closest("td")
          const lastTable=lastTd?.closest("table")
          const lastHeading=lastTable?.querySelector("thead th:last-child")
          const cell=lastTd?.getBoundingClientRect(),head=lastHeading?.getBoundingClientRect()
          const host=document.querySelector(".business-page-body")
          const tablePalette=tables.every(table=>
            getComputedStyle(table).backgroundColor==="rgb(255, 255, 255)"&&
            [...table.querySelectorAll("thead th")].every(th=>
              getComputedStyle(th).backgroundColor==="rgb(244, 244, 239)"))
          return {
            tables:tables.length,
            filters:filters.length,
            sourceActions:toolbarSources.length,
            topActions:topActions.length,
            statusInHeaders:filterHeadings.every(head=>Boolean(head.querySelector("[data-flat-ledger-filter]"))),
            cleanPalette:tablePalette,
            flatContainer:getComputedStyle(host).backgroundColor==="rgba(0, 0, 0, 0)"&&
              getComputedStyle(host).borderTopWidth==="0px",
            noDuplicateActions:toolbarSources.every(node=>node.getClientRects().length===0),
            actionColumnsAligned:!actualButton||!lastTd||!lastHeading||
              Math.abs((cell?.left??0)-(head?.left??0))<4,
            badgeNeutral:!badge||getComputedStyle(badge).backgroundColor==="rgb(251, 252, 248)",
            pageOverflow:document.documentElement.scrollWidth>innerWidth+4
          }
        })
        if(!standardized)missing.push(`${name}: ${feature} missing flat-ledger root`)
        else{
          for(const key of ["statusInHeaders","cleanPalette","flatContainer",
            "noDuplicateActions","actionColumnsAligned","badgeNeutral"]){
            if(!standardized[key])missing.push(`${name}: ${feature} failed ${key}: ${JSON.stringify(standardized)}`)
          }
          if(standardized.sourceActions!==standardized.topActions)
            missing.push(`${name}: ${feature} top-right action count differs: ${JSON.stringify(standardized)}`)
          if(standardized.pageOverflow)missing.push(`${name}: ${feature} page overflow`)
          visualAudit.push({department:dept,feature,...appearance,boxes,layout,standardized})
        }
      }else visualAudit.push({department:dept,feature,...appearance,boxes,layout})

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
  // Exercise the new real column filters across modules, stock, QA, and finance.
  // Empty tables keep the select visible but may have no non-empty choices.
  for(const [dept,feature] of [
    ["quality","qaQc"],["quality","qaNcr"],["warehouse","warehouseOps"],
    ["warehouse","warehouseIncoming"],["production","workshop"],
    ["production","nonProductionTasks"],["finance","finance"],
    ["leadership","approvals"],["it","templates"]
  ]){
    activeFeature=dept+"/"+feature
    await page.evaluate(([d,f])=>{location.hash="#/departments/"+d+"/"+f},[dept,feature])
    const tableRoot=page.locator(".remaining-business-ledger")
    await tableRoot.waitFor({state:"visible",timeout:15000})
    const selects=tableRoot.locator("[data-flat-ledger-filter]")
    const count=await selects.count()
    for(let index=0;index<count;index++){
      const select=selects.nth(index)
      if(await select.locator("option").count()<2)continue
      const table=select.locator("xpath=ancestor::table[1]")
      const original=await table.locator("tbody tr[data-flat-ledger-row]:visible").count()
      await select.selectOption({index:1})
      await page.waitForTimeout(65)
      const filtered=await table.locator("tbody tr[data-flat-ledger-row]:visible").count()
      assert.ok(filtered<=original,dept+"/"+feature+" must filter actual data rows")
      assert.equal(await select.locator("xpath=..").evaluate(el=>getComputedStyle(el).backgroundColor),
        "rgb(251, 252, 248)",dept+"/"+feature+" selected column uses #FBFCF8")
      await select.selectOption("")
      await page.waitForTimeout(65)
      assert.equal(await table.locator("tbody tr[data-flat-ledger-row]:visible").count(),original,
        dept+"/"+feature+" resets to the complete table")
    }
    assert.equal(await page.locator(".business-context-status").count(),0,
      dept+"/"+feature+" has no redundant status filter above tables")
    await page.screenshot({path:"test-results/flat-standard-"+dept+"-"+feature+".png"})
  }
  // The actual legacy button is still responsible for the business form.
  await page.evaluate(()=>{location.hash="#/departments/quality/qaQc"})
  const newInspection=page.locator("#business-context-tools-host").getByRole("button",{name:"新建报检单"})
  await newInspection.waitFor({state:"visible",timeout:12000})
  await newInspection.click()
  await page.locator(".mw-modal").waitFor({state:"visible"})
  assert.ok((await page.locator(".mw-modal").textContent())?.includes("新建报检单"),
    "Top-right creation button reuses the existing QA form")
  await page.locator('.mw-modal [data-module-action="closeModal"]').first().click()
  await page.locator(".mw-modal").waitFor({state:"hidden"})
  await page.evaluate(()=>{location.hash="#/departments/warehouse/warehouseOps"})
  const batchAction=page.locator("#business-context-tools-host").getByRole("button",{name:"登记批次"})
  await batchAction.waitFor({state:"visible"})
  await batchAction.click()
  await page.locator(".mw-modal").waitFor({state:"visible"})
  assert.ok((await page.locator(".mw-modal").textContent())?.includes("仓库批次"),
    "Top-right batch registration opens the original warehouse form")
  await page.locator('.mw-modal [data-module-action="closeModal"]').first().click()
  await page.locator(".mw-modal").waitFor({state:"hidden"})
  // The separately migrated React leave table follows the same five rules.
  await page.evaluate(()=>{location.hash="#/departments/hr/leave"})
  const leaveTable=page.locator(".business-native-list")
  await leaveTable.waitFor({state:"visible"})
  assert.equal(await page.locator(".business-native-list-toolbar").count(),0,
    "React leave table does not duplicate a toolbar inside the card")
  assert.equal(await page.locator(".business-context-search").count(),1)
  assert.equal(await page.locator(".business-context-tools-host").getByRole("button",{name:"发起请假"}).isVisible(),true)
  assert.equal(await leaveTable.locator('th select[aria-label="筛选状态"]').count(),1,
    "React leave status filter must reside in its heading")
  await page.locator(".business-context-tools-host").getByRole("button",{name:"发起请假"}).click()
  await page.getByRole("dialog",{name:/发起请假/}).waitFor({state:"visible"})
  await page.getByRole("dialog",{name:/发起请假/}).getByRole("button",{name:"取消"}).click()

  // Purchase orders: a real, flat eight-column table. PMC creates the purchase
  // document; this page must not manufacture a separate "new purchase" path.
  activeFeature="purchase/purchase"
  await page.evaluate(()=>{location.hash="#/departments/purchase/purchase"})
  const purchaseBoard=page.locator(".proc-purchase-board")
  await purchaseBoard.waitFor({state:"visible",timeout:12000})
  const purchaseSelect=purchaseBoard.getByRole("combobox",{name:/筛选审批状态/})
  await purchaseSelect.waitFor({state:"attached"})
  assert.equal(await page.locator(".business-context-status").count(),0,
    "Procurement status filters live in their table heading, not the feature band")
  assert.equal(await page.locator(".business-context-create").count(),0,
    "Procurement purchase document creation remains with PMC; do not invent a duplicate button")
  const purchaseLayout=await purchaseBoard.evaluate(board=>{
    const table=board.querySelector(".proc-order-table")
    const heads=Array.from(table?.querySelectorAll("thead th")??[])
    const select=board.querySelector("[data-purchase-status-filter]")
    const header=select?.closest("th")
    const control=select?.closest(".sales-order-status-control")
    const icon=control?.querySelector(".sales-order-status-caret")
    const footer=board.querySelector(".proc-board-footer")
    const content=board.querySelector(".proc-board-content")
    const body=document.querySelector(".business-page-body")
    if(!table||!select||!header||!control||!icon||!footer||!content||!body)return null
    const th=header.getBoundingClientRect(),ct=control.getBoundingClientRect()
    const action=board.querySelector(".proc-order-row .proc-actions")
    const actionTitle=heads.at(-1)?.getBoundingClientRect()
    const bg=getComputedStyle(body),cbg=getComputedStyle(content)
    const allBadges=[...board.querySelectorAll(".proc-order-row .proc-status")]
    return {
      columns:heads.length,
      statusColumn:heads.indexOf(header),
      filterAligned:Math.abs((th.top+th.bottom-ct.top-ct.bottom)/2)<5,
      nativeFilter:select.parentElement===control&&icon.getBoundingClientRect().width>=13,
      headingColor:heads.every(el=>getComputedStyle(el).backgroundColor==="rgb(244, 244, 239)"),
      badgeColor:allBadges.every(el=>getComputedStyle(el).backgroundColor==="rgb(251, 252, 248)"),
      actionAligned:!action||!actionTitle||Math.abs(actionTitle.left+12-action.getBoundingClientRect().left)<5,
      flatBody:bg.backgroundColor==="rgba(0, 0, 0, 0)"&&bg.borderTopWidth==="0px",
      flatContent:cbg.backgroundColor==="rgba(0, 0, 0, 0)"&&cbg.borderTopWidth==="0px",
      duplicateHeadingHidden:getComputedStyle(board.querySelector(".proc-board-heading")).display==="none",
      metricsHidden:getComputedStyle(board.querySelector(".proc-board-metrics")).display==="none",
      duplicateFiltersHidden:getComputedStyle(board.querySelector(".proc-board-filters")).display==="none",
      footerAttached:Math.abs(footer.getBoundingClientRect().top-table.getBoundingClientRect().bottom)<3,
      naturalHeight:board.getBoundingClientRect().height<table.getBoundingClientRect().height+100,
      noHorizontalPageOverflow:document.documentElement.scrollWidth<=innerWidth+4
    }
  })
  assert.ok(purchaseLayout,"Procurement list must have a native eight-column table")
  assert.equal(purchaseLayout.columns,8,"Do not remove procurement business data columns")
  assert.equal(purchaseLayout.statusColumn,5,"The procurement filter belongs inside the approval status column")
  for(const [key,value] of Object.entries(purchaseLayout)){
    if(typeof value==="boolean")assert.equal(value,true,"Procurement "+key+": "+JSON.stringify(purchaseLayout))
  }
  const purchaseRows=await purchaseBoard.locator(".proc-order-row:visible").count()
  assert.ok(await purchaseSelect.locator("option").count()>1,"Purchase status menu is available without purchase records")
  await purchaseSelect.selectOption({index:1})
  await page.waitForTimeout(80)
  assert.ok(await purchaseBoard.locator(".proc-order-row:visible").count()<=purchaseRows,
    "Purchase status filter changes real order visibility")
  assert.equal(await purchaseBoard.locator(".sales-order-status-control").evaluate(el=>getComputedStyle(el).backgroundColor),
    "rgb(251, 252, 248)","Selected purchase status uses #FBFCF8")
  await purchaseSelect.selectOption("")
  await page.waitForTimeout(80)
  assert.equal(await purchaseBoard.locator(".proc-order-row:visible").count(),purchaseRows)
  const purchaseSearch=page.locator(".business-context-search input")
  await purchaseSearch.fill("__no_matching_purchase_record__")
  await page.waitForTimeout(80)
  assert.equal(await purchaseBoard.locator(".proc-order-row:visible").count(),0,
    "Top-right purchase search filters the real purchase rows")
  assert.equal((await purchaseBoard.locator(".proc-order-count").textContent())?.trim(),"0",
    "Purchase footer shows the filtered record count")
  await purchaseSearch.fill("")
  await page.waitForTimeout(80)
  await page.screenshot({path:"test-results/purchase-orders-flat-ledger.png",fullPage:false})
  console.log("PURCHASE FLAT LEDGER CHECK",JSON.stringify({purchaseRows,purchaseLayout}))

  // Sales order review and history reuse the compact ledger, but have different column counts.
  for(const [feature,columns,statusColumn] of [
    ["orderReview",5,3],["orderHistory",6,4]
  ]){
    activeFeature="sales/"+feature
    await page.evaluate(name=>{location.hash="#/departments/sales/"+name},feature)
    const panel=page.locator(`.native-business .biz-order-panel[data-order-panel="${feature}"]`)
    await panel.waitFor({state:"visible",timeout:12000})
    const filter=panel.locator("[data-sales-order-status-filter]")
    await filter.waitFor({state:"attached"})
    assert.equal(await page.locator(".business-context-status").count(),0,
      feature+" must not duplicate status filters in the feature band")
    const audit=await panel.evaluate(element=>{
      const table=element.querySelector(".op-table")
      const headers=Array.from(table?.querySelectorAll("thead th")??[])
      const select=element.querySelector("[data-sales-order-status-filter]")
      const control=select?.closest(".sales-order-status-control")
      const header=select?.closest("th")
      const rows=Array.from(table?.querySelectorAll("tbody tr")??[])
      const badge=element.querySelector(".op-badge")
      const actions=element.querySelector(".op-row-actions")
      const body=document.querySelector(".business-page-body")
      const footer=element.querySelector(".biz-order-footer")
      if(!table||!select||!control||!header||!body||!footer)return null
      const h=header.getBoundingClientRect(),t=control.getBoundingClientRect()
      const actionTitle=headers.at(-1)
      const actionBox=actions?.getBoundingClientRect()
      const footerBox=footer.getBoundingClientRect()
      const tableBox=table.getBoundingClientRect()
      const style=getComputedStyle(body)
      return {
        columnCount:headers.length,
        headerIndex:headers.indexOf(header),
        filterAligned:Math.abs((h.top+h.bottom)/2-(t.top+t.bottom)/2)<5,
        dropdownInHeader:select.parentElement===control&&
          control.querySelector(".sales-order-status-caret")?.getBoundingClientRect().width>=13,
        actionsAligned:!actionBox||!actionTitle||Math.abs(
          actionTitle.getBoundingClientRect().left+12-actionBox.left)<5,
        neutralBadge:!badge||getComputedStyle(badge).backgroundColor==="rgb(251, 252, 248)",
        neutralHead:headers.every(th=>getComputedStyle(th).backgroundColor==="rgb(244, 244, 239)"),
        noOuterCard:style.backgroundColor==="rgba(0, 0, 0, 0)"&&style.borderTopWidth==="0px",
        naturalHeight:element.getBoundingClientRect().height<tableBox.height+100,
        footerFollowsRows:Math.abs(footerBox.top-tableBox.bottom)<3,
        toolbarHidden:getComputedStyle(element.querySelector(".biz-order-toolbar")).display==="none",
        noHorizontalOverflow:document.documentElement.scrollWidth<=window.innerWidth+4,
        dataRows:rows.filter(row=>row.classList.contains("biz-order-row")).length
      }
    })
    assert.ok(audit,"Sales "+feature+" must render a flat accessible table")
    assert.equal(audit.columnCount,columns,feature+" preserves its distinct business columns")
    assert.equal(audit.headerIndex,statusColumn,feature+" puts status filter in correct column")
    for(const [key,value] of Object.entries(audit)){
      if(typeof value==="boolean")assert.equal(value,true,feature+" layout check "+key+": "+JSON.stringify(audit))
    }
    const options=await filter.locator("option").count()
    assert.ok(options>1,feature+" filter must expose actual statuses even for empty history")
    const total=await panel.locator(".biz-order-row:visible").count()
    await filter.selectOption({index:1})
    await page.waitForTimeout(90)
    const visible=await panel.locator(".biz-order-row:visible").count()
    assert.ok(visible<=total,feature+" filters rows")
    assert.equal(await panel.locator(".sales-order-status-control").evaluate(el=>getComputedStyle(el).backgroundColor),
      "rgb(251, 252, 248)",feature+" selected filter uses warm-white")
    await filter.selectOption("")
    await page.waitForTimeout(90)
    assert.equal(await panel.locator(".biz-order-row:visible").count(),total,feature+" reset restores rows")
    await page.screenshot({path:`test-results/sales-${feature}-flat-ledger.png`,fullPage:false})
    console.log("SALES "+feature+" FLAT LEDGER CHECK",JSON.stringify({audit,options,total,visible}))
  }

  // PMC non-Gantt visual rules. The APS production scheduling feature is explicitly excluded.
  for(const [feature,panelSelector,expectedCols,statusIndex] of [
    ["kitting",'.biz-order-panel[data-order-panel="kitting"]',6,3],
    ["shift",'.mw-page[data-module-page="shift"]',8,6],
    ["shiftPeople",'.mw-page[data-module-page="shiftPeople"]',6,5],
    ["shiftStats",'.mw-page[data-module-page="shiftStats"]',4,-1],
    ["orderProductStats",'.mw-page[data-module-page="orderProductStats"]',5,4],
    ["orderDailyReport",'.mw-page[data-module-page="orderDailyReport"]',4,-1]
  ]){
    activeFeature="pmc/"+feature
    await page.evaluate(feat=>{location.hash="#/departments/pmc/"+feat},feature)
    const panel=page.locator(".native-business "+panelSelector)
    await panel.waitFor({state:"visible",timeout:14000})
    const audit=await panel.evaluate(element=>{
      const isKitting=element.matches('.biz-order-panel[data-order-panel="kitting"]')
      const table=element.querySelector(isKitting?".op-table":".mw-table")
      const headings=[...(table?.querySelectorAll("thead th")??[])]
      const body=document.querySelector(".business-page-body")
      const wrapper=table?.closest(isKitting?".op-table-wrap":".mw-table-scroll")
      const footer=element.querySelector(".biz-order-footer")
      const select=element.querySelector("[data-sales-order-status-filter], [data-pmc-status-filter]")
      const header=select?.closest("th")
      const control=select?.closest(".sales-order-status-control")
      const actions=element.querySelector(isKitting?".op-row-actions":".mw-table tbody tr td:last-child .mw-btn")
      const actionHead=isKitting?headings.at(-1):element.matches('[data-module-page="shift"]')?headings.at(-1):null
      const badge=element.querySelector(".op-badge,.mw-status:not(.mw-alert)")
      if(!table||!wrapper||!body||!headings.length)return null
      const bg=getComputedStyle(body)
      const tb=table.getBoundingClientRect()
      const fb=footer?.getBoundingClientRect()
      const headingBox=header?.getBoundingClientRect(),controlBox=control?.getBoundingClientRect()
      return {
        columns:headings.length,
        statusIndex:header?headings.indexOf(header):-1,
        statusAligned:!select||(!!headingBox&&!!controlBox&&
          Math.abs((headingBox.top+headingBox.bottom-controlBox.top-controlBox.bottom)/2)<5),
        filterIcon:!select||Boolean(control?.querySelector(".sales-order-status-caret")?.getBoundingClientRect().width>=13),
        actionAligned:!actionHead||!actions||Math.abs(
          actionHead.getBoundingClientRect().left+12-actions.getBoundingClientRect().left)<5,
        neutralBadge:!badge||getComputedStyle(badge).backgroundColor==="rgb(251, 252, 248)",
        headerWarm:headings.every(th=>getComputedStyle(th).backgroundColor==="rgb(244, 244, 239)"),
        whiteTable:getComputedStyle(table).backgroundColor==="rgb(255, 255, 255)",
        flatBody:bg.borderTopWidth==="0px"&&bg.backgroundColor==="rgba(0, 0, 0, 0)",
        flatWrapper:getComputedStyle(wrapper).borderTopWidth==="0px"&&getComputedStyle(wrapper).borderTopLeftRadius==="0px",
        naturalHeight:element.getBoundingClientRect().height<tb.height+(
          isKitting?95:element.matches('[data-module-page="shiftStats"]')?205:130
        ),
        statsCompact:!element.matches('[data-module-page="shiftStats"]')||(()=>{
          const metrics=element.querySelector(".mw-metrics")
          return Boolean(metrics)&&metrics.getBoundingClientRect().height<=105&&
            getComputedStyle(metrics).borderTopWidth==="0px"
        })(),
        footerAttached:!footer||Math.abs(fb.top-tb.bottom)<3,
        noPageOverflow:document.documentElement.scrollWidth<=innerWidth+4
      }
    })
    assert.ok(audit,"PMC "+feature+" table must render as flat business data")
    assert.equal(audit.columns,expectedCols,"PMC "+feature+" must retain all business columns")
    assert.equal(audit.statusIndex,statusIndex,"PMC "+feature+" uses the correct status heading")
    for(const [name,ok] of Object.entries(audit)){
      if(typeof ok==="boolean")assert.equal(ok,true,"PMC "+feature+" visual "+name+": "+JSON.stringify(audit))
    }
    const headerFilter=panel.locator("[data-sales-order-status-filter], [data-pmc-status-filter]")
    assert.equal(await page.locator(".business-context-status").count(),0,
      "PMC "+feature+" must not have a duplicated status toolbar")
    if(statusIndex>=0){
      await headerFilter.waitFor({state:"attached"})
      assert.ok(await headerFilter.locator("option").count()>1,"PMC "+feature+" has status choices")
      const originalRows=await panel.locator("tbody tr[data-order-status]:visible").count()
      await headerFilter.selectOption({index:1})
      await page.waitForTimeout(80)
      assert.ok(await panel.locator("tbody tr[data-order-status]:visible").count()<=originalRows,
        "PMC "+feature+" status select filters real records")
      assert.equal(await panel.locator(".sales-order-status-control").evaluate(el=>getComputedStyle(el).backgroundColor),
        "rgb(251, 252, 248)","PMC "+feature+" uses warm-white active status")
      await headerFilter.selectOption("")
    }else{
      assert.equal(await headerFilter.count(),0,"PMC "+feature+" does not invent a status filter")
    }
    if(feature==="shift"){
      const topRight=page.getByRole("button",{name:"安排岗位班次"})
      assert.equal(await topRight.isVisible(),true,"PMC shift creation lives in the feature band")
      assert.equal(await panel.locator('[data-module-action="form:roster"]').isVisible(),false,
        "PMC shift does not duplicate the create action inside its table")
      await topRight.click()
      const dialog=page.locator(".mw-modal")
      await dialog.waitFor({state:"visible"})
      assert.ok((await dialog.textContent())?.includes("产线岗位排班"),"Existing roster modal remains functional")
      await dialog.locator('[data-module-action="closeModal"]').last().click()
      await dialog.waitFor({state:"hidden"})
    }
    if(feature==="kitting"){
      const replenish=page.getByRole("button",{name:"手动补货采购"})
      assert.equal(await replenish.isVisible(),true,"PMC manual replenishment lives in the feature band")
      assert.equal(await panel.locator('[data-proc-action="newDirectPurchase"]').isVisible(),false,
        "PMC manual replenishment has no duplicate toolbar button")
      await replenish.click()
      const purchaseModal=page.locator(".proc-modal")
      await purchaseModal.waitFor({state:"visible"})
      assert.ok((await purchaseModal.textContent())?.includes("直接新建补货采购单"),
        "Top-right PMC replenishment opens its existing purchase form")
      await purchaseModal.locator('[data-proc-action="close"]').first().click()
      await purchaseModal.waitFor({state:"hidden"})
    }
    if(feature==="shiftStats"){
      assert.equal(await panel.locator(".mw-metric").count(),4,"All shift facts remain available")
      const stats=await panel.locator(".mw-metrics").evaluate(el=>({
        flat:getComputedStyle(el).borderTopWidth==="0px",
        neutral:getComputedStyle(el).backgroundColor==="rgb(251, 252, 248)"
      }))
      assert.ok(stats.flat&&stats.neutral,"PMC statistics use a single flat line instead of metric cards")
    }
    await page.screenshot({path:"test-results/pmc-"+feature+"-flat-ledger.png",fullPage:false})
    console.log("PMC NON-GANTT CHECK",JSON.stringify({feature,...audit}))
  }

  // Exercise an actual write through the original MES engine and shared workspace.
  activeFeature="sales/orders"
  await page.evaluate(()=>{location.hash="#/departments/sales/orders"})
  await page.locator(".native-business .legacy-root").waitFor({state:"visible"})
  // Search/status live in the feature band; the old duplicated stats rail and filter fields stay hidden.
  const salesPanel=page.locator('.native-business .biz-order-panel[data-order-panel="orders"]')
  await salesPanel.waitFor({state:"visible"})
  assert.equal(await salesPanel.locator(".biz-order-stats").isVisible(),false,"Duplicate status statistics rail is hidden")
  assert.equal(await salesPanel.locator(".biz-order-fold").isVisible(),false,"Obsolete statistics fold control is hidden")
  assert.equal(await salesPanel.locator(".biz-order-toolbar [data-op-action='newOrder']").count(),1,"Existing MES creation handler remains in the DOM")
  const contextTools=page.locator(".business-context-tools")
  await contextTools.waitFor({state:"visible"})
  const contextSearch=contextTools.locator(".business-context-search input")
  assert.equal(await contextSearch.isVisible(),true,"Context search stays visible in the feature band")
  assert.equal(await salesPanel.locator(".biz-order-search").isVisible(),false,"Legacy duplicate search is hidden")
  assert.equal(await salesPanel.locator(".biz-order-status").isVisible(),false,"Legacy duplicate status select is hidden")
  assert.equal(await salesPanel.locator("[data-op-action='newOrder']").isVisible(),false,"Old in-table creation button is hidden")
  const topRightCreate=contextTools.getByRole("button",{name:"新建销售订单"})
  assert.equal(await topRightCreate.isVisible(),true,"Create action is visible in the upper-right feature band")
  const salesGeometry=await page.evaluate(()=>{
    const feature=document.querySelector(".feature-band").getBoundingClientRect()
    const button=document.querySelector(".business-context-create").getBoundingClientRect()
    const panel=document.querySelector('.biz-order-panel[data-order-panel="orders"]').getBoundingClientRect()
    const table=document.querySelector('.biz-order-panel[data-order-panel="orders"] .op-table').getBoundingClientRect()
    const footer=document.querySelector('.biz-order-panel[data-order-panel="orders"] .biz-order-footer').getBoundingClientRect()
    const body=document.querySelector(".business-page-body")
    const style=getComputedStyle(body)
    return {
      buttonInBand:button.top>=feature.top&&button.bottom<=feature.bottom,
      buttonAboveTable:button.bottom<table.top,
      noPanelCard:style.borderTopWidth==="0px"&&style.backgroundColor==="rgba(0, 0, 0, 0)",
      tableImmediatelyAboveFooter:Math.abs(table.bottom-footer.top)<3,
      noTallEmptyArea:panel.height<table.height+100,
      noPageOverflow:document.documentElement.scrollWidth<=window.innerWidth+4
    }
  })
  assert.ok(Object.values(salesGeometry).every(Boolean),"Sales uses a flat, content-height ledger with creation in the feature band: "+JSON.stringify(salesGeometry))
  await contextSearch.fill("INVALID-NO-MATCH")
  await page.waitForTimeout(80)
  assert.equal(await salesPanel.locator(".biz-order-row:visible").count(),0,"Feature-band search filters actual order rows")
  await contextSearch.fill("")
  await page.waitForTimeout(80)
  assert.equal(await contextTools.locator(".business-context-status").count(),0,
    "Status controls are removed from the right-hand feature band on sales orders")
  const headingFilter=salesPanel.getByRole("combobox",{name:/筛选流程状态/})
  await headingFilter.waitFor({state:"attached"})
  const filterGeometry=await salesPanel.evaluate(panel=>{
    const heading=panel.querySelector("th.sales-order-status-heading")
    const control=heading?.querySelector(".sales-order-status-control")
    const select=heading?.querySelector("[data-sales-order-status-filter]")
    const icon=heading?.querySelector(".sales-order-status-caret")
    const actionHeading=panel.querySelector(".op-table thead th:last-child")
    const actionCell=panel.querySelector(".op-table tbody tr:first-child td:last-child .op-row-actions")
    const cols=panel.querySelectorAll(".op-table thead th")
    const statusBadge=panel.querySelector(".op-table .op-badge")
    if(!heading||!control||!select||!icon||!actionHeading||!actionCell||!statusBadge)return null
    const h=heading.getBoundingClientRect(),t=control.getBoundingClientRect()
    const actionX=actionHeading.getBoundingClientRect().left+12
    return {
      aligned:Math.abs((h.top+h.bottom)/2-(t.top+t.bottom)/2)<5,
      inColumn:t.left>=h.left&&t.right<=h.right,
      actualNativeControl:select.parentElement===control&&getComputedStyle(select).cursor==="pointer",
      arrowVisible:icon.getBoundingClientRect().width>=13,
      compactStatusGap:cols[3].getBoundingClientRect().left-cols[2].getBoundingClientRect().left<245,
      actionsAlign:Math.abs(actionCell.getBoundingClientRect().left-actionX)<5,
      neutralBadge:getComputedStyle(statusBadge).backgroundColor==="rgb(251, 252, 248)"
    }
  })
  assert.ok(filterGeometry&&Object.values(filterGeometry).every(Boolean),
    "Real sales header filter, compact column widths, action alignment and #FBFCF8 badges: "+JSON.stringify(filterGeometry))
  const totalSales=await salesPanel.locator(".biz-order-row").count()
  const options=await headingFilter.locator("option").count()
  assert.ok(options>1,"Real order statuses are options inside the flow-status header")
  await headingFilter.selectOption({index:1})
  await page.waitForTimeout(80)
  const filteredSales=await salesPanel.locator(".biz-order-row:visible").count()
  assert.ok(filteredSales>0&&filteredSales<=totalSales,"Native header select filters the actual rows")
  const activeStyle=await salesPanel.locator(".sales-order-status-control").evaluate(el=>({
    active:el.classList.contains("is-active"),
    background:getComputedStyle(el).backgroundColor
  }))
  assert.equal(activeStyle.active,true,"Filter header shows its active selection")
  assert.equal(activeStyle.background,"rgb(251, 252, 248)","Active status uses #FBFCF8")
  await headingFilter.selectOption("")
  await page.waitForTimeout(80)
  assert.equal(await salesPanel.locator(".biz-order-row:visible").count(),totalSales,
    "All statuses restores the complete order list")
  await page.screenshot({path:"test-results/sales-orders-table-toolbar.png",fullPage:false})
  console.log("SALES STATUS HEADER CHECK",JSON.stringify({totalSales,filteredSales,options,filterGeometry}))
  const create=topRightCreate
  await create.waitFor({state:"visible",timeout:10000})
  assert.equal(await create.getAttribute("data-slot"),"button","Top-right creation action uses shadcn Button")
  assert.ok(await page.locator(".native-business [data-slot=table]").count()>0,"MES tables should be React shadcn Table elements")
  if(await create.count()){
    await create.click()
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
  // A current step must track the bottleneck; completed intake/review steps may open order content.
  assert.equal(await flow.locator('[data-journey-tab]').count(),0)
  const orderHeaderControls=await flow.evaluate(root=>[0,1].map(index=>{
    const card=root.querySelector('.journey-card[data-journey-step="'+index+'"]')
    return {
      state:card?.classList.contains('is-current')?'current':
        card?.classList.contains('is-done')?'done':'other',
      track:Boolean(card?.querySelector('[data-flow-track]')),
      content:Boolean(card?.querySelector('[data-flow-order-content]'))
    }
  }))
  for(const [index,control] of orderHeaderControls.entries()){
    if(control.state==="current"){
      assert.equal(control.track,true,"Current order step "+index+" must offer tracking")
      assert.equal(control.content,false,"Order content must not replace its tracking button")
    }
    if(control.state==="done")assert.equal(control.content,true,"Completed order step "+index+" shows order content")
  }
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
  assert.equal(warehouseLayout.actionInside,false,"Original batch action is hidden in the flat ledger")
  const registerBatch=page.locator("#business-context-tools-host").getByRole("button",{name:"登记批次"})
  assert.equal(await registerBatch.isVisible(),true,"Register batch action must appear in the top-right band")
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
