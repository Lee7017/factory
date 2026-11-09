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
  await page.locator(".department-tile").filter({hasText:"仓库 / 物流部"}).click()
  assert.equal(await page.locator(".feature-tile").count(),8,"Published warehouse department has 8 functions")
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
  console.log("PASS: published GitHub Pages, Vite assets, React nav, Lucide, shadcn roster and native MES business.")
}catch(error){failed=true;console.error(error)}
finally{await browser?.close()}
if(failed)process.exit(1)
