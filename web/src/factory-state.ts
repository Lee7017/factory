import { useCallback, useEffect, useState } from "react"
import { DEPARTMENTS, FEATURE_NAMES } from "@/catalog"
import originalWorkspace from "@/initial-state.json"
import originalOperations from "@/initial-operations.json"
import originalModules from "@/initial-modules.json"
export { getTodos, todoLane, dashboardMetrics, orderStageLabel } from "@/business-selectors"
export type { TodoRecord as Todo } from "@/business-selectors"

export interface Employee {
  id: string
  name: string
  dept: string
  title: string
}
export interface FactoryAccessAPI {
  staff: Employee[]
  init: (depts: typeof DEPARTMENTS, featureNames: Record<string,string>) => void
  current: () => Employee
  has: (dept: string, feature: string, action?: string) => boolean
  switchCurrent: (id: string) => boolean
  render: () => string
  handleClick: (element:HTMLElement) => boolean
  updateSelection: (key:"employee"|"position"|"dept",value:string) => void
}
export interface WorkItem {
  id: string
  status: string
  [key: string]: unknown
}
export interface WorkspaceData {
  offices?: Record<string,string>
  orders?: Array<WorkItem & {product?:string;owner?:string}>
  tasks?: Array<WorkItem & {type?:string;line?:string;category?:string}>
  leaves?: Array<WorkItem & {person?:string;range?:string}>
  payroll?: Array<WorkItem & {name?:string;basis?:string}>
  messages?: Array<{id:string|number;title:string;text:string;dept?:string;unread?:boolean;feature?:string;date?:string}>
  chatThreads?: Record<string,Array<{from:string;text:string;time:string}>>
  ops?: Record<string,unknown>
  modules?: Record<string,unknown>
  [key:string]: unknown
}
declare global {
  interface Window { FactoryAccess?: FactoryAccessAPI }
}
const WORKSPACE_KEY = "factory-workspace-v2"
const initial=originalWorkspace as WorkspaceData
const initialOps=originalOperations as Record<string,unknown>
const initialMods=originalModules as Record<string,unknown>
const clone=<T,>(value:T):T=>JSON.parse(JSON.stringify(value)) as T
const isRecord=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==="object"&&!Array.isArray(v)
/** Same storage key and initial-state schema as the original factory app. Never reset user records. */
export function readWorkspace(): WorkspaceData {
  let saved:Record<string,unknown>={}
  try {
    const data=JSON.parse(localStorage.getItem(WORKSPACE_KEY)||"null")
    if(isRecord(data))saved=data
  } catch {/* damaged or blocked browser storage: use immutable seed data */}
  const defaults=clone(initial)
  const data={...defaults,...saved} as WorkspaceData
  for(const key of ["orders","tasks","leaves","payroll","messages"] as const)
    if(!Array.isArray(data[key]))Object.assign(data,{[key]:defaults[key]})
  data.offices=isRecord(data.offices)?data.offices as Record<string,string>:{}
  data.chatThreads=isRecord(data.chatThreads)?data.chatThreads as WorkspaceData["chatThreads"]:{}
  // Show the exact same purchase/quality seeds as the original modules before an iframe is opened.
  if(!isRecord(data.ops)||data.ops.version!==16)data.ops=clone(initialOps)
  if(!isRecord(data.modules))data.modules=clone(initialMods)
  // Preserve existing versions and records. Legacy engines perform their own data migrations.
  const flows=(data.ops.flows??{}) as Record<string,unknown>
  for(const order of data.orders??[])if(!flows[order.id]){
    flows[order.id]={stage:order.status==="待评审"?"review":order.status==="草稿"?"draft":"approved",audit:[]}
  }
  data.ops.flows=flows
  return data
}
export function updateWorkspace(mutator:(data:WorkspaceData)=>void):WorkspaceData {
  const data=readWorkspace()
  mutator(data)
  localStorage.setItem(WORKSPACE_KEY,JSON.stringify(data))
  window.dispatchEvent(new Event("factory-workspace-update"))
  return data
}
export function useFactoryState() {
  const [access,setAccess]=useState<FactoryAccessAPI|null>(null)
  const [workspace,setWorkspace]=useState<WorkspaceData>(readWorkspace)
  const refresh=useCallback(()=>setWorkspace(readWorkspace()),[])
  useEffect(()=>{
    const init=()=>{
      const api=window.FactoryAccess
      if(!api)return
      api.init(DEPARTMENTS,FEATURE_NAMES)
      setAccess(api)
    }
    if(window.FactoryAccess)init()
    else {
      const script=document.createElement("script")
      script.src=`${import.meta.env.BASE_URL}legacy/access.js`
      script.onload=init
      script.onerror=()=>console.error("Failed to load factory access module")
      document.head.appendChild(script)
    }
    window.addEventListener("storage",refresh)
    window.addEventListener("focus",refresh)
    window.addEventListener("factory-workspace-update",refresh)
    return ()=>{
      window.removeEventListener("storage",refresh)
      window.removeEventListener("focus",refresh)
      window.removeEventListener("factory-workspace-update",refresh)
    }
  },[refresh])
  const switchEmployee=useCallback((id:string)=>{
    if(!access?.switchCurrent(id))return
    refresh()
  },[access,refresh])
  const can=useCallback((dept:string,feature:string,action="view")=>
    access?.has(dept,feature,action)??false,[access])
  return {access,employee:access?.current(),workspace,refresh,can,switchEmployee}
}
