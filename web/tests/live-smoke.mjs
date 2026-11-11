import assert from "node:assert/strict"
import { mkdir } from "node:fs/promises"
import { chromium } from "playwright"

const url=process.env.FACTORY_URL||"https://lee7017.github.io/factory/"
let browser,failed=false
try{
  await mkdir("test-results",{recursive:true})
  browser=await chromium.launch({headless:true,args:["--no-sandbox"]})
  const page=await browser.newPage({viewport:{width:1440,height:900}})
  const errors=[]
  page.on("pageerror",err=>errors.push(err.stack??err.message))
  let loaded=false
  for(let attempt=0;attempt<15;attempt++){
    try{
      const response=await page.goto(url,{waitUntil:"networkidle",timeout:20000})
      await page.locator(".department-band-button").first().waitFor({timeout:6500})
      if(response?.ok()&&await page.locator(".department-band-button").count()===9){loaded=true;break}
    }catch{}
    await page.waitForTimeout(3000)
  }
  assert.ok(loaded,"Published GitHub Pages must load React and all 9 operating departments in the horizontal band")
  assert.ok((await page.title()).includes("工厂管理系统"))
  assert.equal(await page.locator("svg.svg-bank[data-icon-library=lucide] symbol[data-lucide-icon]").count(),77)
  assert.equal(await page.locator(".system-rail").count(),1,"Published site uses one compact system rail")
  assert.equal(await page.locator(".shell-sidebar,.shell-topbar,.department-tile").count(),0,
    "Old department tile sidebar and topbar must stay removed")
  const publishedShell=await page.evaluate(()=>{
    const rail=document.querySelector(".system-rail")?.getBoundingClientRect()
    const dept=document.querySelector(".department-band-shell")?.getBoundingClientRect()
    return {
      railWidth:Math.round(rail?.width??0),
      departmentHeight:Math.round(dept?.height??0),
      overflow:document.documentElement.scrollWidth>innerWidth+4
    }
  })
  assert.equal(publishedShell.railWidth,64)
  assert.equal(publishedShell.departmentHeight,46)
  assert.equal(publishedShell.overflow,false)

  await page.locator(".overview-kpi-grid").waitFor()
  assert.equal(await page.locator(".overview-kpi-card").count(),4,"Published cockpit has four operational KPIs")
  assert.equal(await page.locator(".overview-gantt-panel").count(),1,"Published cockpit has production Gantt")
  const ganttCollisions=await page.locator(".overview-gantt-data").evaluateAll(rows=>{
    const clashes=[]
    for(const row of rows){
      const bars=Array.from(row.querySelectorAll(".overview-gantt-bar"))
      for(let i=0;i<bars.length;i++)for(let j=i+1;j<bars.length;j++){
        const a=bars[i].getBoundingClientRect(),b=bars[j].getBoundingClientRect()
        if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>0.5&&
          Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>0.5)
          clashes.push([bars[i].getAttribute("aria-label"),bars[j].getAttribute("aria-label")])
      }
    }
    return clashes
  })
  assert.deepEqual(ganttCollisions,[],"Live overview task bars must not physically overlap")
  assert.equal(await page.locator(".overview-gantt-legend span").count(),6,
    "Live overview must show the same six operation colors as PMC")
  assert.equal(await page.locator(".overview-donut-panel").count(),1,"Published cockpit has order status chart")
  assert.equal(await page.locator(".overview-alerts-panel").count(),1,"Published cockpit has real warnings")
  assert.equal(await page.locator(".overview-agent-card").count(),5,"Published cockpit includes five animal Agent roles")
  await page.screenshot({path:"test-results/live-overview-cockpit.png",fullPage:true})

  await page.locator(".department-band-button").filter({hasText:"仓库"}).click()
  await page.locator(".department-overview-panel").waitFor({state:"visible",timeout:10000})
  assert.equal(await page.locator(".feature-band-button").count(),9,
    "Warehouse has overview plus eight real functions in the horizontal feature band")
  const navStyle=await page.evaluate(()=>{
    const dept=document.querySelector('.department-band-button[aria-current="page"]')
    const feature=document.querySelector(".feature-band")
    const active=document.querySelector(".feature-band-button.active")
    return {
      department:(dept?.textContent??"").trim(),
      departmentUnderline:dept?getComputedStyle(dept,"::after").backgroundColor:"",
      featureHeight:Math.round(feature?.getBoundingClientRect().height??0),
      featureActive:(active?.textContent??"").trim(),
      featureUnderline:active?getComputedStyle(active,"::after").backgroundColor:"",
      overflow:document.documentElement.scrollWidth>innerWidth+4
    }
  })
  assert.equal(navStyle.department,"仓库")
  assert.equal(navStyle.departmentUnderline,"rgb(0, 151, 63)")
  assert.equal(navStyle.featureHeight,48)
  assert.equal(navStyle.featureActive,"部门总览")
  assert.equal(navStyle.featureUnderline,"rgb(0, 151, 63)")
  assert.equal(navStyle.overflow,false)
  await page.screenshot({path:"test-results/live-horizontal-department-band.png",fullPage:true})

  await page.getByText("办公位置",{exact:true}).waitFor()
  await page.screenshot({path:"test-results/live-warehouse-roster.png",fullPage:true})

  await page.evaluate(()=>{window.location.hash="#/departments/warehouse/warehouseOutbound"})
  await page.locator('.native-business [data-module-page="warehouseOutbound"]').waitFor({state:"visible",timeout:18000})
  await page.locator(".business-context-tools").waitFor({state:"visible",timeout:10000})
  const warehouseLayout=await page.evaluate(()=>{
    const feature=document.querySelector(".feature-band")?.getBoundingClientRect()
    const tools=document.querySelector(".business-context-tools")?.getBoundingClientRect()
    const frame=document.querySelector(".business-page-frame")?.getBoundingClientRect()
    return {
      featureHeight:Math.round(feature?.height??0),
      toolsHeight:Math.round(tools?.height??0),
      frameWidth:Math.round(frame?.width??0),
      workspaceWidth:innerWidth-64,
      overflow:document.documentElement.scrollWidth>innerWidth+4,
      active:(document.querySelector('.feature-band-button[aria-current="page"]')?.textContent??"").trim()
    }
  })
  assert.equal(warehouseLayout.featureHeight,48,"Live feature navigation stays one row")
  assert.equal(warehouseLayout.toolsHeight,48,"Context tools remain vertically centered in the same row")
  assert.equal(warehouseLayout.active,"成品出库")
  assert.ok(warehouseLayout.frameWidth>warehouseLayout.workspaceWidth*.88,
    "Live warehouse workbench uses the available width")
  assert.equal(warehouseLayout.overflow,false)
  assert.equal(await page.locator("iframe").count(),0,"Production business pages must not use iframe")
  assert.deepEqual(errors,[],"Published website must not throw uncaught JavaScript errors")
  await page.screenshot({path:"test-results/live-warehouse-outbound.png",fullPage:true})

  await page.evaluate(()=>{window.location.hash="#/departments/pmc/kitting"})
  await page.locator('.native-business .biz-order-panel[data-order-panel="kitting"]').waitFor({state:"visible",timeout:18000})
  assert.equal(await page.locator('.native-business .proc-linked-panel').count(),0,"No separate PR table on PMC")
  assert.equal(await page.locator('.native-business [data-proc-action="newDirectPurchase"]').count(),1)
  await page.screenshot({path:"test-results/live-pmc-purchase-demand.png"})
  await page.evaluate(()=>{window.location.hash="#/departments/purchase/purchase"})
  await page.locator('.native-business .proc-purchase-board').waitFor({state:"visible",timeout:18000})
  assert.equal(await page.locator('.native-business [data-proc-action="newPurchase"]').count(),0,"No duplicate PO creation in purchasing")
  await page.screenshot({path:"test-results/live-purchase-approval-list.png"})
  assert.equal(await page.locator('.native-business .proc-purchase-board').count(),1,"Purchase screen has independent workbench")
  assert.equal(await page.locator('.native-business .biz-order-panel[data-order-panel="purchase"]').count(),0)
  await page.evaluate(()=>{window.location.hash="#/departments/sales/orders"})
  await page.locator('.native-business .biz-order-panel[data-order-panel="orders"]').waitFor({state:"visible",timeout:15000})
  assert.equal(await page.locator('.native-business .proc-purchase-board').count(),0,"Sales cannot contain procurement workbench")
  await page.screenshot({path:"test-results/live-sales-separated-from-purchasing.png"})

  await page.evaluate(()=>{window.location.hash="#/departments/leadership/approvals"})
  await page.locator('.native-business [data-proc-action="editPolicy"]').waitFor({state:"visible",timeout:18000})
  await page.screenshot({path:"test-results/live-purchase-approval-policy.png"})

  // Real published-order modal check: a generic page screenshot cannot verify flow controls.
  await page.evaluate(()=>{window.location.hash="#/departments/sales/orders"})
  const orderButton=page.locator('.native-business [data-op-action="detailFlow"]').first()
  await orderButton.waitFor({state:"visible",timeout:20000})
  await orderButton.click()
  const dialog=page.locator(".journey-dialog")
  await dialog.waitFor({state:"visible",timeout:10000})
  // Current UX: the first two flow cards expose "订单内容"; there are no order tabs.
  assert.equal(await dialog.locator('[role="tablist"] [role="tab"]').count(),0,"Order flow must not render obsolete tabs")
  assert.equal(await dialog.locator("[data-flow-order-content]").count(),2,
    "Both receiving and review cards provide the order-content action")
  assert.equal(await dialog.locator(".journey-toolbar,.journey-range,.journey-return-overview").count(),0)
  const orderSteps=await dialog.locator(".journey-task").allTextContents()
  assert.equal(orderSteps.length,19,"Order keeps all 19 production and delivery workflow steps")
  assert.equal(orderSteps[0],"接收订单并提交评审")
  assert.equal(orderSteps[1],"订单评审通过")
  assert.ok(orderSteps.includes("配制线清洗执行与复核"))
  assert.ok(orderSteps.includes("包装线清洗执行与复核"))
  assert.ok(orderSteps.indexOf("配制任务完成")<orderSteps.indexOf("配制线清洗执行与复核"))
  assert.ok(orderSteps.indexOf("调机调线执行与复核")<orderSteps.indexOf("包装开工"))
  assert.ok(orderSteps.indexOf("包装任务完成")<orderSteps.indexOf("包装线清洗执行与复核"))
  assert.ok(orderSteps.includes("成品检验判定并放行"))
  assert.ok(!orderSteps.includes("QA 质量放行"))
  assert.equal(await dialog.locator(".journey-step-count,.journey-step-returns").count(),0,
    "No execution/return count badges on workflow cards")
  await dialog.evaluate(el=>{el.scrollTop=0})
  await page.screenshot({path:"test-results/live-flow-no-tabs.png"})
  await dialog.locator("[data-flow-order-content]").first().click()
  const orderDrawer=page.locator(".journey-order-panel")
  await orderDrawer.waitFor({state:"visible",timeout:5000})
  assert.ok((await orderDrawer.textContent())?.includes("订单编号"),"Order fields are available in the right drawer")
  const drawerPosition=await orderDrawer.evaluate(el=>({right:el.getBoundingClientRect().right,width:el.getBoundingClientRect().width,viewport:window.innerWidth}))
  assert.ok(drawerPosition.width<=630&&Math.abs(drawerPosition.right-drawerPosition.viewport)<40,
    "Order content must open at the screen right")
  await page.screenshot({path:"test-results/live-order-content-right-drawer.png"})
  await orderDrawer.locator("[data-flow-order-dismiss]").click()
  await orderDrawer.waitFor({state:"detached",timeout:5000})
  const currentCard=dialog.locator(".journey-card.is-current").first()
  await currentCard.waitFor({state:"visible",timeout:10000})
  await currentCard.scrollIntoViewIfNeeded()
  await page.waitForTimeout(1900)
  await page.screenshot({path:"test-results/live-current-step-dialog.png"})
  await currentCard.screenshot({path:"test-results/live-current-step-card.png"})
  // Verify four 176px cards are visible side-by-side at a typical desktop width.
  await page.setViewportSize({width:1024,height:768})
  const cardLayout=await dialog.locator(".journey-snake-scroll").evaluate(el=>{
    const viewport=el.getBoundingClientRect()
    const cards=Array.from(el.querySelectorAll(".journey-snake-position")).slice(0,4)
    return {
      widths:cards.map(card=>card.getBoundingClientRect().width),
      fullyVisible:cards.every(card=>{
        const bounds=card.getBoundingClientRect()
        return bounds.left>=viewport.left-1&&bounds.right<=viewport.right+1
      })
    }
  })
  assert.equal(cardLayout.widths.length,4,"Flow must have four cards in the first row")
  assert.ok(cardLayout.widths.every(width=>Math.abs(width-176)<1),
    "Card width must be 176px, exactly 20% less than before")
  assert.ok(cardLayout.fullyVisible,"All four cards must fit without horizontal clipping at 1024px")
  await dialog.evaluate(el=>{el.scrollTop=0})
  await page.screenshot({path:"test-results/live-four-cards-1024.png"})
  await page.setViewportSize({width:1440,height:900})

  // Tracking is available only when the order dialog has an explicit next target.
  assert.equal(await dialog.getByText("跟踪卡点",{exact:false}).count(),0)
  await page.setViewportSize({width:390,height:844})
  await currentCard.scrollIntoViewIfNeeded()
  await page.screenshot({path:"test-results/live-current-step-mobile.png"})
  await page.setViewportSize({width:1440,height:900})
  const trackAction=dialog.locator(".journey-card.is-current [data-flow-track]")
  if(await trackAction.count()){
    await trackAction.click()
    await dialog.waitFor({state:"detached",timeout:10000})
    assert.match(new URL(page.url()).hash,new RegExp("^#/departments/[a-z]+(?:/[a-zA-Z]+)?$"))
  }else{
    // A read-only order detail may have no nextOpen: the card still opens its execution history.
    await currentCard.click()
    await orderDrawer.waitFor({state:"visible",timeout:5000})
    assert.ok((await orderDrawer.textContent())?.includes("记录"))
    await orderDrawer.locator("[data-flow-order-dismiss]").click()
    await page.evaluate(()=>window.FactoryFlowUI?.dismiss?.())
  }
  // Validate both paths against real operations/modules in this isolated browser.
  const qcResult=await page.evaluate(()=>{
    const ops=window.FactoryOperations,modules=window.FactoryModules;
    const ids=["SO-2026-1023-018","SO-2026-1106-003"];
    for(const id of ids){
      if(!ops.getOrder(id)||!ops.state.flows[id])throw new Error("Missing order "+id);
      ops.state.flows[id].stage="final_qc";ops.getOrder(id).status="成品待检";
    }
    const pass=modules.ensureFlowInspection(ids[0],"成品");
    modules.handleClick({dataset:{moduleAction:"qc:pass",mid:pass.id}});
    const passedStage=ops.state.flows[ids[0]].stage;
    const passActions=ops.state.flows[ids[0]].audit.map(x=>x.action);
    window.FactoryFlowUI?.dismiss?.();
    const fail=modules.ensureFlowInspection(ids[1],"成品");
    modules.handleClick({dataset:{moduleAction:"qc:fail",mid:fail.id}});
    const failedStage=ops.state.flows[ids[1]].stage;
    const failActions=ops.state.flows[ids[1]].audit.map(x=>x.action);
    window.FactoryFlowUI?.dismiss?.();
    return {passedStage,failedStage,passActions,failActions,passStatus:pass.status,failStatus:fail.status}
  })
  assert.equal(qcResult.passStatus,"合格")
  assert.equal(qcResult.passedStage,"released","Passing final QC releases without another click")
  assert.ok(qcResult.passActions.includes("成品检验合格并放行"))
  assert.equal(qcResult.failStatus,"不合格")
  assert.equal(qcResult.failedStage,"packaging","Failing final QC goes back to packaging")
  assert.ok(qcResult.failActions.some(x=>x.includes("成品不合格")))
  console.log("PASS: current-step tracking, combined order cards, and QC pass/fail transitions.")

  console.log("PASS: published GitHub Pages, Vite assets, React nav, Lucide, shadcn roster and native MES business.")
}catch(error){failed=true;console.error(error)}
finally{await browser?.close()}
if(failed)process.exit(1)
