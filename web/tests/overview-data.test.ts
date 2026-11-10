import test from "node:test"
import assert from "node:assert/strict"
import {
  dayString,dayShift,weekStart,orderSegments,stockShortages,dashboardAlerts,
  overviewMetrics,scheduleEntries
} from "../src/overview-data"
import type { WorkspaceData } from "../src/factory-state"

const makeWorkspace=():WorkspaceData=>({
  orders:[],tasks:[],leaves:[],payroll:[],messages:[],
  ops:{version:16,flows:{},stock:{"RM-001":500,"PK-001":500},bom:[
    {id:"B-1",child:"RM-001",qty:0.1},
    {id:"B-2",child:"PK-001",qty:0.25}
  ],purchases:[]},
  modules:{batches:[],inspections:[],ncr:[],cleanReports:[]}
})
test("dashboard shows real active orders and BPM work, not repeated navigation counts",()=>{
  const ws=makeWorkspace()
  ws.orders=[
    {id:"A",product:"产品 A",qty:3000,status:"待排产"},
    {id:"B",product:"产品 B",qty:100,status:"已交付"}
  ]
  ws.ops!.flows={A:{stage:"approved"},B:{stage:"delivered"}}
  ws.tasks=[{id:"T1",type:"配制",status:"待开始",category:"生产任务"}]
  const result=overviewMetrics(ws,"2026-11-10")
  assert.equal(result.activeOrders,1)
  assert.equal(result.productionTasks,1)
  assert.equal(result.todayProduction,0,"No dated completion means no fake production")
  assert.equal(result.todaySchedule,0,"No saved Gantt means no fake scheduled tasks")
  assert.equal(result.newTasksToday,null,"Undated task is unknown, not a fake change")
  assert.equal(result.stockWarnings,1)
  assert.equal(result.pendingTasks,1,"The approved order is still waiting to be scheduled")
})
test("inventory warning follows the original operations BOM coefficient, including per-order ceiling",()=>{
  const ws=makeWorkspace()
  ws.orders=[{id:"SO-1",qty:3000,status:"待排产"}]
  ws.ops!.flows={"SO-1":{stage:"approved"}}
  const issue=stockShortages(ws)
  assert.deepEqual(issue,[{material:"PK-001",required:750,available:500,missing:250,unit:"个"}])
  const alert=dashboardAlerts(ws,"2026-11-10").find(x=>x.id==="shortage-PK-001")
  assert.ok(alert)
  assert.match(alert.detail,/750/)
  assert.match(alert.detail,/250/)
})
test("material risk excludes consumed and completed order stages",()=>{
  const ws=makeWorkspace()
  ws.orders=[{id:"SO-1",qty:3000,status:"已发货"}]
  ws.ops!.flows={"SO-1":{stage:"shipped"}}
  assert.deepEqual(stockShortages(ws),[])
})
test("order donut has four non-overlapping status groups with actual counts",()=>{
  const ws=makeWorkspace()
  ws.orders=[
    {id:"A",status:"待排产"},
    {id:"B",status:"生产中"},
    {id:"C",status:"待发货"},
    {id:"D",status:"异常"},
    {id:"E",status:"已交付"}
  ]
  ws.ops!.flows={A:{stage:"approved"},B:{stage:"blending"},C:{stage:"stored"},D:{stage:"formal"},E:{stage:"delivered"}}
  assert.deepEqual(orderSegments(ws,"2026-11-10").map(x=>x.count),[1,1,1,1])
})
test("saved Gantt tasks are preserved exactly without generating placeholder dates",()=>{
  const ws=makeWorkspace()
  ws.orders=[{id:"SO-1",status:"待排产",product:"产品 A"}]
  assert.deepEqual(scheduleEntries(ws),[])
  ws.ops!.gantt=[
    {id:"G1",orderId:"SO-1",type:"配制",lane:"L01 配制一线",start:"2026-11-10T08:00",duration:120,source:"手工排程"},
    {id:"G2",orderId:"UNKNOWN",type:"包装",lane:"S01",start:"2026-11-10T10:00",duration:60,source:"手工排程"},
    {id:"G3",orderId:"SO-1",type:"包装",lane:"S01",start:"",duration:60,source:"手工排程"}
  ]
  const entries=scheduleEntries(ws)
  assert.equal(entries.length,1)
  assert.equal(entries[0].duration,120)
  assert.equal(entries[0].start,"2026-11-10T08:00")
  assert.equal(overviewMetrics(ws,"2026-11-10").todaySchedule,1)
})
test("warnings are grounded in dated orders and actual quality and purchase records",()=>{
  const ws=makeWorkspace()
  ws.orders=[{id:"SO-1",qty:100,status:"待排产",deliveryDate:"2026-11-11"}]
  ws.ops!.flows={"SO-1":{stage:"approved"}}
  ws.ops!.purchases=[{id:"PO-1",status:"待审批"}]
  ws.modules!.inspections=[{id:"QC-1",status:"待判定"}]
  const alerts=dashboardAlerts(ws,"2026-11-10")
  assert.ok(alerts.some(x=>x.id==="due-SO-1"))
  assert.ok(alerts.some(x=>x.id==="quality-pending"))
  assert.ok(alerts.some(x=>x.id==="purchase-approval"))
  assert.ok(!alerts.some(x=>x.kind==="设备"),"Do not invent equipment warning")
})
test("production KPI only counts actual dated finished batches",()=>{
  const ws=makeWorkspace()
  ws.modules!.batches=[
    {id:"B1",status:"已完成",completedAt:"2026-11-10T11:20"},
    {id:"B2",status:"已完成",completedAt:"2026-11-09T12:00"},
    {id:"B3",status:"生产中",completedAt:"2026-11-10T08:00"}
  ]
  assert.equal(overviewMetrics(ws,"2026-11-10").todayProduction,1)
})
test("week and month date computations maintain correct boundaries",()=>{
  assert.equal(weekStart("2026-11-10"),"2026-11-09")
  assert.equal(dayShift("2026-11-30",1),"2026-12-01")
  assert.equal(dayString(new Date("2026-11-10T12:00:00")),"2026-11-10")
})
