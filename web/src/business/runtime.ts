import { readWorkspace, type FactoryAccessAPI, type WorkspaceData } from "@/factory-state"
import { FEATURE_NAMES } from "@/catalog"

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
    script.src=`${import.meta.env.BASE_URL}legacy/${name}`
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
  submit:(event:Event)=>boolean
}
type Callbacks={
  render:()=>void
  notify:(message:string)=>void
  navigate:(hash:string)=>void
  refresh:()=>void
}
let singleton:BusinessRuntime|undefined

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
      localStorage.setItem("factory-workspace-v2",JSON.stringify(data))
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
    callbacks:{render:()=>{},notify:()=>{},navigate:()=>{},refresh:()=>{}},
    mount(feature:string,department:string,access:FactoryAccessAPI,callbacks:Callbacks){
      runtime.activeFeature=feature;runtime.activeDept=department
      runtime.callbacks=callbacks
      context.access=access
      context.data.dept=department
      context.data.feature=feature
      context.data.home=false
      // Sync harmless React-owned fields; operations and modules keep their
      // original object references so existing business validation is preserved.
      const current=readWorkspace()
      context.data.offices=current.offices
      context.data.chatThreads=current.chatThreads
      context.data.messages=current.messages
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
    submit(event:Event){
      if(modules.submitForm?.(event))return true
      if(ops.submitForm?.(event))return true
      return false
    }
  }
  const engine=runtime as unknown as BusinessRuntime & {callbacks:Callbacks}
  singleton=engine
  context.access=(runtimeWindow.FactoryAccess as FactoryAccessAPI)
  ops.init?.(context)
  runtimeWindow.FactoryGantt?.init(context)
  modules.init?.(context)
  runtimeWindow.FactoryNavigation={
    trackBottleneck:(target)=>{
      if(target.dept&&target.feature)engine.callbacks.navigate(`#/departments/${target.dept}/${target.feature}`)
    }
  }
  return engine
}
