import test from "node:test"
import assert from "node:assert/strict"
import { getTodos, orderStageLabel, dashboardMetrics, todoLane } from "../src/business-selectors"
import type { WorkspaceData, WorkItem } from "../src/factory-state"

const order=(id:string,status="草稿"):WorkItem=>({id,product:"示例产品",status})
const rec=(id:string,status:string,extra:Record<string,unknown>={}):WorkItem=>({id,status,...extra})
const empty=():WorkspaceData=>({orders:[],tasks:[],leaves:[],payroll:[],ops:{version:16,flows:{},purchases:[],approvals:[]},modules:{inspections:[],cleanReports:[],ncr:[],incoming:[],materialRequests:[],outbound:[],disputes:[],roster:[]}})

test("legacy imported order stages agree with operations init",()=>{
  const ws=empty()
  ws.orders=[order("SO-A","待评审"),order("SO-B","待排产"),order("SO-C","草稿")]
  assert.equal(orderStageLabel(ws.orders[0],ws),"待评审")
  assert.equal(orderStageLabel(ws.orders[1],ws),"已评审")
  assert.equal(orderStageLabel(ws.orders[2],ws),"草稿")
  assert.equal(getTodos("sales",ws).length,1)
  assert.equal(getTodos("pmc",ws).length,1)
  assert.equal(getTodos("production",ws).length,0)
})
test("order handoff stage routes match FactoryOperations.pendingForDept",()=>{
  const cases:[string,string,string][]=[
    ["review","sales","orderReview"],["approved","pmc","schedule"],
    ["formal","pmc","kitting"],["reserved","warehouse","issue"],
    ["issued","production","tasks"],["blending","production","tasks"],
    ["semi_ok","production","tasks"],["packaging","production","tasks"],
    ["blend_clean","production","nonProductionTasks"],["pack_clean","production","nonProductionTasks"],
    ["semi_qc","quality","qaQc"],["final_qc","quality","qaQc"],
    ["inspected","quality","release"],["released","warehouse","inventory"],
    ["stored","sales","orders"],["dispatch","warehouse","warehouseOutbound"],
    ["shipping","warehouse","warehouseOutbound"],["shipped","sales","orders"]
  ]
  for(const [stage,dept,feature] of cases){
    const ws=empty()
    ws.orders=[order("SO-ONE")]
    ws.ops={...ws.ops,flows:{"SO-ONE":{stage}}}
    const found=getTodos(dept,ws)
    assert.equal(found.length,1,stage)
    assert.equal(found[0].feature,feature,stage)
    assert.equal(found[0].kind,"ops",stage)
  }
  for(const stage of ["draft","trial","delivered"]){
    const ws=empty();ws.orders=[order("SO-ONE")];ws.ops={...ws.ops,flows:{"SO-ONE":{stage}}}
    assert.equal(["sales","pmc","quality","warehouse","production"].reduce((n,d)=>n+getTodos(d,ws).length,0),0,stage)
  }
})
test("purchase/leadership ops and quality department module tasks",()=>{
  const ws=empty()
  ws.ops={...ws.ops,purchases:[rec("PO-01","待审批",{material:"RM-001"}),rec("PO-02","已入库")],
    approvals:[rec("APR-01","待复核",{subject:"审批事项"}),rec("APR-02","已复核")]}
  ws.modules={...ws.modules,inspections:[rec("QC-01","待判定")],cleanReports:[rec("CL-01","待判定")],ncr:[rec("NCR-01","待处置")]}
  assert.deepEqual(getTodos("purchase",ws).map(r=>r.id),["PO-01"])
  assert.deepEqual(getTodos("leadership",ws).map(r=>r.id),["APR-01"])
  assert.deepEqual(getTodos("quality",ws).map(r=>r.feature),["qaQc","qaCleanInspection","qaNcr"])
})
test("warehouse and production module tasks cover status gates",()=>{
  const ws=empty()
  ws.modules={...ws.modules,
    incoming:[rec("RC-01","待QC"),rec("RC-02","已入库"),rec("RC-03","已驳回")],
    materialRequests:[rec("MR-01","待备料",{type:"领料"}),rec("MR-02","待仓库签发",{type:"领料"}),
      rec("MR-03","待仓库接收",{type:"退库"}),rec("MR-04","待车间签收",{type:"领料"})],
    outbound:[rec("OUT-01","待出库")],
    disputes:[rec("DSP-01","待审批")],
    roster:[rec("SHIFT-01","已排班",{gate:"待检查"}),rec("SHIFT-02","已通过",{gate:"已通过"})]}
  assert.deepEqual(getTodos("warehouse",ws).map(r=>r.id),["RC-01","MR-01","MR-02","MR-03","OUT-01"])
  assert.deepEqual(getTodos("production",ws).map(r=>r.id),["MR-04","DSP-01"])
  assert.deepEqual(getTodos("pmc",ws).map(r=>r.id),["SHIFT-01"])
})
test("equipment work moves into production nonproduction without deleting existing tasks",()=>{
  const ws=empty()
  ws.leaves=[rec("LV-01","待人事审批",{person:"员工甲",range:"明天"})]
  ws.payroll=[rec("OT-01","待人事复核",{name:"员工乙"}),rec("IN-01","待财务核准",{name:"员工丙"})]
  ws.tasks=[
    rec("TK-01","待开始",{type:"调机调线",line:"L01"}),
    rec("TK-02","已完成",{type:"调机调线"}),
    rec("TK-03","待复核",{type:"清洗",line:"L02"}),
    rec("TK-04","执行中",{type:"设备点检"}),
    rec("TK-05","待开始",{type:"配制",category:"生产任务"})
  ]
  assert.deepEqual(getTodos("hr",ws).map(r=>r.feature),["leaveApproval","payroll"])
  assert.deepEqual(getTodos("finance",ws).map(r=>r.id),["IN-01"])
  const todos=getTodos("production",ws)
  assert.deepEqual(todos.map(x=>x.id),["TK-01","TK-03","TK-04"])
  assert.ok(todos.every(x=>x.feature==="nonProductionTasks"))
  assert.equal(getTodos("engineering",ws).length,0)
  assert.equal(getTodos("it",ws).length,0)
})
test("real factory status labels map to the three todo columns",()=>{
  assert.equal(todoLane("待审批"),"review")
  assert.equal(todoLane("待备料"),"doing")
  assert.equal(todoLane("处理中"),"doing")
  assert.equal(todoLane("待开始"),"waiting")
  assert.equal(todoLane("已完成"),"waiting")
})
test("dashboard counts all departments and all uncompleted orders",()=>{
  const ws=empty()
  ws.orders=[order("SO-01","待评审"),order("SO-02","草稿")]
  ws.ops={...ws.ops,flows:{"SO-01":{stage:"review"},"SO-02":{stage:"delivered"}},
    purchases:[rec("PO-01","待审批")]}
  ws.tasks=[rec("TK-01","待开始",{category:"生产任务"}),rec("TK-02","已完成",{category:"非生产任务"})]
  const metrics=dashboardMetrics(ws)
  assert.equal(metrics.orders,2)
  assert.equal(metrics.activeOrders,1)
  assert.equal(metrics.productionTasks,1)
  assert.equal(metrics.pending,2)
})
