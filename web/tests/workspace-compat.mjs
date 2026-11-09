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
const v4=workspace("SO-V4-CHECK","来自已上线 v4 的订单")
const v2=workspace("SO-V2-CHECK","来自旧版 v2 的订单")
v2.orders.push({...v2.orders[0],id:"SO-V2-EXTRA"})
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
   const {page,errors}=await open([["factory-workspace-v4",v4],["factory-workspace-v2",v2]])
   assert.equal((await page.locator(".kpi-value").nth(1).textContent()).trim(),"01",
     "Existing live v4 records must take priority over v2")
   await page.evaluate(()=>{location.hash="#/departments/sales/orders"})
   await page.locator(".native-business .legacy-root").waitFor({state:"visible"})
   assert.ok((await page.locator(".native-business #view").textContent())?.includes("来自已上线 v4 的订单"))
   assert.ok(!(await page.locator(".native-business #view").textContent())?.includes("来自旧版 v2 的订单"))
   assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem("factory-workspace-v4")).orders[0].id),"SO-V4-CHECK")
   assert.deepEqual(errors,[])
   await page.close()
 }
 {
   const {page,errors}=await open([["factory-workspace-v2",v2]])
   assert.equal((await page.locator(".kpi-value").nth(1).textContent()).trim(),"02",
     "Old v2 data must be visible if v4 is absent")
   await page.evaluate(()=>{location.hash="#/departments/sales/orders"})
   await page.locator(".native-business .legacy-root").waitFor({state:"visible"})
   assert.ok((await page.locator(".native-business #view").textContent())?.includes("来自旧版 v2 的订单"))
   await page.locator('[data-op-action="newOrder"]').first().click()
   const form=page.locator("#ops-form")
   await form.waitFor({state:"visible"})
   await form.locator('[name="product"]').fill("新版追加订单")
   await form.locator('button[type="submit"]').click()
   await page.waitForFunction(()=>JSON.parse(localStorage.getItem("factory-workspace-v4")||"{}").orders?.some(o=>o.product==="新版追加订单"),null,{timeout:10000})
   const migrated=await page.evaluate(()=>JSON.parse(localStorage.getItem("factory-workspace-v4")))
   assert.ok(migrated.orders.some(o=>o.id==="SO-V2-CHECK"),"Previously saved v2 records must survive first v4 save")
   assert.ok(migrated.orders.some(o=>o.id==="SO-V2-EXTRA"),"All v2 records survive migration")
   assert.ok(migrated.orders.some(o=>o.product==="新版追加订单"),"New v4 writes remain intact")
   assert.ok(await page.evaluate(()=>localStorage.getItem("factory-workspace-v2")!==null),"Original v2 backup must not be deleted")
   await page.reload({waitUntil:"networkidle"})
   assert.equal((await page.locator(".kpi-value").nth(1).textContent()).trim(),"03")
   assert.deepEqual(errors,[])
   await page.close()
 }
 console.log("PASS: live v4 priority, old v2 fallback, non-destructive migration on write, reload persistence.")
}catch(error){failed=true;console.error(error)}
finally{await browser?.close();server.kill("SIGTERM")}
if(failed)process.exit(1)
