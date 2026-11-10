import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { readFile, mkdir } from "node:fs/promises"
import { chromium } from "playwright"

const base="http://127.0.0.1:4177/factory/"
const seed=JSON.parse(await readFile("src/initial-state.json","utf8"))
const ops=JSON.parse(await readFile("src/initial-operations.json","utf8"))
const modules=JSON.parse(await readFile("src/initial-modules.json","utf8"))
const day=d=>{
  const date=new Date(d)
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`
}
const next=new Date()
next.setDate(next.getDate()+1)
const today=day(new Date())
const tomorrow=day(next)
const first=seed.orders[0].id,second=seed.orders[1].id
const workspace={...seed,
  ops:{...ops,flows:{[first]:{stage:"blending"},[second]:{stage:"approved"}},
    gantt:[
      {id:"G-TEST-1",orderId:first,type:"配制",lane:"L01 配制一线",start:`${today}T08:00`,duration:180,source:"手工排程"},
      {id:"G-TEST-2",orderId:first,type:"包装",lane:"S03-4# 瓶装线",start:`${today}T14:00`,duration:120,source:"手工排程"},
      {id:"G-TEST-3",orderId:second,type:"配制",lane:"L02 配制二线",start:`${tomorrow}T09:00`,duration:210,source:"手工排程"}
    ]
  },modules
}
const server=spawn(process.execPath,["node_modules/vite/bin/vite.js","preview","--host","127.0.0.1","--port","4177","--strictPort"],{
  cwd:process.cwd(),stdio:["ignore","pipe","pipe"]
})
let browser
let failed=false
try{
  await mkdir("test-results",{recursive:true})
  for(let i=0;i<60;i++){
    try{if((await fetch(base)).ok)break}catch{}
    await new Promise(resolve=>setTimeout(resolve,400))
  }
  browser=await chromium.launch({headless:true,args:["--no-sandbox"]})
  const page=await browser.newPage({viewport:{width:1440,height:900}})
  const errors=[]
  page.on("pageerror",err=>errors.push(err.stack??err.message))
  await page.addInitScript(value=>localStorage.setItem("factory-workspace-v4",JSON.stringify(value)),workspace)
  await page.goto(base,{waitUntil:"networkidle"})
  await page.getByRole("heading",{name:"生产运营驾驶舱"}).waitFor()
  assert.equal(await page.locator(".overview-gantt-bar").count(),3,"Weekly view draws real saved entries")
  assert.equal(await page.locator(".overview-donut-legend button").count(),4)
  const donutLabel=await page.locator(".overview-donut-chart svg").getAttribute("aria-label")
  assert.ok(donutLabel?.includes("生产中 / 待检1单"))
  assert.ok(donutLabel?.includes("待生产 / 待排程1单"))
  assert.equal(await page.locator(".overview-agent-card").count(),5)
  assert.ok((await page.locator(".overview-alert-row").count())>0)
  await page.screenshot({path:"test-results/overview-with-real-schedule-fixture.png",fullPage:true})
  await page.getByRole("button",{name:"日视图"}).click()
  assert.equal(await page.locator(".overview-gantt-bar").count(),2,"Day view filters to selected date")
  await page.getByRole("button",{name:"月视图"}).click()
  assert.equal(await page.locator(".overview-gantt-bar").count(),3,"Month view shows all saved entries")
  await page.getByRole("button",{name:"周视图"}).click()
  await page.getByRole("button",{name:"查看蜂群计划员详情"}).click()
  await page.getByRole("dialog").getByText("当前未连接运行服务",{exact:false}).waitFor()
  await page.getByRole("dialog").getByRole("button",{name:/查看 PMC 排程/}).click()
  assert.ok((await page.evaluate(()=>location.hash)).includes("/departments/pmc/schedule"))
  await page.evaluate(()=>{location.hash="#/overview"})
  await page.getByRole("heading",{name:"生产运营驾驶舱"}).waitFor()
  await page.setViewportSize({width:390,height:844})
  assert.equal(await page.locator(".overview-kpi-card").count(),4)
  const overflow=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:innerWidth}))
  assert.ok(overflow.scroll<=overflow.viewport+4,`Mobile dashboard overflow: ${JSON.stringify(overflow)}`)
  await page.screenshot({path:"test-results/overview-cockpit-mobile.png",fullPage:true})
  assert.deepEqual(errors,[],"Cockpit must not produce uncaught errors")
  console.log("PASS: saved Gantt renders 3 tasks, day/week/month filtering, donut segmentation, Agent dialog and mobile layout.")
}catch(error){failed=true;console.error(error)}
finally{await browser?.close();server.kill("SIGTERM")}
if(failed)process.exit(1)
