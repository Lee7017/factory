import { useMemo, useState, type FormEvent } from "react"
import { Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DataTable, type Column } from "@/components/DataTable"
import type { Employee, FactoryAccessAPI, WorkspaceData } from "@/factory-state"
import { getBusinessRuntime } from "@/business/runtime"

type Edit={title:string;dept:string;phone:string}
function editsOf(workspace:WorkspaceData):Record<string,Partial<Edit>>{
  const edits=workspace.ops?.staffEdits
  return edits&&typeof edits==="object"&&!Array.isArray(edits)?edits as Record<string,Partial<Edit>>:{}
}
export function EmployeesPage({access,workspace,onRefresh}:{
  access:FactoryAccessAPI
  workspace:WorkspaceData
  onRefresh:()=>void
}){
  const [selected,setSelected]=useState<Employee|null>(null)
  const [draft,setDraft]=useState<Edit>({title:"",dept:"",phone:""})
  const [error,setError]=useState("")
  const [notice,setNotice]=useState("")
  const editable=access.has("it","employees","edit")
  const saved=editsOf(workspace)
  const departments=useMemo(()=>[...new Set(access.staff.map(p=>p.dept).concat(Object.values(saved).map(p=>p.dept??"")))].filter(Boolean),[access.staff,saved])
  function begin(person:Employee){
    const edit=saved[person.id]??{}
    setSelected(person)
    setDraft({title:edit.title??person.title,dept:edit.dept??person.dept,phone:edit.phone??""})
    setError("")
  }
  async function commit(event:FormEvent){
    event.preventDefault()
    if(!selected)return
    if(!access.has("it","employees","edit")){setError("当前员工没有编辑员工档案的权限");return}
    if(!draft.title.trim()||!draft.dept.trim()){setError("请填写岗位名称和所在部门");return}
    try{
      const runtime=await getBusinessRuntime()
      if(!runtime.access.has("it","employees","edit")){setError("权限已发生变化，请重新打开页面");return}
      const ops=runtime.data.ops
      if(!ops)throw Error("业务数据未初始化")
      const staff=runtime.access.staff.find(p=>p.id===selected.id)
      if(!staff)throw Error("员工记录不存在")
      const edits=(ops.staffEdits??={}) as Record<string,Edit>
      const value={title:draft.title.trim(),dept:draft.dept.trim(),phone:draft.phone.trim()}
      edits[selected.id]=value
      staff.title=value.title
      staff.dept=value.dept
      const logs=(ops.logs??=[]) as Array<Record<string,unknown>>
      logs.unshift({at:new Date().toLocaleString("zh-CN"),ts:Date.now(),
        person:runtime.access.current().name,dept:"it",action:"更新员工档案",ref:staff.id,detail:""})
      if(logs.length>120)logs.length=120
      localStorage.setItem("factory-workspace-v4",JSON.stringify(runtime.data))
      window.dispatchEvent(new Event("factory-workspace-update"))
      setSelected(null)
      setNotice(`${staff.name} 的档案已保存`)
      onRefresh()
    }catch(reason){setError(reason instanceof Error?reason.message:"保存失败，请重试")}
  }
  const columns:Column<Employee>[]=[
    {key:"id",label:"工号",value:p=>p.id,sortable:true,render:p=><span className="font-mono">{p.id}</span>},
    {key:"name",label:"姓名",value:p=>p.name,sortable:true,render:p=><strong>{p.name}</strong>},
    {key:"dept",label:"所属部门",value:p=>saved[p.id]?.dept??p.dept,sortable:true},
    {key:"title",label:"岗位",value:p=>saved[p.id]?.title??p.title,sortable:true},
    {key:"phone",label:"联系电话",value:p=>saved[p.id]?.phone??"",render:p=>saved[p.id]?.phone||"—"},
    {key:"actions",label:"操作",render:p=><Button variant="outline" size="sm" disabled={!editable}
      onClick={()=>begin(p)} aria-label={`编辑${p.name}的档案`}><Pencil size={13}/>编辑档案</Button>}
  ]
  return <section className="business-native-page">
    {notice&&<p className="business-native-notice" role="status">{notice}</p>}
    <DataTable rows={access.staff} columns={columns} rowKey={p=>p.id}
      placeholder="按工号、姓名、部门或岗位搜索"/>
    <Dialog open={selected!==null} onOpenChange={open=>{if(!open)setSelected(null)}}>
      <DialogContent className="glass-dialog">
        <DialogHeader>
          <DialogTitle>编辑员工档案 · {selected?.name}</DialogTitle>
          <DialogDescription>工号 {selected?.id}。修改后同步到现有业务记录；员工权限请在权限矩阵调整。</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={event=>{void commit(event)}}>
          <label className="block space-y-2 text-xs">岗位名称
            <Input required maxLength={80} value={draft.title}
              onChange={event=>setDraft(prev=>({...prev,title:event.target.value}))}/>
          </label>
          <div className="space-y-2 text-xs">
            <label htmlFor="employee-dept-selection">所在部门</label>
            <Select value={draft.dept} onValueChange={value=>setDraft(prev=>({...prev,dept:value}))}>
              <SelectTrigger id="employee-dept-selection" className="w-full bg-white/70">
                <SelectValue placeholder="请选择部门"/>
              </SelectTrigger>
              <SelectContent>{departments.map(dept=><SelectItem value={dept} key={dept}>{dept}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <label className="block space-y-2 text-xs">联系电话
            <Input type="tel" maxLength={60} value={draft.phone}
              onChange={event=>setDraft(prev=>({...prev,phone:event.target.value}))}/>
          </label>
          {error&&<p role="alert" className="text-xs text-red-700">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={()=>setSelected(null)}>取消</Button>
            <Button type="submit" disabled={!editable}>保存档案</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </section>
}
