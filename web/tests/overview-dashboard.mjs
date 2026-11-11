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
      {id:"G-TEST-4",orderId:first,type:"清洗",lane:"L01 配制一线",start:`${today}T08:20`,duration:45,source:"手工排程"},
      {id:"G-TEST-5",orderId:first,type:"半成品 QAQC",lane:"QC 检验位",start:`${today}T08:40`,duration:35,source:"手工排程"},
      {id:"G-TEST-6",orderId:first,type:"调机调线",lane:"S03-4# 瓶装线",start:`${today}T09:00`,duration:30,source:"手工排程"},
      {id:"G-TEST-7",orderId:first,type:"成品 QAQC",lane:"QC 检验位",start:`${today}T09:20`,duration:25,source:"手工排程"},
      {id:"G-TEST-8",orderId:first,type:"清洗",lane:"S03-4# 瓶装线",start:`${today}T09:40`,duration:30,source:"手工排程"},
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
  await page.locator(".overview-kpi-grid").waitFor()
  assert.equal(await page.locator(".overview-gantt-bar").count(),8,"Weekly view draws all saved entries including crowded days")
  const expectedLanes=[
    "L01 配制一线","L02 配制二线","S03-4# 瓶装线","S04 包装二线","QC 检验位"
  ]
  const actualLanes=await page.locator(".overview-gantt-data").evaluateAll(rows=>rows.map(row=>row.dataset.ganttLane))
  assert.deepEqual(actualLanes,expectedLanes,"Homepage uses the exact five PMC workcenters, not order rows")
  const taskLanes=await page.locator(".overview-gantt-data").evaluateAll(rows=>
    rows.flatMap(row=>Array.from(row.querySelectorAll(".overview-gantt-bar")).map(bar=>({
      id:bar.getAttribute("data-gantt-task"),lane:row.dataset.ganttLane,title:bar.title
    })))
  )
  const expectedTasks=new Map(workspace.ops.gantt.map(entry=>[entry.id,entry.lane]))
  assert.equal(taskLanes.length,8,"Eight saved tasks appear once each under their assigned lane")
  for(const item of taskLanes){
    assert.equal(item.lane,expectedTasks.get(item.id),item.id+" must render under its PMC-assigned lane")
    assert.ok(item.title.includes(item.lane),"Tooltip must reflect the displayed workcenter")
  }
  async function assertNoPaintedOverlap(label){
    const rows=await page.locator(".overview-gantt-data").evaluateAll(elements=>elements.map(row=>{
      const track=row.querySelector(".overview-gantt-track")
      const bounds=track.getBoundingClientRect()
      const bars=Array.from(row.querySelectorAll(".overview-gantt-bar"))
        .map(el=>({id:el.getAttribute("data-gantt-task"),r:el.getBoundingClientRect()}))
      const collisions=[],outside=[]
      for(const bar of bars)if(bar.r.top<bounds.top-1||bar.r.bottom>bounds.bottom+1)outside.push(bar.id)
      for(let i=0;i<bars.length;i++)for(let j=i+1;j<bars.length;j++){
        const a=bars[i].r,b=bars[j].r
        if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>0.5&&
          Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>0.5)collisions.push([bars[i].id,bars[j].id])
      }
      return {lane:row.dataset.ganttLane,collisions,outside,height:row.getBoundingClientRect().height}
    }))
    assert.equal(rows.length,5,label+" must keep five PMC workcenter lanes")
    assert.ok(rows.every(row=>row.collisions.length===0&&row.outside.length===0),
      label+" task rectangles overlap/escape workcenter: "+JSON.stringify(rows))
  }
  await assertNoPaintedOverlap("week")
  const colors=await page.locator(".overview-gantt-bar")
    .evaluateAll(nodes=>[...new Set(nodes.map(n=>getComputedStyle(n).backgroundColor))])
  assert.equal(colors.length,6,"Homepage uses six distinct PMC colors across all workcenters")
  assert.equal(await page.locator(".overview-gantt-legend span").count(),6,"Six-stage legend matches PMC")
  assert.equal(await page.locator(".overview-gantt-bar.is-mini").count()>0,true,
    "Short tasks display color blocks without illegible text")
  assert.equal(await page.locator(".overview-gantt-bar.is-conflict").count(),2,
    "Real overlapping workcenter time is highlighted, not silently hidden by visual stacking")
  assert.equal(await page.locator(".overview-donut-legend button").count(),4)
  const donutLabel=await page.locator(".overview-donut-chart svg").getAttribute("aria-label")
  assert.ok(donutLabel?.includes("生产中 / 待检1单"))
  assert.ok(donutLabel?.includes("待生产 / 待排程1单"))
  assert.equal(await page.locator(".overview-agent-card").count(),5)
  assert.ok((await page.locator(".overview-alert-row").count())>0)
  await page.screenshot({path:"test-results/overview-with-real-schedule-fixture.png",fullPage:true})
  await page.getByRole("button",{name:"日视图"}).click()
  assert.equal(await page.locator(".overview-gantt-bar").count(),7,"Day view filters to selected date")
  await assertNoPaintedOverlap("day")
  await page.getByRole("button",{name:"月视图"}).click()
  assert.equal(await page.locator(".overview-gantt-bar").count(),8,"Month view shows all saved entries")
  await assertNoPaintedOverlap("month")
  await page.getByRole("button",{name:"周视图"}).click()
  await page.getByRole("button",{name:"查看蜂群计划员详情"}).click()
  await page.getByRole("dialog").getByText("当前未连接运行服务",{exact:false}).waitFor()
  await page.getByRole("dialog").getByRole("button",{name:/查看 PMC 排程/}).click()
  assert.ok((await page.evaluate(()=>location.hash)).includes("/departments/pmc/schedule"))
  await page.evaluate(()=>{location.hash="#/overview"})
  await page.locator(".overview-kpi-grid").waitFor()
  await page.setViewportSize({width:390,height:844})
  // Wait for the sidebar's CSS transform transition: a mid-transition
  // screenshot incorrectly makes the closed navigation cover half the phone.
  await page.waitForFunction(()=>{
    const sidebar=document.querySelector(".shell-sidebar")
    return sidebar&&sidebar.getBoundingClientRect().right<=2
  },null,{timeout:5000})
  await page.evaluate(()=>window.scrollTo(0,0))
  assert.equal(await page.locator(".overview-kpi-card").count(),4)
  const overflow=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:innerWidth}))
  assert.ok(overflow.scroll<=overflow.viewport+4,`Mobile dashboard overflow: ${JSON.stringify(overflow)}`)
  await page.screenshot({path:"test-results/overview-cockpit-mobile.png",fullPage:true})
  assert.deepEqual(errors,[],"Cockpit must not produce uncaught errors")
  console.log("PASS: packed homepage Gantt renders 8 tasks without overlaps, six PMC colors, day/week/month, mobile layout.")
}catch(error){failed=true;console.error(error)}
finally{await browser?.close();server.kill("SIGTERM")}
if(failed)process.exit(1)
