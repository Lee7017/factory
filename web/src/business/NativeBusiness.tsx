import { useCallback, useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react"
import { createPortal } from "react-dom"
import { AlertCircle, LoaderCircle, Plus, RotateCcw, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { FactoryAccessAPI } from "@/factory-state"
import { getBusinessRuntime } from "@/business/runtime"
import { BusinessMarkup } from "@/business/BusinessMarkup"
import { FEATURE_NAMES } from "@/catalog"

type Props={
  dept:string;feature:string;access:FactoryAccessAPI
  onRoute:(hash:string)=>void;onRefresh:()=>void
}

function compactBusinessStatus(value:string){
  const text=value.trim().replace(/\s+/g," ")
  if(!text)return ""
  if(text.includes("部分发货"))return "部分出库"
  if(text.includes("部分出库"))return "部分出库"
  if(text.includes("库存不足"))return "库存不足"
  if(text.includes("待出库"))return "待出库"
  if(text.includes("已发货"))return "已发货"
  if(text.includes("已交付"))return "已交付"
  if(text.includes("已完成"))return "已完成"
  if(text.includes("待审批"))return "待审批"
  if(text.includes("待质检"))return "待质检"
  if(text.includes("待登记"))return "待登记"
  if(text.includes("待备料"))return "待备料"
  if(text.includes("备料中"))return "备料中"
  if(text.includes("待接收"))return "待接收"
  if(text.includes("待判定"))return "待判定"
  if(text.includes("待抽检"))return "待抽检"
  if(text.includes("待处置"))return "待处置"
  if(text.includes("待开始"))return "待开始"
  if(text.includes("执行中"))return "执行中"
  const bracket=text.indexOf("（")
  return (bracket>0?text.slice(0,bracket):text).slice(0,12)
}
const fallbackContextStatuses:Record<string,string[]>={
  orders:["待评审","已评审","生产中"],
  orderReview:["待评审","已评审"],
  orderHistory:["已交付"],
  kitting:["待齐套","已齐套"],
  purchase:["待审批","采购中","已完成"],
  warehouseIncoming:["待登记","待质检","已完成"],
  warehousePick:["待备料","备料中","已完成"],
  warehouseOutbound:["待出库","部分出库","已交付"],
  warehouseReturns:["待接收","处理中","已完成"],
  qaQc:["待判定","处理中","已完成"],
  qaSampling:["待抽检","处理中","已完成"],
  qaCleanInspection:["待判定","处理中","已完成"],
  qaNcr:["待处置","处理中","已完成"],
  tasks:["待开始","生产中","已完成"],
  nonProductionTasks:["待开始","执行中","已完成"]
}

export function NativeBusiness({dept,feature,access,onRoute,onRefresh}:Props){
  const [markup,setMarkup]=useState("")
  const [status,setStatus]=useState<"loading"|"ready"|"error">("loading")
  const [error,setError]=useState("")
  const [toast,setToast]=useState("")
  const [reload,setReload]=useState(0)
  const [contextQuery,setContextQuery]=useState("")
  const [contextStatus,setContextStatus]=useState("")
  const [contextStatuses,setContextStatuses]=useState<string[]>([])
  const [contextStatusCounts,setContextStatusCounts]=useState<Record<string,number>>({})
  const [toolHost,setToolHost]=useState<HTMLElement|null>(null)
  const rootRef=useRef<HTMLDivElement>(null)
  const render=useCallback(async()=>{
    const runtime=await getBusinessRuntime()
    setMarkup(runtime.render())
    onRefresh()
  },[onRefresh])
  useEffect(()=>{
    let disposed=false
    setStatus("loading")
    getBusinessRuntime().then(runtime=>{
      if(disposed)return
      runtime.mount(feature,dept,access,{
        render:()=>{void render()},
        navigate:onRoute,refresh:onRefresh,
        notify:message=>{setToast(message);onRefresh()}
      })
      setMarkup(runtime.render())
      setStatus("ready")
      onRefresh()
    }).catch(reason=>{
      if(disposed)return
      console.error("MES workbench failed to initialize",reason)
      setError(reason instanceof Error?reason.message:String(reason))
      setStatus("error")
    })
    return ()=>{disposed=true}
  },[dept,feature,access,onRoute,onRefresh,render,reload])
  useEffect(()=>{
    setContextQuery("")
    setContextStatus("")
    setContextStatuses([])
    setContextStatusCounts({})
    setToolHost(document.getElementById("business-context-tools-host"))
  },[dept,feature])

  useEffect(()=>{
    if(status!=="ready")return
    const root=rootRef.current
    if(!root)return
    const panel=root.querySelector<HTMLElement>(".biz-order-panel")
    const rows=panel
      ?Array.from(panel.querySelectorAll<HTMLElement>(".biz-order-row"))
      :Array.from(root.querySelectorAll<HTMLElement>("tbody tr"))
    if(panel){
      const counts=new Map<string,number>()
      for(const row of rows){
        const group=compactBusinessStatus(row.dataset.orderStatus??"")
        if(group)counts.set(group,(counts.get(group)??0)+1)
      }
      const actual=Array.from(counts.entries()).sort((a,b)=>b[1]-a[1]).map(([name])=>name).slice(0,3)
      const options=actual.length?actual:(fallbackContextStatuses[feature]??[])
      const countRecord=Object.fromEntries(options.map(name=>[name,counts.get(name)??0]))
      setContextStatuses(current=>current.join("\u0000")===options.join("\u0000")?current:options)
      setContextStatusCounts(current=>JSON.stringify(current)===JSON.stringify(countRecord)?current:countRecord)
      if(contextStatus&&!options.includes(contextStatus))setContextStatus("")
    }else{
      const options=fallbackContextStatuses[feature]??[]
      const countRecord=Object.fromEntries(options.map(name=>[name,0]))
      setContextStatuses(current=>current.join("\u0000")===options.join("\u0000")?current:options)
      setContextStatusCounts(current=>JSON.stringify(current)===JSON.stringify(countRecord)?current:countRecord)
      if(contextStatus&&!options.includes(contextStatus))setContextStatus("")
    }
    const needle=contextQuery.trim().toLocaleLowerCase()
    let visible=0
    for(const row of rows){
      const raw=row.dataset.orderStatus??""
      const statusMatch=!contextStatus||compactBusinessStatus(raw)===contextStatus
      const searchMatch=!needle||(row.textContent??"").toLocaleLowerCase().includes(needle)
      const show=statusMatch&&searchMatch
      row.hidden=!show
      if(show)visible++
    }
    const count=panel?.querySelector<HTMLElement>(".biz-order-visible-count")
    if(count)count.textContent=String(visible)
  },[status,markup,contextQuery,contextStatus,contextStatuses.length])

  // Track the exact document after React has committed the destination route's DOM.
  useEffect(()=>{
    if(status!=="ready")return
    let disposed=false
    void getBusinessRuntime().then(runtime=>{
      if(disposed)return
      const ref=runtime.consumeTracking(dept,feature)
      if(!ref)return
      const root=rootRef.current
      if(!root)return
      const needle=ref.trim()
      if(!needle)return
      const nodes=Array.from(root.querySelectorAll<HTMLElement>(
        "tbody tr,.dept-todo-card,.op-quality-link"
      ))
      const row=nodes.find(node=>node.textContent?.includes(needle))
      if(!row)return
      row.classList.remove("bottleneck-track-highlight")
      void row.offsetWidth
      row.classList.add("bottleneck-track-highlight")
      row.scrollIntoView({block:"center",behavior:"smooth"})
      window.setTimeout(()=>row.classList.remove("bottleneck-track-highlight"),3200)
    })
    return ()=>{disposed=true}
  },[dept,feature,status,markup])
  function handleClick(event:MouseEvent<HTMLDivElement>){
    const target=event.target
    if(!(target instanceof HTMLElement))return
    if(target.closest("[data-module-action],[data-op-action],[data-access-assign],[data-access-role],[data-access-personal]")){
      void getBusinessRuntime().then(runtime=>runtime.click(target))
    }
  }
  useEffect(()=>{
    const root=rootRef.current
    if(!root)return
    // The permission selects are created with innerHTML, not React DOM nodes.
    // Listen to their native change events directly to keep the old access matrix working.
    function handleNativeChange(event:Event){
      const el=event.target
      if(el instanceof HTMLSelectElement&&["perm-employee","perm-position","perm-dept"].includes(el.id))
        void getBusinessRuntime().then(runtime=>runtime.change(el.id,el.value))
    }
    root.addEventListener("change",handleNativeChange,true)
    return ()=>root.removeEventListener("change",handleNativeChange,true)
  },[])
  function handleSubmit(event:FormEvent<HTMLDivElement>){
    event.preventDefault()
    // Preserve the original validators and submit handlers; preventing default
    // immediately avoids a navigation before any async runtime resolution.
    void getBusinessRuntime().then(runtime=>runtime.submit(event.nativeEvent))
  }
  const contextPlaceholder="搜索"+(FEATURE_NAMES[feature]??"当前列表")
  return <section className="native-business" aria-label="业务工作区">
    {toolHost&&createPortal(
      <div className="business-context-tools">
        {dept==="sales"&&feature==="orders"&&<Button type="button" size="sm"
          className="business-context-create" aria-label="新建销售订单"
          disabled={!access.has("sales","orders","create")||status!=="ready"}
          onClick={()=>rootRef.current?.querySelector<HTMLButtonElement>(
            '.biz-order-panel[data-order-panel="orders"] [data-op-action="newOrder"]'
          )?.click()}>
          <Plus size={13}/><span className="create-label-full">新建销售订单</span><span className="create-label-short">新建</span>
        </Button>}
        {contextStatuses.length>0&&<div className="business-context-status" aria-label="当前列表状态">
          <button type="button" className={!contextStatus?"active":""} onClick={()=>setContextStatus("")}>全部</button>
          {contextStatuses.map(name=><button type="button" key={name} className={contextStatus===name?"active":""}
            onClick={()=>setContextStatus(name)}>{name}<span>{contextStatusCounts[name]??0}</span></button>)}
        </div>}
        <label className="business-context-search">
          <Search size={14}/><input type="search" value={contextQuery} onChange={event=>setContextQuery(event.target.value)}
            placeholder={contextPlaceholder} aria-label={contextPlaceholder}/>
        </label>
      </div>,
      toolHost
    )}
    {status==="loading"&&<div className="glass-panel flex items-center gap-3 rounded-xl p-5 text-sm text-muted-foreground" role="status">
      <LoaderCircle className="size-4 animate-spin"/>正在加载业务表单和原有权限规则…
    </div>}
    {status==="error"&&<div className="glass-panel flex items-center gap-3 rounded-xl p-5 text-sm text-red-700" role="alert">
      <AlertCircle size={18}/><span className="flex-1">{error}</span>
      <Button variant="outline" size="sm" onClick={()=>setReload(n=>n+1)}><RotateCcw size={14}/>重试</Button>
    </div>}
    <div ref={rootRef} className="legacy-root" style={{display:status==="ready"?"block":"none"}}
      onClick={handleClick} onSubmit={handleSubmit}>
      <div id="view" className="legacy-workbench"><BusinessMarkup markup={markup}/></div>
      <div id="modal-host"/>
      <div id="ops-modal-host"/>
      <div id="toast-host" aria-live="polite"/>
    </div>
    {toast&&<div className="fixed bottom-5 right-5 z-100 max-w-sm rounded-xl border border-green-200 bg-white/95 p-3 text-xs shadow-xl" role="status">
      {toast}<Button size="icon-xs" variant="ghost" onClick={()=>setToast("")} aria-label="关闭消息" className="ml-3">×</Button>
    </div>}
    {/* Quality inspection forms can be taller than the workbench. Their fixed modal
        must use the viewport as its containing block, not the transformed/clipped
        .business-page-body. React event handlers stay on this portal wrapper. */}
    {createPortal(
      <div className="legacy-root legacy-modules-portal-root"
        onClick={handleClick} onSubmit={handleSubmit}>
        <div id="modules-modal-host"/>
      </div>,
      document.body
    )}
    {/* Procurement receipt, PO and approval forms must not be contained by the business
        card. Keep the legacy CSS scope in a body portal; procurement.js already
        handles its native click and submit events on document. */}
    {createPortal(
      <div className="legacy-root legacy-proc-portal-root">
        <div id="proc-modal-host"/>
      </div>,
      document.body
    )}
    {/* A fixed flow window cannot live below .business-page-body (overflow and backdrop-filter
        make that ancestor clip/rebase the old animated journey). Keep the legacy CSS scope,
        but portal the one imperative host to the document body. */}
    {createPortal(
      <div className="legacy-root legacy-flow-portal-root">
        <div id="flow-transition-host" aria-live="polite"/>
      </div>,
      document.body
    )}
  </section>
}
