import { useCallback, useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react"
import { createPortal } from "react-dom"
import { AlertCircle, LoaderCircle, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { FactoryAccessAPI } from "@/factory-state"
import { getBusinessRuntime } from "@/business/runtime"
import { BusinessMarkup } from "@/business/BusinessMarkup"

type Props={
  dept:string;feature:string;access:FactoryAccessAPI
  onRoute:(hash:string)=>void;onRefresh:()=>void
}
export function NativeBusiness({dept,feature,access,onRoute,onRefresh}:Props){
  const [markup,setMarkup]=useState("")
  const [status,setStatus]=useState<"loading"|"ready"|"error">("loading")
  const [error,setError]=useState("")
  const [toast,setToast]=useState("")
  const [reload,setReload]=useState(0)
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
  return <section className="native-business" aria-label="业务工作区">
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
