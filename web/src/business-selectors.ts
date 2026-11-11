import type { WorkspaceData, WorkItem } from "./factory-state"
import orderStages from "./order-stages.json"
import orderWorkflow from "./order-workflow.json"

export interface TodoRecord {
  id:string;dept:string;kind:"ops"|"mod"|"leave"|"hrPay"|"financePay";
  title:string;detail:string;status:string;feature:string;
}
type WorkArray=WorkItem[]
type ExtraStore=Record<string,unknown>
const str=(value:unknown):string=>String(value??"")
const records=(root:unknown,key:string):WorkArray=>{
  if(!root||typeof root!=="object")return []
  const value=(root as ExtraStore)[key]
  return Array.isArray(value)?value:[]
}
const value=(root:unknown,key:string):ExtraStore=>{
  if(!root||typeof root!=="object")return {}
  const target=(root as ExtraStore)[key]
  return target&&typeof target==="object"&&!Array.isArray(target)?target as ExtraStore:{}
}
const stageNames:Record<string,string>=orderStages
function orderStage(record:WorkItem,workspace:WorkspaceData):string {
  const flows=value(workspace.ops,"flows")
  const flow=flows[record.id]
  if(flow&&typeof flow==="object"&&"stage" in flow)return str((flow as ExtraStore).stage)
  // Matches the stage inferred by FactoryOperations.init when an order is imported.
  return record.status==="待评审"?"review":record.status==="草稿"?"draft":"approved"
}
export function orderStageLabel(record:WorkItem,workspace:WorkspaceData):string {
  return stageNames[orderStage(record,workspace)]??"未知状态"
}
export function getTodos(dept:string,workspace:WorkspaceData):TodoRecord[] {
  const result:TodoRecord[]=[]
  const add=(kind:TodoRecord["kind"],feature:string,record:WorkItem,title:string,detail:unknown,status:unknown)=>{
    result.push({kind,id:str(record.id),dept,feature,title,detail:str(detail),status:str(status)})
  }
  // Shared department/feature routing is also used by the MES execution engine.
  const routes=orderWorkflow.nextWorkForStage as Record<string,{dept:string;feature:string}>
  const todoTitles=orderWorkflow.todoTitles as Record<string,string>
  for(const order of workspace.orders??[]){
    const stage=orderStage(order,workspace)
    const route=routes[stage],title=todoTitles[stage]
    if(route?.dept===dept&&title)
      add("ops",route.feature,order,title,order.product??order.id,stageNames[stage]??"未知状态")
  }
  const ops=workspace.ops
  if(dept==="purchase")for(const record of records(ops,"purchases"))
    if(record.status!=="已入库")add("ops","purchase",record,"采购单待处理",record.material,record.status)
  if(dept==="leadership")for(const record of records(ops,"approvals"))
    if(record.status==="待复核")add("ops","approvals",record,"审批事项待处理",record.subject,record.status)

  // Identical inspection / warehouse / production / PMC selection to FactoryModules.pendingForDept().
  const mod=workspace.modules
  const addModules=(key:string,feature:string,check:(record:WorkItem)=>boolean)=>{
    for(const record of records(mod,key).filter(check)){
      add("mod",feature,record,str(record.id),
        record.reason||record.material||record.order||record.title||record.type||"",record.status)
    }
  }
  if(dept==="quality"){
    addModules("inspections","qaQc",r=>r.status==="待判定")
    addModules("cleanReports","qaCleanInspection",r=>r.status==="待判定")
    addModules("ncr","qaNcr",r=>r.status==="待处置")
  }
  if(dept==="warehouse"){
    addModules("incoming","warehouseIncoming",r=>!["已入库","已驳回"].includes(r.status))
    addModules("materialRequests","warehousePick",r=>r.type==="领料"&&["待备料","待仓库签发"].includes(r.status))
    addModules("materialRequests","warehouseReturns",r=>r.type==="退库"&&r.status==="待仓库接收")
    addModules("outbound","warehouseOutbound",r=>r.status==="待出库")
  }
  if(dept==="production"){
    addModules("materialRequests","workshopReceive",r=>r.status==="待车间签收")
    addModules("disputes","workshopDispute",r=>r.status==="待审批")
  }
  if(dept==="pmc"){
    for(const record of records(mod,"roster"))if(record.gate!=="已通过")
      add("mod","shift",record,str(record.id),record.reason||record.material||record.order||record.title||record.type||"",record.status)
  }

  // App-level HR, finance and engineering work from app.js.
  if(dept==="hr"){
    for(const record of workspace.leaves??[])if(record.status==="待人事审批")
      add("leave","leaveApproval",record,`请假审批 · ${str(record.person)}`,record.range,record.status)
    for(const record of workspace.payroll??[])if(record.status==="待人事复核")
      add("hrPay","payroll",record,`工资核算 · ${str(record.name)}`,record.basis,record.status)
  }
  if(dept==="finance")for(const record of workspace.payroll??[])
    if(record.status==="待财务核准")
      add("financePay","payroll",record,`工资核准 · ${str(record.name)}`,record.basis,record.status)
  if(dept==="production")for(const record of workspace.tasks??[])
    if(["清洗","调机调线","设备点检"].includes(str(record.type))&&!["已完成","已取消"].includes(str(record.status)))
      add("ops","nonProductionTasks",record,`${str(record.type)} · ${str(record.id)}`,record.orderId||record.line||"非生产工单",record.status)
  return result
}
export function todoLane(status:string):"waiting"|"doing"|"review" {
  const s=String(status||"")
  if(/待(审批|判定|复核|审核|确认|质量|放行|检查)|待人事|待财务|待核准|未通过|比对差异/.test(s))return "review"
  if(/执行中|进行中|生产中|待发料|待备料|待签发|待签收|待接收|待到货|待收货|已排程|处理中/.test(s))return "doing"
  return "waiting"
}
export function dashboardMetrics(workspace:WorkspaceData){
  const entries=Object.keys(stageNames)
  return {
    orders:workspace.orders?.length??0,
    activeOrders:(workspace.orders??[]).filter(o=>orderStage(o,workspace)!=="delivered").length,
    productionTasks:(workspace.tasks??[]).filter(t=>t.category==="生产任务").length,
    pending:["hr","sales","pmc","purchase","warehouse","quality","production","finance","it","leadership"]
      .reduce((sum,dept)=>sum+getTodos(dept,workspace).length,0),
    stages:entries.map(stage=>({stage,label:stageNames[stage],count:(workspace.orders??[]).filter(o=>orderStage(o,workspace)===stage).length}))
  }
}
