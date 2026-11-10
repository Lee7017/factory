import assert from "node:assert/strict"
import {spawn} from "node:child_process"
import {readFile} from "node:fs/promises"
import {chromium} from "playwright"

const base="http://127.0.0.1:4176/factory/"
const server=spawn(process.execPath,["node_modules/vite/bin/vite.js","preview","--host","127.0.0.1","--port","4176","--strictPort"],{cwd:process.cwd(),stdio:["ignore","pipe","pipe"]})
const seed=JSON.parse(await readFile("src/initial-state.json","utf8"))
const initialOps=JSON.parse(await readFile("src/initial-operations.json","utf8"))
const initialMods=JSON.parse(await readFile("src/initial-modules.json","utf8"))
function workspace(id,product){
 const orders=[{id,product,spec:"测试规格",qty:35,unit:"L",status:"待评审",owner:"销售部"}]
 return {...structuredClone(seed),orders,ops:{...structuredClone(initialOps),flows:{[id]:{stage:"review",audit:[]}}},modules:structuredClone(initialMods)}
}
const current=workspace("SO-V4-ONLY","来自当前 v4 的订单")
const obsolete=workspace("SO-V2-OLD","来自旧版 v2 的订单")
obsolete.orders.push({...obsolete.orders[0],id:"SO-V2-OTHER"})
let browser,failed=false
async function open(preloads){
 const page=await browser.newPage({viewport:{width:1440,height:900}})
 const errors=[]
 page.on("pageerror",e=>errors.push(e.stack??e.message))
 await page.addInitScript(items=>{
   for(const [key,data] of items)localStorage.setItem(key,JSON.stringify(data))
 },preloads)
 await page.goto(base,{waitUntil:"networkidle"})
 await page.locator(".dashboard-kpis .kpi-card").first().waitFor()
 return {page,errors}
}
try{
 for(let i=0;i<80;i++){try{if((await fetch(base)).ok)break}catch{}await new Promise(r=>setTimeout(r,300))}
 browser=await chromium.launch({headless:true,args:["--no-sandbox"]})
 {
   const {page,errors}=await open([["factory-workspace-v4",current],["factory-workspace-v2",obsolete]])
   assert.equal((await page.locator(".kpi-value").nth(0).textContent()).trim(),"01","Current v4 records must be read")
   await page.evaluate(()=>{location.hash="#/departments/sales/orders"})
   await page.locator(".native-business .legacy-root").waitFor({state:"visible"})
   const content=await page.locator(".native-business #view").textContent()
   assert.ok(content?.includes("来自当前 v4 的订单"))
   assert.ok(!content?.includes("来自旧版 v2 的订单"))
   assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem("factory-workspace-v4")).orders[0].id),"SO-V4-ONLY")
   assert.deepEqual(errors,[])
   await page.close()
 }
 {
   const {page,errors}=await open([["factory-workspace-v2",obsolete]])
   assert.equal((await page.locator(".kpi-value").nth(0).textContent()).trim(),
     String(seed.orders.length).padStart(2,"0"),"When v4 is missing use factory seed data, never old v2")
   await page.evaluate(()=>{location.hash="#/departments/sales/orders"})
   await page.locator(".native-business .legacy-root").waitFor({state:"visible"})
   const content=await page.locator(".native-business #view").textContent()
   assert.ok(!content?.includes("来自旧版 v2 的订单"),"Old v2 data must not be displayed")
   await page.locator('[data-op-action="newOrder"]').first().click()
   const form=page.locator("#ops-form")
   await form.waitFor({state:"visible"})
   await form.locator('[name="product"]').fill("当前版本新增订单")
   await form.locator('button[type="submit"]').click()
   await page.waitForFunction(()=>JSON.parse(localStorage.getItem("factory-workspace-v4")||"{}").orders?.some(o=>o.product==="当前版本新增订单"),null,{timeout:10000})
   const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("factory-workspace-v4")))
   assert.equal(saved.orders.length,seed.orders.length+1,"Only seed orders and new writes appear in v4")
   assert.ok(!saved.orders.some(o=>o.id==="SO-V2-OLD"||o.id==="SO-V2-OTHER"),"Old records must never be imported")
   assert.ok(await page.evaluate(()=>localStorage.getItem("factory-workspace-v2")!==null),"Old storage must be left untouched, not read or deleted")
   await page.reload({waitUntil:"networkidle"})
   await page.evaluate(()=>{location.hash="#/overview"})
   await page.locator(".dashboard-kpis .kpi-card").first().waitFor()
   assert.equal((await page.locator(".kpi-value").nth(0).textContent()).trim(),String(seed.orders.length+1).padStart(2,"0"))
   assert.deepEqual(errors,[])
   await page.close()
 }
 console.log("PASS: current v4 only, old v2 ignored, clean new workspace, writes persist.")
}catch(error){failed=true;console.error(error)}
finally{await browser?.close();server.kill("SIGTERM")}
if(failed)process.exit(1)
