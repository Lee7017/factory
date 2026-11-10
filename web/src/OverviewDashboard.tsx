import { useMemo, useState, type CSSProperties } from "react"
import {
  AlertTriangle, ArrowRight, Boxes, ChevronLeft, ChevronRight,
  ClipboardList, Factory, Info, ListTodo, Sparkles
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { WorkspaceData } from "@/factory-state"
import {
  dayShift,dayString,weekStart,overviewMetrics,orderStage,scheduleEntries,
  type GanttEntry,type DashboardAlert,type DonutSegment
} from "@/overview-data"

type Props={workspace:WorkspaceData;onSelect:(hash:string)=>void;onRefresh:()=>void}
type View="day"|"week"|"month"
const two=(value:number)=>String(value).padStart(2,"0")
const shortDate=(date:string)=>`${Number(date.slice(5,7))}/${Number(date.slice(8,10))}`
const weekdays=["周日","周一","周二","周三","周四","周五","周六"]
const startMonth=(day:string)=>day.slice(0,7)+"-01"
const newDay=(day:string)=>new Date(day+"T12:00:00")
function periodFor(day:string,view:View){
  const first=view==="day"?day:view==="week"?weekStart(day):startMonth(day)
  const days=view==="day"?1:view==="week"?7:
    new Date(Number(day.slice(0,4)),Number(day.slice(5,7)),0).getDate()
  const end=dayShift(first,days)
  const cells=view==="day"?Array.from({length:8},(_,i)=>({
    key:`h${i}`,label:`${two(i*3)}:00`,sub:""
  })):
  Array.from({length:days},(_,i)=>{
    const date=dayShift(first,i)
    return {key:date,label:view==="month"?String(i+1):shortDate(date),
      sub:view==="month"?"":weekdays[newDay(date).getDay()]}
  })
  const title=view==="day"?day.replaceAll("-"," / "):
    view==="week"?`${shortDate(first)} – ${shortDate(dayShift(first,6))}`:
      `${day.slice(0,4)}年${Number(day.slice(5,7))}月`
  return {first,days,end,cells,title,
    startMs:new Date(first+"T00:00:00").getTime(),
    endMs:new Date(end+"T00:00:00").getTime()}
}
const types:Record<string,{label:string;className:string}>={
  "配制":{label:"配制",className:"make"},
  "包装":{label:"包装",className:"pack"},
  "清洗":{label:"清洗",className:"clean"},
  "调机调线":{label:"调线",className:"change"},
  "半成品 QC":{label:"半成品 QC",className:"quality"},
  "成品 QC":{label:"成品 QC",className:"quality"},
  "QA 放行":{label:"QA 放行",className:"quality"}
}
function chartBar(entry:GanttEntry,period:ReturnType<typeof periodFor>,index:number){
  const start=new Date(entry.start).getTime()
  const end=start+entry.duration*60000
  if(end<=period.startMs||start>=period.endMs)return null
  const len=period.endMs-period.startMs
  const left=Math.max(0,(start-period.startMs)/len)*100
  const physicalWidth=(Math.min(end,period.endMs)-Math.max(start,period.startMs))/len*100
  const minWidth=period.days===1?5:period.days===7?7.5:1.45
  return {left:`${left}%`,width:`${Math.min(100-left,Math.max(physicalWidth,minWidth))}%`,
    top:index%2===0?"7px":"29px"}
}
function GanttPanel({workspace,onSelect}:{workspace:WorkspaceData;onSelect:Props["onSelect"]}){
  const [view,setView]=useState<View>("week")
  const [day,setDay]=useState(()=>dayString(new Date()))
  const [expanded,setExpanded]=useState(false)
  const period=useMemo(()=>periodFor(day,view),[day,view])
  const saved=scheduleEntries(workspace)
  const validIds=new Set((workspace.orders??[]).map(o=>o.id))
  const displayed=saved.filter(e=>validIds.has(e.orderId)&&
    new Date(e.start).getTime()<period.endMs&&
    new Date(e.start).getTime()+e.duration*60000>period.startMs)
  const makeTypes=new Set(["配制","包装","清洗","调机调线","半成品 QC","成品 QC","QA 放行"])
  const visibleOrders=(workspace.orders??[]).filter(o=>orderStage(o,workspace)!=="delivered"||
    saved.some(e=>e.orderId===o.id))
  const unscheduled=visibleOrders.filter(o=>!saved.some(e=>e.orderId===o.id)).length
  const list=expanded?visibleOrders:visibleOrders.slice(0,4)
  const cellStyle={gridTemplateColumns:`repeat(${period.cells.length},minmax(0,1fr))`} as CSSProperties
  const go=(direction:number)=>{
    if(view==="month"){
      const date=newDay(day);date.setMonth(date.getMonth()+direction)
      setDay(dayString(date))
    }else setDay(dayShift(day,direction*(view==="week"?7:1)))
  }
  return <Card className="glass-panel overview-gantt-panel" aria-label="生产排程甘特图">
    <div className="overview-section-head">
      <div>
        <h2>生产排程甘特图 <span className="overview-muted-label">（{view==="day"?"当日":view==="week"?"本周":"本月"}）</span></h2>
        <p>实际订单与排程记录 · 点击任务查看 PMC 排程</p>
      </div>
      <div className="overview-view-buttons" role="group" aria-label="排程视图">
        {([["day","日视图"],["week","周视图"],["month","月视图"]] as const).map(([id,label])=>
          <button type="button" key={id} aria-pressed={view===id} onClick={()=>{setView(id);setExpanded(false)}}>{label}</button>)}
      </div>
    </div>
    <div className="overview-period-controls">
      <div className="overview-period-picker">
        <Button variant="ghost" size="icon-xs" aria-label="上一时间段" onClick={()=>go(-1)}><ChevronLeft size={14}/></Button>
        <span className="overview-period-title">{period.title}</span>
        <Button variant="ghost" size="icon-xs" aria-label="下一时间段" onClick={()=>go(1)}><ChevronRight size={14}/></Button>
        <button type="button" className="overview-today" onClick={()=>setDay(dayString(new Date()))}>今天</button>
      </div>
      <div className="overview-gantt-legend">
        <span><i className="make"/>配制</span><span><i className="pack"/>包装</span><span><i className="quality"/>质检</span>
      </div>
    </div>
    <div className="overview-gantt-scroller" role="region" aria-label="排程时间轴" tabIndex={0}>
      <div className="overview-gantt-layout" style={{minWidth:view==="month"?"1180px":view==="week"?"660px":"640px"}}>
        <div className="overview-gantt-row overview-gantt-head">
          <div>订单 / 产品</div><div>产线</div>
          <div className="overview-gantt-dates" style={cellStyle}>
            {period.cells.map(c=><div key={c.key} className={c.key===dayString(new Date())?"is-today":""}>
              <strong>{c.label}</strong>{c.sub&&<small>{c.sub}</small>}
            </div>)}
          </div>
        </div>
        {list.length===0?<div className="overview-empty-gantt">
          当前没有进行中的订单。可在销售部创建订单，再由 PMC 安排生产。
        </div>:list.map(o=>{
          const entries=displayed.filter(e=>e.orderId===o.id&&makeTypes.has(e.type))
          const all=saved.filter(e=>e.orderId===o.id&&makeTypes.has(e.type))
          const line=entries.find(e=>e.type==="配制")?.lane??entries[0]?.lane??all[0]?.lane??"待指派"
          return <div className="overview-gantt-row overview-gantt-data" key={o.id}>
            <button type="button" className="overview-gantt-order" onClick={()=>onSelect("#/departments/sales/orders")}>
              <strong title={o.id}>{o.id}</strong>
              <small title={o.product??""}>{o.product??"未填写产品"} · {String(o.qty??"—")} {String(o.unit??"")}</small>
            </button>
            <div className="overview-gantt-lane" title={line}>{line}</div>
            <div className="overview-gantt-track" style={{"--grid-columns":period.cells.length} as CSSProperties}>
              {entries.length===0?<span className="overview-unscheduled">{all.length===0?"尚未排程":"本时间段无任务"}</span>:
                entries.map((entry,i)=>{
                  const position=chartBar(entry,period,i)
                  if(!position)return null
                  const kind=types[entry.type]??{label:entry.type,className:"other"}
                  const draft=entry.source==="订单排程"
                  return <button type="button" key={entry.id}
                    className={`overview-gantt-bar ${kind.className} ${draft?"draft":""}`}
                    style={position} onClick={()=>onSelect("#/departments/pmc/schedule")}
                    title={`${o.id} · ${entry.type} · ${entry.lane} · ${entry.start.replace("T"," ")}（${entry.duration}分钟）${draft?" · 系统排程草案":""}`}
                    aria-label={`${entry.type}：${o.id}，${entry.start}，${entry.duration}分钟`}>
                    {kind.label}
                  </button>
                })}
            </div>
          </div>
        })}
      </div>
    </div>
    <div className="overview-gantt-foot">
      <span>{unscheduled>0&&<><strong>待排程 {unscheduled} 单</strong> · </>}
        {displayed.length?<>本时间段 <strong>{displayed.length}</strong> 项排程 · {displayed.some(e=>e.source==="订单排程")?"含系统草案":"来自已保存记录"}</>:
        "本时间段尚无已保存排程，不自动编造任务日期"}</span>
      {visibleOrders.length>4&&<button type="button" onClick={()=>setExpanded(x=>!x)}>{expanded?"收起订单":`查看全部 ${visibleOrders.length} 单`}</button>}
      <button type="button" className="overview-link" onClick={()=>onSelect("#/departments/pmc/schedule")}>打开排程 <ArrowRight size={13}/></button>
    </div>
  </Card>
}
function OrderDonut({segments,onSelect}:{segments:DonutSegment[];onSelect:Props["onSelect"]}){
  const total=segments.reduce((n,x)=>n+x.count,0)
  const radius=51,circumference=2*Math.PI*radius
  let offset=0
  return <Card className="glass-panel overview-donut-panel" aria-label="订单进度分布">
    <div className="overview-section-head overview-compact-head">
      <h2>订单进度概览</h2>
      <span className="overview-source-label">当前订单</span>
    </div>
    <div className="overview-donut-layout">
      <div className="overview-donut-chart">
        <svg viewBox="0 0 150 150" role="img" aria-label={`进行中订单共 ${total} 单，${segments.map(x=>x.label+x.count+"单").join("，")}`}>
          <circle cx="75" cy="75" r={radius} fill="none" stroke="#e4ebe4" strokeWidth="20"/>
          {segments.map(part=>{
            const length=total?part.count/total*circumference:0
            const dash=length===circumference?circumference-.001:length
            const circle=<circle key={part.id} cx="75" cy="75" r={radius} fill="none"
              stroke={part.color} strokeWidth="20"
              strokeDasharray={`${dash} ${circumference}`}
              strokeDashoffset={-offset} transform="rotate(-90 75 75)"/>
            offset+=length
            return circle
          })}
          <text x="75" y="72" textAnchor="middle" className="overview-donut-value">{total}</text>
          <text x="75" y="90" textAnchor="middle" className="overview-donut-caption">进行中</text>
        </svg>
      </div>
      <div className="overview-donut-legend">
        {segments.map(part=><button type="button" key={part.id} onClick={()=>onSelect(part.route)}
          aria-label={`查看${part.label}订单`}>
          <i style={{background:part.color}}/>
          <span>{part.label}</span>
          <strong>{part.count}</strong>
          <small>{total?`${Math.round(part.count/total*100)}%`:"0%"}</small>
        </button>)}
      </div>
    </div>
  </Card>
}
function AlertsPanel({alerts,onSelect}:{alerts:DashboardAlert[];onSelect:Props["onSelect"]}){
  const [all,setAll]=useState(false)
  const items=all?alerts:alerts.slice(0,3)
  return <Card className="glass-panel overview-alerts-panel" aria-label="关键预警">
    <div className="overview-section-head overview-compact-head">
      <h2>关键预警 <span className="overview-alert-count">{alerts.length}</span></h2>
      {alerts.length>3&&<button type="button" onClick={()=>setAll(x=>!x)}>{all?"收起":"查看全部"} <ChevronRight size={13}/></button>}
    </div>
    <div className="overview-alert-list">
      {items.length===0?<p className="overview-no-alerts">当前记录中暂无已识别的库存、交期或质量预警。</p>:
        items.map(alert=><button type="button" key={alert.id} className="overview-alert-row"
          onClick={()=>onSelect(alert.route)} aria-label={`查看${alert.title}`}>
          <span className={`overview-alert-indicator ${alert.severity}`}>
            {alert.severity==="high"?<AlertTriangle size={13}/>:<Info size={13}/>}
          </span>
          <span className="overview-alert-copy"><strong>{alert.title}</strong><small>{alert.detail}</small></span>
          <ChevronRight className="overview-alert-chevron" size={15}/>
        </button>)}
    </div>
    <div className="overview-alert-note">基于当前订单、BOM、库存、采购与质检记录；不含设备实时传感器数据</div>
  </Card>
}
type Agent={
  id:string;name:string;animal:string;kind:"单实例"|"多实例";role:string;
  detail:string;route:string;routeLabel:string
}
const agents:Agent[]=[
  {id:"bear",name:"小熊管家",animal:"🐻",kind:"单实例",
    role:"工厂运营管家",detail:"统筹跨部门异常、经营待办与运行信息。",
    route:"#/departments/leadership/approvals",routeLabel:"查看总经办审批"},
  {id:"cat",name:"小猫保姆",animal:"🐱",kind:"单实例",
    role:"生产现场助手",detail:"协助跟进生产任务和现场待处理事项。",
    route:"#/departments/production/tasks",routeLabel:"查看生产任务"},
  {id:"bee",name:"蜂群计划员",animal:"🐝",kind:"多实例",
    role:"多订单排程与优化",detail:"规划多订单的产线分配、时间安排和计划变更。",
    route:"#/departments/pmc/schedule",routeLabel:"查看 PMC 排程"},
  {id:"ant",name:"蚁群物料员",animal:"🐜",kind:"多实例",
    role:"物料齐套与库存协同",detail:"协调订单物料需求、备料及库存风险。",
    route:"#/departments/warehouse/warehousePick",routeLabel:"查看仓库备料"},
  {id:"bird",name:"鸟群调度员",animal:"🐦",kind:"多实例",
    role:"跨产线任务与负载平衡",detail:"协助多产线任务分配、班次与进度协调。",
    route:"#/departments/pmc/shift",routeLabel:"查看排班编排"}
]
function AgentCenter({onSelect}:{onSelect:Props["onSelect"]}){
  const [selected,setSelected]=useState<Agent|null>(null)
  return <section className="glass-panel overview-agent-panel" aria-label="AI Agent 智能协同中心">
    <div className="overview-section-head overview-agent-head">
      <div>
        <h2><Sparkles size={17} className="overview-agent-sparkle"/> AI Agent 智能协同中心</h2>
        <p>预设协作角色 · 当前尚未连接 Agent 运行服务</p>
      </div>
      <span className="overview-agent-connection">服务未连接</span>
    </div>
    <div className="overview-agent-grid">
      {agents.map(agent=><button type="button" key={agent.id} className={`overview-agent-card agent-${agent.id}`}
        onClick={()=>setSelected(agent)} aria-label={`查看${agent.name}详情`}>
        <span className="overview-agent-avatar" role="img" aria-label={agent.name}>{agent.animal}</span>
        <span className="overview-agent-body">
          <span className="overview-agent-name">{agent.name}<em>{agent.kind}</em></span>
          <span className="overview-agent-role">{agent.role}</span>
          <span className="overview-agent-status"><i/>未连接{agent.kind==="多实例"?" · 实例数 —":""}</span>
        </span>
      </button>)}
    </div>
    <Dialog open={selected!==null} onOpenChange={open=>{if(!open)setSelected(null)}}>
      <DialogContent className="glass-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><span role="img">{selected?.animal}</span>{selected?.name}</DialogTitle>
          <DialogDescription>{selected?.kind} Agent · 当前未连接运行服务</DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{selected?.detail}</p>
        <p className="text-xs text-muted-foreground">此处为预设角色展示。尚无运行状态、在线实例或自动执行能力，不会自动修改业务数据。</p>
        <Button variant="outline" onClick={()=>{
          if(selected){onSelect(selected.route);setSelected(null)}
        }}>{selected?.routeLabel} <ArrowRight size={14}/></Button>
      </DialogContent>
    </Dialog>
  </section>
}
export function OverviewDashboard({workspace,onSelect}:Props){
  const today=dayString(new Date())
  const metrics=useMemo(()=>overviewMetrics(workspace,today),[workspace,today])
  const kpis=[
    {id:"orders",label:"进行中订单",value:metrics.activeOrders,unit:"单",icon:ClipboardList,
      detail:`全部订单 ${workspace.orders?.length??0} 单 · 已交付 ${Math.max(0,(workspace.orders?.length??0)-metrics.activeOrders)} 单`,
      note:"订单进度",route:"#/departments/sales/orders"},
    {id:"pending",label:"待处理任务",value:metrics.pendingTasks,unit:"项",icon:ListTodo,
      detail:`其中待审核 / 复核 ${metrics.reviewTasks} 项`,
      note:metrics.newTasksToday===null?"今日新增：无完整时间记录":`今日新增 ${metrics.newTasksToday} 项`,
      route:"#/departments/production/tasks"},
    {id:"today",label:"今日生产",value:metrics.todayProduction,unit:"批",icon:Factory,
      detail:`今日排程 ${metrics.todaySchedule} 项 · 生产任务 ${metrics.productionTasks} 项`,
      note:"按已记录的当日完工批次",route:"#/departments/production/batch"},
    {id:"stock",label:"库存预警",value:metrics.stockWarnings,unit:"项",icon:Boxes,
      detail:metrics.stockWarnings?"待生产订单预计物料缺口":"未识别到待生产物料缺口",
      note:"按 BOM 与当前现存库存估算",route:"#/departments/pmc/kitting"}
  ]
  return <div className="operations-dashboard">
    <section className="dashboard-kpis overview-kpi-grid" aria-label="核心运营指标">
      {kpis.map(item=><Card key={item.id} className={`glass-panel kpi-card overview-kpi-card metric-${item.id}`}>
        <button type="button" onClick={()=>onSelect(item.route)} aria-label={`查看${item.label}详情`}>
          <span className="overview-kpi-icon"><item.icon size={22} strokeWidth={1.8}/></span>
          <span className="overview-kpi-data">
            <span className="overview-kpi-label">{item.label}</span>
            <span className="overview-kpi-number"><strong className="kpi-value">{String(item.value).padStart(2,"0")}</strong><em>{item.unit}</em></span>
            <span className="overview-kpi-detail">{item.detail}</span>
            <span className="overview-kpi-note">{item.note}</span>
          </span>
        </button>
      </Card>)}
    </section>
    <div className="overview-analysis-grid">
      <GanttPanel workspace={workspace} onSelect={onSelect}/>
      <div className="overview-analysis-side">
        <OrderDonut segments={metrics.segments} onSelect={onSelect}/>
        <AlertsPanel alerts={metrics.alerts} onSelect={onSelect}/>
      </div>
    </div>
    <AgentCenter onSelect={onSelect}/>
  </div>
}
