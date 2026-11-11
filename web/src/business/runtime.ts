import { readWorkspace, type FactoryAccessAPI, type WorkspaceData } from "@/factory-state"

type LegacyEl=HTMLElement
type BusinessEngine={
  init?: (ctx:BusinessContext)=>void
  render?: (feature:string)=>string
  supports?: (feature:string)=>boolean
  handleClick?: (element:LegacyEl)=>unknown
  submitForm?: (event:Event)=>boolean
  get state():unknown
}
interface BusinessContext{
  data:WorkspaceData
  save:()=>void
  access:FactoryAccessAPI
  toast:(message:string)=>void
  flashDenied:(element:HTMLElement)=>void
  render:()=>void
  openFeature:(feature:string,department:string,element?:HTMLElement)=>void
  ops:BusinessEngine
}
interface RuntimeWindow extends Window{
  FactoryOperations?:BusinessEngine
  FactoryModules?:BusinessEngine&{supports:(feature:string)=>boolean}
  FactoryGantt?:{init:(ctx:BusinessContext)=>void}
  FactoryProcurement?:Record<string,unknown>
  FactoryFlowUI?:Record<string,unknown>
  FactoryNavigation?:{trackBottleneck:(target:{dept:string;feature:string;record?:string},record?:string)=>void}
}
const runtimeWindow=window as RuntimeWindow
const scripts=["operations.js","gantt.js","modules.js","flow-ui.js","procurement.js"]
function loadScript(name:string):Promise<void>{
  return new Promise((resolve,reject)=>{
    const script=document.createElement("script")
    // Avoid stale browsers showing the previous flow button after a Pages deployment.
    script.src=`${import.meta.env.BASE_URL}legacy/${name}?v=20261111-workshop-split-v1`
    script.async=false
    script.onload=()=>resolve()
    script.onerror=()=>reject(new Error(`无法加载业务模块 ${name}`))
    document.head.appendChild(script)
  })
}
let loader:Promise<void>|undefined
async function ready():Promise<void>{
  if(!loader)loader=(async()=>{
    for(const name of scripts)await loadScript(name)
    if(!runtimeWindow.FactoryOperations?.init||!runtimeWindow.FactoryModules?.init)
      throw new Error("Legacy business engine initialization is missing")
  })().catch(error=>{loader=undefined;throw error})
  await loader
}
export type BusinessRuntime={
  activeFeature:string
  activeDept:string
  data:WorkspaceData
  access:FactoryAccessAPI
  mount:(feature:string,department:string,access:FactoryAccessAPI,callbacks:Callbacks)=>void
  render:()=>string
  click:(element:HTMLElement)=>void
  change:(id:string,value:string)=>void
  submit:(event:Event)=>boolean
  consumeTracking:(dept:string,feature:string)=>string|null
}
type Callbacks={
  render:()=>void
  notify:(message:string)=>void
  navigate:(hash:string)=>void
  refresh:()=>void
}
let singleton:(BusinessRuntime & {callbacks:Callbacks})|undefined
// Preserve original trackBottleneck semantics across an asynchronous React route mount.
let pendingTracking:{dept:string;feature:string;ref:string}|null=null

function markTrackedRow(root:ParentNode,ref:string):boolean {
  const needle=ref.trim()
  if(!needle)return false
  const matches=Array.from(root.querySelectorAll<HTMLElement>(
    "tbody tr,.dept-todo-card,.op-quality-link"
  ))
  const found=matches.find(node=>node.textContent?.includes(needle))
  if(!found)return false
  found.classList.remove("bottleneck-track-highlight")
  void found.offsetWidth
  found.classList.add("bottleneck-track-highlight")
  found.scrollIntoView({block:"center",behavior:"smooth"})
  window.setTimeout(()=>found.classList.remove("bottleneck-track-highlight"),3200)
  return true
}

