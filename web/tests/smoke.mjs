import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { mkdir } from "node:fs/promises"
import { chromium } from "playwright"

const base = "http://127.0.0.1:4173/factory/"
const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "preview", "--host", "127.0.0.1", "--port", "4173", "--strictPort"], {
  cwd: process.cwd(), stdio: ["ignore","pipe","pipe"]
})
let browser
let failed = false
async function waitForServer(){
  for(let i=0;i<60;i++){
    try {const res=await fetch(base);if(res.ok)return}catch{}
    await new Promise(resolve=>setTimeout(resolve,500))
  }
  throw new Error("Vite preview server did not start")
}
try {
  await mkdir('test-results',{recursive:true})
  await waitForServer()
  browser=await chromium.launch({headless:true,args:["--no-sandbox"]})
  const page=await browser.newPage({viewport:{width:1440,height:900}, deviceScaleFactor:1})
  const errors=[]
  page.on("pageerror",err=>errors.push(`${err.message}\n${err.stack??""}`))
  await page.goto(base, {waitUntil:"networkidle"})
  await page.locator(".department-tile").first().waitFor()
  assert.equal(await page.locator("svg.svg-bank[data-icon-library=lucide] symbol[data-lucide-icon]").count(),77,"All 77 legacy business icons must be available to React without iframe")
  assert.equal(await page.locator(".department-tile").count(),11,"Homepage + 10 department squares")
  assert.equal(await page.locator(".dashboard-kpis .kpi-card").count(),4,"Overview has four stat cards")
  assert.equal(await page.locator(".overview-kpi-grid").count(),1,"Overview displays the compact KPI row without a redundant heading")
  assert.equal(await page.locator(".overview-gantt-panel").count(),1,"Real Gantt replaces duplicate business links")
  assert.equal(await page.locator(".overview-donut-panel svg").count(),1,"Orders are visualized as donut chart")
  assert.equal(await page.locator(".overview-alerts-panel").count(),1,"Critical alerts are present")
  assert.equal(await page.locator(".overview-agent-card").count(),5,"Five animal Agent roles are shown")
  assert.equal(await page.getByText("工厂业务流程",{exact:true}).count(),0,"No repeated business navigation")
  assert.equal(await page.getByText("部门协同",{exact:true}).count(),0,"No repeated department navigation")
  await page.getByRole("button",{name:"日视图"}).click()
  assert.equal(await page.getByRole("button",{name:"日视图"}).getAttribute("aria-pressed"),"true")
  await page.getByRole("button",{name:"月视图"}).click()
  assert.equal(await page.getByRole("button",{name:"月视图"}).getAttribute("aria-pressed"),"true")
  await page.getByRole("button",{name:"周视图"}).click()
  await page.getByRole("button",{name:"查看小熊管家详情"}).click()
  await page.getByRole("dialog").getByText("当前未连接运行服务",{exact:false}).waitFor()
  await page.keyboard.press("Escape")
  await page.screenshot({path:"test-results/overview.png",fullPage:true})
  await page.locator(".department-tile").filter({hasText:"仓库 / 物流部"}).click()
  await page.locator(".feature-tile").first().waitFor()
  assert.equal(await page.locator(".feature-tile").count(),8,"Warehouse has 8 business cards")
  // Business function cards are dense but still individually readable and clickable.
  const desktopFeatureLayout=await page.locator(".feature-grid").evaluate(grid=>{
    const tiles=[...grid.querySelectorAll(".feature-tile")]
    const columns=getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/).length
    const boxes=tiles.map(el=>el.getBoundingClientRect())
    return {columns,heights:boxes.map(box=>box.height),rowCount:new Set(boxes.map(box=>Math.round(box.top))).size,
      hasDescriptions:tiles.every(el=>Boolean(el.querySelector(".feature-description")?.textContent?.trim())),
      hasTooltips:tiles.every(el=>Boolean(el.getAttribute("title")))}
  })
  assert.equal(desktopFeatureLayout.columns,4,"Desktop shows four business function cards per row")
  assert.equal(desktopFeatureLayout.rowCount,2,"Eight warehouse functions occupy two compact rows")
  assert.ok(desktopFeatureLayout.heights.every(height=>height>=70&&height<=115),
    "Compact business cards must avoid previous 142px empty height: "+JSON.stringify(desktopFeatureLayout))
  assert.ok(desktopFeatureLayout.hasDescriptions&&desktopFeatureLayout.hasTooltips,
    "All feature cards retain a readable description and full text on hover")
  assert.equal(await page.locator(".page-title").count(),0,"Department home should not waste height on title")
  await page.getByRole("button",{name:"查看仓库 / 物流部介绍"}).hover()
  const tooltip=page.locator('[data-slot="popover-content"]')
  await tooltip.waitFor({state:"visible"})
  assert.ok((await tooltip.textContent())?.includes("库存批次"),"Department description in tooltip")
  const box=await tooltip.boundingBox()
  assert.ok(box&&box.width<360&&box.x>=0&&box.x+box.width<=1440,"Tooltip must not clip or overflow")
  await page.getByRole("tab",{name:/部门花名簿/}).click()
  assert.equal(await page.getByRole("tab",{name:/部门花名簿/}).getAttribute("data-state"),"active","Roster tab must be active")
  assert.equal(await page.getByRole("tab",{name:/业务功能/}).getAttribute("data-state"),"inactive","Function tab must be inactive")
  await page.getByText("办公位置",{exact:true}).waitFor()
  const rosterLayout=await page.locator(".roster-grid").evaluate(grid=>{
    const cards=[...grid.querySelectorAll(".person-tile")]
    const rects=cards.map(card=>card.getBoundingClientRect())
    return {columns:getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/).length,
      count:cards.length,heights:rects.map(box=>box.height),
      titles:cards.every(card=>Boolean(card.title)),
      fields:cards.every(card=>Boolean(card.querySelector(".person-meta strong")?.textContent?.trim())&&
        Boolean(card.querySelector(".person-meta span")?.textContent?.trim())),
      overflow:rects.some(box=>box.right>innerWidth+1)}
  })
  assert.equal(rosterLayout.columns,4,"Desktop roster displays four compact employee cards per row")
  assert.ok(rosterLayout.count>0,"Warehouse roster contains employees")
  assert.ok(rosterLayout.heights.every(height=>height>=50&&height<=85),
    "Employee cards are compact rather than full-size tiles: "+JSON.stringify(rosterLayout))
  assert.ok(rosterLayout.fields&&rosterLayout.titles&&!rosterLayout.overflow,
    "Roster preserves names, roles, employee IDs and full hover details")
  await page.locator(".person-tile").first().click()
  await page.getByRole("dialog").getByText("本地演示消息，不会送达其他设备。").waitFor()
  await page.keyboard.press("Escape")

  await page.screenshot({path:"test-results/warehouse-roster.png",fullPage:true})
  await page.getByRole("tab",{name:/业务功能/}).click()
  const first=page.locator(".feature-tile:not([disabled])").first()
  assert.ok(await first.count()>0,"Current employee must have at least one allowed business feature")
  await first.click()
  const native=page.locator(".native-business .legacy-root")
  await native.waitFor({state:"visible"})
  await page.waitForFunction(()=>document.querySelector(".native-business #view")?.textContent?.trim().length>20)
  assert.equal(await page.locator("iframe").count(),0,"Business modules must run in React, not iframe")
  assert.ok((await native.locator("#view").textContent())?.trim().length>20,"Business module content should render")
  const stylesheet=await page.request.get(new URL("legacy-business.css",base).toString())
  assert.equal(stylesheet.status(),200,"Scoped legacy business styles are available")
  assert.ok((await stylesheet.text()).includes(".legacy-root"),"Business CSS must not leak into the React app")
  assert.ok((await page.locator("svg.lucide").count())>0,"React UI renders Lucide icons")
  assert.deepEqual(errors,[],"Uncaught page errors")
  await page.screenshot({path:"test-results/warehouse-module.png",fullPage:true})

  const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true})
  await mobile.goto(base,{waitUntil:"networkidle"})
  await mobile.getByRole("button",{name:"打开部门菜单"}).click()
  await mobile.locator(".shell-sidebar .department-tile").filter({hasText:"仓库 / 物流部"}).click()
  await mobile.getByRole("tab",{name:/部门花名簿/}).click()
  const mobileRoster=await mobile.locator(".roster-grid").evaluate(grid=>({
    columns:getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/).length,
    heights:[...grid.querySelectorAll(".person-tile")].map(card=>card.getBoundingClientRect().height),
    overflow:document.documentElement.scrollWidth>innerWidth+4
  }))
  assert.equal(mobileRoster.columns,1,"Phone roster uses one readable employee card per row")
  assert.ok(mobileRoster.heights.every(height=>height>=48&&height<=80),
    "Mobile employee cards remain short: "+JSON.stringify(mobileRoster))
  assert.equal(mobileRoster.overflow,false,"Roster does not cause phone horizontal overflow")
  await mobile.getByRole("tab",{name:/业务功能/}).click()

  const mobileFeatureLayout=await mobile.locator(".feature-grid").evaluate(grid=>{
    const cards=[...grid.querySelectorAll(".feature-tile")]
    return {columns:getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/).length,
      heights:cards.map(card=>card.getBoundingClientRect().height),
      overflow:document.documentElement.scrollWidth>innerWidth+4}
  })
  assert.equal(mobileFeatureLayout.columns,1,"Phone uses one short, readable function card per row")
  assert.ok(mobileFeatureLayout.heights.every(height=>height>=60&&height<=112),
    "Phone cards remain compact without cropping text: "+JSON.stringify(mobileFeatureLayout))
  assert.equal(mobileFeatureLayout.overflow,false,"Dense mobile grid must not cause horizontal scrolling")
  await mobile.getByRole("button",{name:"查看仓库 / 物流部介绍"}).click()
  const mobilePopup=mobile.locator('[data-slot="popover-content"]')
  await mobilePopup.waitFor({state:"visible"})
  const mobileBox=await mobilePopup.boundingBox()
  assert.ok(mobileBox&&mobileBox.width<=390&&mobileBox.x>=0&&mobileBox.x+mobileBox.width<=390,
    "Touch popup must stay on screen")
  await mobile.screenshot({path:"test-results/mobile.png",fullPage:true})
  await mobile.close()
  console.log("PASS: overview, 12 nav tiles, 8 warehouse cards, shadcn popover, roster, iframe-free business workbench.")
} catch(err) {
  failed=true
  console.error(err)
} finally {
  if(browser)await browser.close()
  server.kill("SIGTERM")
}
if(failed)process.exit(1)
