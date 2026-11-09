import { useCallback, useEffect, useState } from "react"
import { DEPARTMENTS, FEATURE_NAMES } from "@/catalog"

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
}
export interface WorkItem { id: string; status: string; [key: string]: unknown }
export interface WorkspaceData {
  offices?: Record<string,string>
  orders?: Array<WorkItem & {product?:string;owner?:string}>
  tasks?: Array<WorkItem & {type?:string;line?:string;category?:string}>
  leaves?: Array<WorkItem & {person?:string;range?:string}>
  payroll?: Array<WorkItem & {name?:string}>
  messages?: Array<{id:string|number;title:string;text:string;dept?:string;unread?:boolean;feature?:string;date?:string}>
  chatThreads?: Record<string,Array<{from:string;text:string;time:string}>>
}
declare global {
  interface Window { FactoryAccess?: FactoryAccessAPI }
}
const WORKSPACE_KEY = "factory-workspace-v2"
export function readWorkspace(): WorkspaceData {
  try {
    const saved = localStorage.getItem(WORKSPACE_KEY)
    return saved ? JSON.parse(saved) as WorkspaceData : {}
  } catch { return {} }
}
export function updateWorkspace(mutator: (data: WorkspaceData) => void): WorkspaceData {
  const data = readWorkspace()
  mutator(data)
  localStorage.setItem(WORKSPACE_KEY, JSON.stringify(data))
  return data
}
export function useFactoryState() {
  const [access, setAccess] = useState<FactoryAccessAPI|null>(null)
  const [workspace, setWorkspace] = useState<WorkspaceData>(readWorkspace)
  const [version, setVersion] = useState(0)
  const refresh = useCallback(() => { setWorkspace(readWorkspace()); setVersion((v) => v + 1) },[])
  useEffect(() => {
    const init = () => {
      const api = window.FactoryAccess
      if (!api) return
      api.init(DEPARTMENTS, FEATURE_NAMES)
      setAccess(api)
    }
    if (window.FactoryAccess) init()
    else {
      const script = document.createElement("script")
      script.src = `${import.meta.env.BASE_URL}legacy/access.js`
      script.onload = init
      script.onerror = () => console.error("Failed to load factory access compatibility module")
      document.head.appendChild(script)
    }
    window.addEventListener("storage", refresh)
    window.addEventListener("focus", refresh)
    return () => {window.removeEventListener("storage", refresh);window.removeEventListener("focus", refresh)}
  }, [refresh])
  const switchEmployee = useCallback((id: string) => {
    if (!access?.switchCurrent(id)) return
    refresh()
  }, [access, refresh])
  const can = useCallback((dept: string, feature: string, action = "view") =>
    access?.has(dept,feature,action) ?? false, [access])
  return { access, employee:access?.current(), workspace, version, refresh, can, switchEmployee }
}

export interface Todo { id:string; title:string; detail:string; status:string; feature:string }
export function getTodos(dept: string, data: WorkspaceData): Todo[] {
  const result: Todo[]=[]
  if (dept === "hr") {
    for (const item of data.leaves ?? []) if (item.status === "待人事审批")
      result.push({id:item.id,title:`请假审批 · ${item.person ?? "员工"}`,detail:item.range??"",status:item.status,feature:"leaveApproval"})
    for (const item of data.payroll ?? []) if (item.status === "待人事复核")
      result.push({id:item.id,title:`工资核算 · ${item.name??"员工"}`,detail:"等待人事复核",status:item.status,feature:"payroll"})
  }
  if (dept === "finance") {
    for (const item of data.payroll ?? []) if (item.status === "待财务核准")
      result.push({id:item.id,title:`工资核准 · ${item.name??"员工"}`,detail:"等待财务核准",status:item.status,feature:"finance"})
  }
  if (dept === "engineering") {
    for (const item of data.tasks ?? []) if (item.type === "调机调线" && !["已完成","已取消"].includes(item.status))
      result.push({id:item.id,title:`设备工单 · ${item.line??""}`,detail:item.category??"",status:item.status,feature:"engineering"})
  }
  if (dept === "production") {
    for (const item of data.tasks ?? []) if (!["已完成","已取消"].includes(item.status))
      result.push({id:item.id,title:`生产任务 · ${item.type??""}`,detail:item.line??"",status:item.status,feature:"tasks"})
  }
  if (dept === "pmc") {
    for (const item of data.orders ?? []) if (item.status === "待排产")
      result.push({id:item.id,title:`待排产 · ${item.product??item.id}`,detail:"等待排程",status:item.status,feature:"schedule"})
  }
  return result
}
export function todoLane(status: string): "waiting"|"doing"|"review" {
  if (/待(审批|判定|复核|审核|确认|质量|放行|检查)|待人事|待财务|未通过/.test(status))return "review"
  if (/执行中|进行中|待发料|待接收|处理中|已排程/.test(status))return "doing"
  return "waiting"
}
