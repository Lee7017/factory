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
  page.on("pageerror",err=>errors.push(err.message))
  await page.goto(base, {waitUntil:"networkidle"})
  await page.locator(".department-tile").first().waitFor()
  assert.equal(await page.locator(".department-tile").count(),12,"Homepage + 11 department squares")
  assert.equal(await page.locator(".dashboard-kpis .kpi-card").count(),4,"Overview has four stat cards")
  await page.screenshot({path:"test-results/overview.png",fullPage:true})
  await page.locator(".department-tile").filter({hasText:"仓库 / 物流部"}).click()
  await page.locator(".feature-tile").first().waitFor()
  assert.equal(await page.locator(".feature-tile").count(),8,"Warehouse has 8 business cards")
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
