import type { WorkspaceData, WorkItem } from "@/factory-state"
import { getTodos, todoLane } from "@/business-selectors"

type Datum=Record<string,unknown>
const asRecord=(value:unknown):Datum=>value&&typeof value==="object"&&!Array.isArray(value)?value as Datum:{}
const asRows=(value:unknown):Datum[]=>Array.isArray(value)?value.filter((row):row is Datum=>Boolean(row)&&typeof row==="object"&&!Array.isArray(row)):[]
const text=(value:unknown):string=>typeof value==="string"?value:String(value??"")
const quantity=(value:unknown):number=>typeof value==="number"&&Number.isFinite(value)?value:
  typeof value==="string"&&value.trim()!==""&&Number.isFinite(Number(value))?Number(value):0
const validDay=(raw:unknown):string|null=>{
  if(typeof raw==="string"){
    const match=raw.match(/^(\d{4}-\d{2}-\d{2})/)
    if(match&&Number.isFinite(new Date(match[1]+"T12:00:00").getTime()))return match[1]
  }
  if(typeof raw==="number"&&Number.isFinite(raw)){
    const value=new Date(raw)
    if(Number.isFinite(value.getTime()))return dayString(value)
  }
  return null
}
export function dayString(date:Date):string{
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`
}
export function dayShift(day:string,days:number):string{
  const date=new Date(day+"T12:00:00")
  date.setDate(date.getDate()+days)
  return dayString(date)
}
export function weekStart(day:string):string{
  const d=new Date(day+"T12:00:00"),weekday=d.getDay()
  return dayShift(day,-((weekday+6)%7))
}
export function orderStage(order:WorkItem,workspace:WorkspaceData):string{
  const flow=asRecord(asRecord(asRecord(workspace.ops).flows)[order.id])
  if(typeof flow.stage==="string")return flow.stage
  return order.status==="待评审"?"review":order.status==="草稿"?"draft":"approved"
}
export interface GanttEntry {
  id:string;orderId:string;type:string;lane:string;start:string;duration:number;source:string
}
export function scheduleEntries(workspace:WorkspaceData):GanttEntry[]{
  const rows=asRows(asRecord(workspace.ops).gantt)
  const known=new Set((workspace.orders??[]).map(o=>o.id))
  return rows.flatMap((record):GanttEntry[]=>{
    const orderId=text(record.orderId),start=text(record.start)
    const duration=quantity(record.duration)
    if(!known.has(orderId)||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(start)||
      !Number.isFinite(new Date(start).getTime())||duration<=0)return []
    return [{
      id:text(record.id)||`${orderId}-${start}-${text(record.type)}`,
      orderId,type:text(record.type),lane:text(record.lane),
      start,duration,source:text(record.source)
    }]
  }).sort((a,b)=>a.start.localeCompare(b.start))
}
const doneStages=new Set(["delivered"])
const inProduction=new Set(["blending","semi_qc","semi_ok","packaging","final_qc","inspected","released"])
const waitingDispatch=new Set(["stored","dispatch","shipping","shipped"])
export interface DonutSegment {
  id:"production"|"waiting"|"shipping"|"attention"
  label:string;count:number;color:string;route:string
}
export function orderSegments(workspace:WorkspaceData,today=dayString(new Date())):DonutSegment[]{
  const orders=(workspace.orders??[]).filter(o=>!doneStages.has(orderStage(o,workspace)))
  let production=0,waiting=0,shipping=0,attention=0
  for(const order of orders){
    const stage=orderStage(order,workspace)
    const status=text(order.status)
    const due=validDay(order.deliveryDate??order.dueDate??order.deadline??order.deliveryDue)
    const risky=/异常|驳回|取消|退回|冻结|暂停|重新排程/.test(status)||
      (due!==null&&due<today)
    if(risky)attention++
    else if(waitingDispatch.has(stage))shipping++
    else if(inProduction.has(stage))production++
    else waiting++
  }
  return [
    {id:"production",label:"生产中 / 待检",count:production,color:"#648b75",route:"#/departments/production/tasks"},
    {id:"waiting",label:"待生产 / 待排程",count:waiting,color:"#a6c4ab",route:"#/departments/pmc/schedule"},
    {id:"shipping",label:"待发货 / 待交付",count:shipping,color:"#d2ae6f",route:"#/departments/warehouse/warehouseOutbound"},
    {id:"attention",label:"异常 / 已逾期",count:attention,color:"#bd8580",route:"#/departments/sales/orders"}
  ]
}
export interface StockShortage {
  material:string;required:number;available:number;missing:number;unit:string
}
/** Estimate production material demand using the same BOM coefficients as operations.js.
 * This is a planning estimate, not a final frozen/allocated warehouse balance. */
export function stockShortages(workspace:WorkspaceData):StockShortage[]{
  const ops=asRecord(workspace.ops),stock=asRecord(ops.stock)
  if(!Object.keys(stock).length)return []
  const bom=asRows(ops.bom)
  const ratio=(material:string,fallback:number)=>{
    const found=bom.find(row=>row.child===material)
    return found&&quantity(found.qty)>0?quantity(found.qty):fallback
  }
  const raw=ratio("RM-001",.1),pack=ratio("PK-001",.25)
  const planningStages=new Set(["approved","trial","formal","reserved"])
  const candidates=(workspace.orders??[]).filter(o=>planningStages.has(orderStage(o,workspace)))
  if(!candidates.length)return []
  const totalQty=candidates.reduce((sum,o)=>sum+Math.max(0,quantity(o.qty)),0)
  return [
    {material:"RM-001",ratio:raw,unit:"kg"},
    {material:"PK-001",ratio:pack,unit:"个"}
  ].flatMap(({material,ratio,unit}):StockShortage[]=>{
    if(!(material in stock))return []
    const required=candidates.reduce((sum,o)=>sum+Math.ceil(Math.max(0,quantity(o.qty))*ratio),0)
    const available=Math.max(0,quantity(stock[material]))
    const missing=Math.max(0,required-available)
    if(!missing||totalQty<=0)return []
    return [{material,required,available,missing,unit}]
  }).sort((a,b)=>b.missing-a.missing)
}
export interface DashboardAlert {
  id:string;severity:"high"|"medium"|"low"
  title:string;detail:string;route:string;kind:string
}
function dateDiff(from:string,to:string):number{
  const left=new Date(from+"T12:00:00"),right=new Date(to+"T12:00:00")
  return Math.round((right.getTime()-left.getTime())/86400000)
}
export function dashboardAlerts(workspace:WorkspaceData,today=dayString(new Date())):DashboardAlert[]{
  const ops=asRecord(workspace.ops),modules=asRecord(workspace.modules)
  const alerts:DashboardAlert[]=[]
  for(const item of stockShortages(workspace)){
    alerts.push({
      id:`shortage-${item.material}`,severity:"high",kind:"物料",
      title:`物料缺口 · ${item.material}`,
      detail:`按待生产订单及 BOM 估算，需 ${item.required}、现存 ${item.available}，差 ${item.missing} ${item.unit}`,
      route:"#/departments/pmc/kitting"
    })
  }
  for(const order of workspace.orders??[]){
    if(orderStage(order,workspace)==="delivered")continue
    const due=validDay(order.deliveryDate??order.dueDate??order.deadline??order.deliveryDue)
    if(!due)continue
    const days=dateDiff(today,due)
    if(days>3)continue
    alerts.push({
      id:`due-${order.id}`,severity:days<0?"high":"medium",kind:"订单",
      title:days<0?`订单逾期 · ${order.id}`:`交期临近 · ${order.id}`,
      detail:days<0?`已超过交期 ${-days} 天（${due}）`:
        days===0?"交期是今天":`距离交期还有 ${days} 天（${due}）`,
      route:"#/departments/sales/orders"
    })
  }
  const inspections=asRows(modules.inspections).filter(x=>x.status==="待判定")
  const clean=asRows(modules.cleanReports).filter(x=>x.status==="待判定")
  const ncr=asRows(modules.ncr).filter(x=>x.status==="待处置")
  const qualityCount=inspections.length+clean.length+ncr.length
  if(qualityCount)alerts.push({
    id:"quality-pending",severity:"medium",kind:"质量",
    title:`质量待处理 ${qualityCount} 项`,
    detail:`报检待判定 ${inspections.length} · 清洗报检 ${clean.length} · 不合格待处置 ${ncr.length}`,
    route:"#/departments/quality/qaQc"
  })
  const purchases=asRows(ops.purchases).filter(x=>x.status==="待审批")
  if(purchases.length)alerts.push({
    id:"purchase-approval",severity:"medium",kind:"采购",
    title:`采购单待审批 ${purchases.length} 项`,
    detail:purchases.slice(0,2).map(x=>text(x.id)).join("、")+" · 等待采购主管处理",
    route:"#/departments/purchase/purchase"
  })
  const maintenance=(workspace.tasks??[]).filter(x=>/维护|保养|检修/.test(text(x.type))&&
    !/已完成|已取消/.test(text(x.status)))
  const dueMaintenance=maintenance.filter(item=>{
    const due=validDay(item.dueDate??item.deadline)
    return due!==null&&dateDiff(today,due)<=2
  })
  if(dueMaintenance.length)alerts.push({
    id:"equipment-due",severity:"medium",kind:"设备",
    title:`设备维护临期 ${dueMaintenance.length} 项`,
    detail:dueMaintenance.slice(0,2).map(x=>text(x.line||x.id)).join("、"),
    route:"#/departments/engineering/engineering"
  })
  const tasks=(workspace.tasks??[]).filter(x=>x.status==="待复核")
  if(tasks.length)alerts.push({
    id:"task-review",severity:"low",kind:"生产",
    title:`任务等待复核 ${tasks.length} 项`,
    detail:tasks.slice(0,2).map(x=>`${x.id} ${text(x.type)}`).join("、"),
    route:"#/departments/production/tasks"
  })
  const weight={high:0,medium:1,low:2}
  return alerts.sort((a,b)=>weight[a.severity]-weight[b.severity)
}
function completedToday(workspace:WorkspaceData,day:string):number{
  const modules=asRecord(workspace.modules)
  return asRows(modules.batches).filter(record=>
    /已完成|已入库|完工/.test(text(record.status))&&
    [record.completedAt,record.finishedAt,record.endedAt,record.finishAt].some(value=>validDay(value)===day)
  ).length
}
export interface OverviewMetrics{
  activeOrders:number
  pendingTasks:number
  reviewTasks:number
  todayProduction:number
  todaySchedule:number
  productionTasks:number
  stockWarnings:number
  newTasksToday:number|null
  alerts:DashboardAlert[]
  segments:DonutSegment[]
  gantt:GanttEntry[]
}
export function overviewMetrics(workspace:WorkspaceData,today=dayString(new Date())):OverviewMetrics{
  const depts=["hr","sales","pmc","purchase","warehouse","quality","production","engineering","finance","it","leadership"]
  const todos=depts.flatMap(d=>getTodos(d,workspace))
  const schedule=scheduleEntries(workspace)
  const warnings=stockShortages(workspace)
  // Unknown creation timestamps must not be interpreted as zero new tasks.
  const created=workspace.tasks?.filter(t=>validDay(t.createdAt??t.createdOn)===today).length??0
  const knownCreated=(workspace.tasks??[]).some(t=>validDay(t.createdAt??t.createdOn)!==null)
  return {
    activeOrders:(workspace.orders??[]).filter(o=>orderStage(o,workspace)!=="delivered").length,
    pendingTasks:todos.length,
    reviewTasks:todos.filter(x=>todoLane(x.status)==="review").length,
    todayProduction:completedToday(workspace,today),
    todaySchedule:schedule.filter(e=>e.start.slice(0,10)===today&&["配制","包装"].includes(e.type)).length,
    productionTasks:(workspace.tasks??[]).filter(t=>t.category==="生产任务").length,
    stockWarnings:warnings.length,
    newTasksToday:knownCreated?created:null,
    alerts:dashboardAlerts(workspace,today),
    segments:orderSegments(workspace,today),
    gantt:schedule
  }
}
