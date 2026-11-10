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
      await page.locator(".department-tile").first().waitFor({timeout:6500})
      if(response?.ok()&&await page.locator(".department-tile").count()===12){loaded=true;break}
    }catch{}
    await page.waitForTimeout(3000)
  }
  assert.ok(loaded,"Published GitHub Pages must load React and all 12 navigation tiles")
  assert.ok((await page.title()).includes("工厂管理系统"))
  assert.equal(await page.locator("svg.svg-bank[data-icon-library=lucide] symbol[data-lucide-icon]").count(),77)
  await page.locator(".overview-kpi-grid").waitFor()
  assert.equal(await page.locator(".overview-kpi-card").count(),4,"Published cockpit has four operational KPIs")
  assert.equal(await page.locator(".overview-gantt-panel").count(),1,"Published cockpit has production Gantt")
  assert.equal(await page.locator(".overview-donut-panel").count(),1,"Published cockpit has order status chart")
  assert.equal(await page.locator(".overview-alerts-panel").count(),1,"Published cockpit has real warnings")
  assert.equal(await page.locator(".overview-agent-card").count(),5,"Published cockpit includes five animal Agent roles")
  await page.screenshot({path:"test-results/live-overview-cockpit.png",fullPage:true})
  await page.locator(".department-tile").filter({hasText:"仓库 / 物流部"}).click()
  assert.equal(await page.locator(".feature-tile").count(),8,"Published warehouse department has 8 functions")
  // Move off the clicked tile and allow its CSS background transition to finish.
  await page.mouse.move(780,90)
  await page.waitForFunction(()=>{
    const selected=document.querySelector('.department-tile[aria-current="page"]')
    return selected&&getComputedStyle(selected).backgroundColor==="rgb(180, 192, 182)"
  },null,{timeout:5000})
  const selectedStyle=await page.locator('.department-tile[aria-current="page"]').evaluate(el=>{
    const style=getComputedStyle(el)
    return {background:style.backgroundColor,color:style.color,shadow:style.boxShadow}
  })
  assert.equal(selectedStyle.background,"rgb(180, 192, 182)","Selected department uses matte gray-sage, not bright saturated green")
  assert.equal(selectedStyle.color,"rgb(47, 72, 54)","Selected department uses dark ink, not glowing white")
  assert.ok(!selectedStyle.shadow.includes("inset 3px"),"Selected department must never have a left-side stripe")
  await page.screenshot({path:"test-results/live-sidebar-active.png",fullPage:true})
  await page.getByRole("button",{name:"查看仓库 / 物流部介绍"}).click()
  await page.locator('[data-slot="popover-content"]').waitFor({state:"visible"})
  await page.getByRole("button",{name:"查看仓库 / 物流部介绍"}).click()
  await page.getByRole("tab",{name:/部门花名簿/}).click()
  await page.getByText("办公位置",{exact:true}).waitFor()
  await page.getByRole("tab",{name:/业务功能/}).click()
  await page.locator(".feature-tile:not([disabled])").first().click()
  await page.locator(".native-business .legacy-root").waitFor({state:"visible",timeout:15000})
  assert.equal(await page.locator("iframe").count(),0,"Production business pages must not use iframe")
  assert.deepEqual(errors,[],"Published website must not throw uncaught JavaScript errors")
  await page.screenshot({path:"test-results/live-github-pages.png",fullPage:true})
  // Real published-order modal check: a generic page screenshot cannot verify flow controls.
  await page.evaluate(()=>{window.location.hash="#/departments/sales/orders"})
  const orderButton=page.locator('.native-business [data-op-action="detailFlow"]').first()
  await orderButton.waitFor({state:"visible",timeout:20000})
  await orderButton.click()
  const dialog=page.locator(".journey-dialog")
  await dialog.waitFor({state:"visible",timeout:10000})
  // Confirm live order modal defaults to the flow tab and keeps order information separate.
  const flowTab=dialog.locator('[data-journey-tab="flow"]')
  const orderTab=dialog.locator('[data-journey-tab="order"]')
  const flowPanel=dialog.locator('[data-journey-panel="flow"]')
  const orderPanel=dialog.locator('[data-journey-panel="order"]')
  assert.equal(await dialog.locator('[role="tablist"] [role="tab"]').count(),2)
  assert.equal(await dialog.locator(".journey-toolbar,.journey-range").count(),0,"Redundant status and endpoint rows are removed")
  assert.equal(await flowPanel.locator(".journey-section-head").count(),0,"Flow chart has no duplicate header and explanatory text")
  const tabAppearance=await flowTab.evaluate(el=>{
    const css=getComputedStyle(el),activeLine=getComputedStyle(el,"::after"),tablist=getComputedStyle(el.parentElement)
    return {background:css.backgroundColor,borderWidth:css.borderTopWidth,underline:activeLine.backgroundColor,barBorder:tablist.borderBottomWidth}
  })
  assert.equal(tabAppearance.background,"rgba(0, 0, 0, 0)","Tabs have no pill background")
  assert.equal(tabAppearance.borderWidth,"0px","Tabs have no button border")
  assert.equal(tabAppearance.barBorder,"1px","Tab row has a subtle divider")
  assert.notEqual(tabAppearance.underline,"rgba(0, 0, 0, 0)","Active tab has a thin underline")

  assert.equal(await flowTab.getAttribute("aria-selected"),"true")
  assert.equal(await orderTab.getAttribute("aria-selected"),"false")
  assert.ok(await flowPanel.isVisible(),"Flow tab is visible by default")
  assert.equal(await orderPanel.isVisible(),false,"Order content is hidden by default")
  await dialog.evaluate(el=>{el.scrollTop=0})
  await page.screenshot({path:"test-results/live-flow-default-tab.png"})
  await orderTab.click()
  assert.equal(await flowPanel.isVisible(),false,"Flow chart hides on order tab")
  assert.ok(await orderPanel.isVisible(),"Order content has its own tab")
  assert.ok((await orderPanel.textContent())?.includes("订单编号"),"Order fields remain available")
  await page.screenshot({path:"test-results/live-order-content-tab.png"})
  await flowTab.click()
  assert.ok(await flowPanel.isVisible(),"Switching back restores the original flow")
  assert.equal(await orderPanel.isVisible(),false)

  const currentButton=dialog.locator(".journey-card.is-current [data-flow-track]")
  await currentButton.waitFor({state:"visible",timeout:10000})
  await currentButton.scrollIntoViewIfNeeded()
  await page.waitForTimeout(1900)
  await page.screenshot({path:"test-results/live-current-step-dialog.png"})
  await currentButton.screenshot({path:"test-results/live-current-step-button.png"})
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

  assert.equal((await currentButton.textContent())?.trim(),"跟踪当前环节 →",
    "Running card has one combined '跟踪当前环节' action")
  assert.equal(await dialog.locator(".journey-card.is-current .journey-state").count(),0,
    "Current-step badge must not duplicate tracking button")
  assert.equal(await dialog.locator('[data-flow-track]').count(),1,
    "There must be one tracking action in this journey")
  assert.equal(await dialog.getByText("跟踪卡点",{exact:false}).count(),0,
    "Outdated tracking button must be absent")
  await page.setViewportSize({width:390,height:844})
  await currentButton.scrollIntoViewIfNeeded()
  await page.screenshot({path:"test-results/live-current-step-mobile.png"})
  await page.setViewportSize({width:1440,height:900})
  await currentButton.click()
  await dialog.waitFor({state:"detached",timeout:10000})
  assert.match(new URL(page.url()).hash,new RegExp("^#/departments/[a-z]+(?:/[a-zA-Z]+)?$"),
    "Tracking action navigates to a department route")
  console.log("PASS: live current-step button visible on desktop/mobile, no duplicate badge, and click navigates.")

  console.log("PASS: published GitHub Pages, Vite assets, React nav, Lucide, shadcn roster and native MES business.")
}catch(error){failed=true;console.error(error)}
finally{await browser?.close()}
if(failed)process.exit(1)