export async function getBusinessRuntime():Promise<BusinessRuntime> {
  await ready()
  if(singleton)return singleton
  const data=readWorkspace()
  const ops=runtimeWindow.FactoryOperations!
  const modules=runtimeWindow.FactoryModules!
  const context:BusinessContext={
    data,
    access:null as unknown as FactoryAccessAPI,
    ops,
    save:()=>{
      localStorage.setItem("factory-workspace-v4",JSON.stringify(data))
      singleton?.callbacks.refresh()
    },
    toast:(message)=>singleton?.callbacks.notify(message),
    flashDenied:element=>{
      element.classList.add("access-denied-flash")
      window.setTimeout(()=>element.classList.remove("access-denied-flash"),850)
    },
    render:()=>singleton?.callbacks.render(),
    openFeature:(feature,department)=>singleton?.callbacks.navigate(`#/departments/${department}/${feature}`)
  }
  // Original source order is significant: procurement wraps Modules.init and
  // Gantt wraps Operations.render after both have been declared.
  const runtime={
    activeFeature:"",
    activeDept:"",
    data,
    get access(){return context.access},
    callbacks:{render:()=>{},notify:(_message:string)=>{},navigate:(_hash:string)=>{},refresh:()=>{}},
    mount(feature:string,department:string,access:FactoryAccessAPI,callbacks:Callbacks){
      runtime.activeFeature=feature;runtime.activeDept=department
      runtime.callbacks=callbacks
      context.access=access
      context.data.dept=department
      context.data.feature=feature
      context.data.home=false
      // Sync all React-owned records before rendering, without replacing
      // ops/modules: the original engines hold live references to those models.
      const current=readWorkspace()
      for(const field of ["orders","tasks","leaves","payroll","approvals","plans","offices","chatThreads","messages"]){
        if(current[field]!==undefined)context.data[field]=current[field]
      }
    },
    render(){
      const feature=runtime.activeFeature
      if(feature==="permissions")return runtime.access.render?.()??""
      if(modules.supports?.(feature))return modules.render?.(feature)??""
      return ops.render?.(feature)??""
    },
    click(element:HTMLElement){
      if(element.closest("[data-module-action]")){modules.handleClick?.(element.closest("[data-module-action]") as HTMLElement);return}
      if(element.closest("[data-op-action]")){ops.handleClick?.(element.closest("[data-op-action]") as HTMLElement);return}
      const permission=element.closest("[data-access-assign],[data-access-role],[data-access-personal]") as HTMLElement|null
      if(permission){
        const canUse=runtime.access.handleClick?.(permission)
        if(canUse)runtime.callbacks.render()
        else context.flashDenied(permission)
      }
    },
    change(id:string,selected:string){
      const mapping:Record<string,"employee"|"position"|"dept">={"perm-employee":"employee","perm-position":"position","perm-dept":"dept"}
      const field=mapping[id]
      if(field){runtime.access.updateSelection(field,selected);runtime.callbacks.render()}
    },
    submit(event:Event){
      if(modules.submitForm?.(event))return true
      if(ops.submitForm?.(event))return true
      return false
    },
    consumeTracking(dept:string,feature:string){
      if(!pendingTracking||pendingTracking.dept!==dept||pendingTracking.feature!==feature)return null
      const ref=pendingTracking.ref
      pendingTracking=null
      return ref
    }
  }
  const engine=runtime as unknown as BusinessRuntime & {callbacks:Callbacks}
  singleton=engine
  context.access=(runtimeWindow.FactoryAccess as FactoryAccessAPI)
  ops.init?.(context)
  runtimeWindow.FactoryGantt?.init(context)
  modules.init?.(context)
  runtimeWindow.FactoryNavigation={
    trackBottleneck:(target,ref="")=>{
      if(!target?.dept||!target?.feature)return
      const needle=String(ref||target.record||"").trim()
      if(!engine.access.has(target.dept,target.feature,"view")){
        pendingTracking=null
        engine.callbacks.navigate(`#/departments/${target.dept}`)
        engine.callbacks.notify("当前员工没有该业务环节的查看权限")
        return
      }
      if(engine.activeDept===target.dept&&engine.activeFeature===target.feature){
        if(needle)window.requestAnimationFrame(()=>{
          const root=document.querySelector(".native-business .legacy-root")
          if(root)markTrackedRow(root,needle)
        })
        return
      }
      pendingTracking={dept:target.dept,feature:target.feature,ref:needle}
      engine.callbacks.navigate(`#/departments/${target.dept}/${target.feature}`)
    }
  }
  return engine
}
