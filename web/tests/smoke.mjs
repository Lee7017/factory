import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { mkdir } from "node:fs/promises"
import { chromium } from "playwright"

const base="http://127.0.0.1:4173/factory/"
const server=spawn(process.execPath,["node_modules/vite/bin/vite.js","preview","--host","127.0.0.1","--port","4173","--strictPort"],{
  cwd:process.cwd(),stdio:["ignore","pipe","pipe"]
})
let browser,failed=false
async function waitForServer(){
  for(let i=0;i<60;i++){
    try{const res=await fetch(base);if(res.ok)return}catch{}
    await new Promise(resolve=>setTimeout(resolve,500))
  }
  throw new Error("Vite preview server did not start")
}
try{
  await mkdir("test-results",{recursive:true})
  await waitForServer()
  browser=await chromium.launch({headless:true,args:["--no-sandbox"]})
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1})
  const errors=[]
  page.on("pageerror",err=>errors.push(err.stack??err.message))
  await page.goto(base,{waitUntil:"networkidle"})
  await page.locator(".department-band-button").first().waitFor()

  assert.equal(await page.locator("svg.svg-bank[data-icon-library=lucide] symbol[data-lucide-icon]").count(),77,
    "All 77 legacy business icons remain available without iframe")
  assert.equal(await page.locator(".system-rail").count(),1,"One compact system rail")
  assert.equal(await page.locator(".department-band-button").count(),9,"Nine operating departments live in the horizontal department band; system settings is separate")
  assert.equal(await page.locator(".shell-topbar,.shell-sidebar,.department-tile").count(),0,
    "Old topbar and department tile sidebar are removed")
  assert.equal(await page.locator(".dashboard-kpis .kpi-card").count(),4,"Overview keeps four operational KPIs")
  assert.equal(await page.locator(".overview-gantt-panel").count(),1,"Real Gantt remains")
  assert.equal(await page.locator(".overview-donut-panel svg").count(),1,"Order donut remains")
  assert.equal(await page.locator(".overview-alerts-panel").count(),1,"Critical alerts remain")
  assert.equal(await page.locator(".overview-agent-card").count(),5,"Five animal Agent roles remain")

  const shell=await page.evaluate(()=>{
    const rail=document.querySelector(".system-rail")?.getBoundingClientRect()
    const departments=document.querySelector(".department-band-shell")?.getBoundingClientRect()
    return {
      railWidth:Math.round(rail?.width??0),
      departmentHeight:Math.round(departments?.height??0),
      overflow:document.documentElement.scrollWidth>innerWidth+4
    }
  })
  assert.equal(shell.railWidth,64,"Desktop system rail is 64px")
  assert.equal(shell.departmentHeight,46,"Department band stays one compact row")
  assert.equal(shell.overflow,false,"Overview has no page-level horizontal overflow")

  await page.screenshot({path:"test-results/overview.png",fullPage:true})

  await page.locator(".department-band-button").filter({hasText:"仓库"}).click()
  await page.locator(".department-overview-panel").waitFor({state:"visible"})
  assert.equal(await page.locator(".feature-band-button").count(),9,
    "Warehouse has department overview plus eight real business functions")
  assert.equal((await page.locator('.department-band-button[aria-current="page"]').textContent())?.trim(),"仓库")
  const featureBand=await page.locator(".feature-band").evaluate(el=>{
    const r=el.getBoundingClientRect()
    const active=el.querySelector(".feature-band-button.active")
    const after=active?getComputedStyle(active,"::after"):null
    return {
      height:Math.round(r.height),
      activeText:active?.textContent?.trim(),
      underline:after?.backgroundColor,
      overflow:document.documentElement.scrollWidth>innerWidth+4
    }
  })
  assert.equal(featureBand.height,48,"Business function band is exactly one 48px row")
  assert.equal(featureBand.activeText,"部门总览")
  assert.equal(featureBand.underline,"rgb(0, 151, 63)","Active function keeps the thin #00973F underline")
  assert.equal(featureBand.overflow,false)

  await page.getByText("办公位置",{exact:true}).waitFor()
  const rosterLayout=await page.locator(".roster-grid").evaluate(grid=>{
    const cards=[...grid.querySelectorAll(".person-tile")]
    const rects=cards.map(card=>card.getBoundingClientRect())
    return {
      count:cards.length,
      fields:cards.every(card=>Boolean(card.querySelector(".person-meta strong")?.textContent?.trim())&&
        Boolean(card.querySelector(".person-meta span")?.textContent?.trim())),
      overflow:document.documentElement.scrollWidth>innerWidth+4
    }
  })
  assert.ok(rosterLayout.count>0,"Warehouse roster contains employees")
  assert.ok(rosterLayout.fields&&!rosterLayout.overflow,"Roster stays readable without page overflow")
  await page.locator(".person-tile").first().click()
  await page.getByRole("dialog").getByText("本地演示消息，不会送达其他设备。").waitFor()
  await page.keyboard.press("Escape")
  await page.screenshot({path:"test-results/warehouse-roster.png",fullPage:true})

  await page.locator(".feature-band-button").filter({hasText:"库存批次"}).click()
  const native=page.locator(".native-business .legacy-root")
  await native.waitFor({state:"visible"})
  await page.waitForFunction(()=>document.querySelector(".native-business #view")?.textContent?.trim().length>20)
  assert.equal(await page.locator("iframe").count(),0,"Business modules run in React, not iframe")
  assert.ok((await native.locator("#view").textContent())?.trim().length>20,"Warehouse module renders")
  assert.equal((await page.locator('.feature-band-button[aria-current="page"]').textContent())?.trim(),"库存批次")
  const businessLayout=await page.evaluate(()=>{
    const feature=document.querySelector(".feature-band")?.getBoundingClientRect()
    const body=document.querySelector(".business-page-frame")?.getBoundingClientRect()
    return {
      featureHeight:Math.round(feature?.height??0),
      bodyWidth:Math.round(body?.width??0),
      available:innerWidth-64,
      overflow:document.documentElement.scrollWidth>innerWidth+4
    }
  })
  assert.equal(businessLayout.featureHeight,48)
  assert.ok(businessLayout.bodyWidth>businessLayout.available*.88,
    "Business workbench uses nearly all workspace width: "+JSON.stringify(businessLayout))
  assert.equal(businessLayout.overflow,false)

  const stylesheet=await page.request.get(new URL("legacy-business.css",base).toString())
  assert.equal(stylesheet.status(),200,"Scoped legacy styles remain available")
  assert.ok((await stylesheet.text()).includes(".legacy-root"))
  assert.ok((await page.locator("svg.lucide").count())>0,"React UI renders Lucide icons")
  assert.deepEqual(errors,[],"No uncaught page errors")
  await page.screenshot({path:"test-results/warehouse-module.png",fullPage:true})

  const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true})
  await mobile.goto(base,{waitUntil:"networkidle"})
  await mobile.locator(".system-rail").waitFor({state:"visible"})
  await mobile.locator(".department-band-button").filter({hasText:"仓库"}).click()
  await mobile.locator(".feature-band").waitFor({state:"visible"})
  await mobile.locator(".feature-band-button").filter({hasText:"库存批次"}).click()
  await mobile.locator(".native-business .legacy-root").waitFor({state:"visible"})
  const mobileLayout=await mobile.evaluate(()=>({
    rail:Math.round(document.querySelector(".system-rail")?.getBoundingClientRect().width??0),
    deptHeight:Math.round(document.querySelector(".department-band-shell")?.getBoundingClientRect().height??0),
    featureHeight:Math.round(document.querySelector(".feature-band")?.getBoundingClientRect().height??0),
    pageOverflow:document.documentElement.scrollWidth>innerWidth+4
  }))
  assert.equal(mobileLayout.rail,54,"Phone system rail is compact")
  assert.equal(mobileLayout.deptHeight,46)
  assert.equal(mobileLayout.featureHeight,48)
  assert.equal(mobileLayout.pageOverflow,false,"Only the internal nav/table scrollers may scroll horizontally")
  await mobile.screenshot({path:"test-results/mobile.png",fullPage:true})
  await mobile.close()

  console.log("PASS: compact system rail, horizontal departments, fixed feature band, roster and iframe-free business workbench.")
}catch(err){
  failed=true
  console.error(err)
}finally{
  if(browser)await browser.close()
  server.kill("SIGTERM")
}
if(failed)process.exit(1)
