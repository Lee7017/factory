import { useState, type FormEvent } from "react"
import { Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DataTable, StatusBadge, type Column } from "@/components/DataTable"
import type { FactoryAccessAPI, Employee, WorkspaceData } from "@/factory-state"
import { getBusinessRuntime } from "@/business/runtime"

const SKILLS=["配料","搅拌","灌装","包装","清洗","调机调线"] as const
const LEVELS=["L0","L1","L2","L3"] as const
type Level=typeof LEVELS[number]
type Skill=typeof SKILLS[number]
function currentSkills(data:WorkspaceData):Record<string,Record<string,Level>>{
 const store=data.ops?.skills
 return store&&typeof store==="object"&&!Array.isArray(store)?store as Record<string,Record<string,Level>>:{}
}
export function SkillsPage({workspace,access,onRefresh}:{
  workspace:WorkspaceData
  access:FactoryAccessAPI
  onRefresh:()=>void
}){
 const [person,setPerson]=useState<Employee|null>(null)
 const [skill,setSkill]=useState<Skill>("配料")
 const [level,setLevel]=useState<Level>("L2")
 const [error,setError]=useState("")
 const [notice,setNotice]=useState("")
 const editable=access.has("hr","skills","edit")||access.has("production","skills","edit")
 const employees=access.staff.filter(p=>p.dept==="生产车间")
 const ratings=currentSkills(workspace)
 function edit(p:Employee){
   setPerson(p);setSkill("配料");setLevel(ratings[p.id]?.["配料"]??"L0");setError("")
 }
 async function save(event:FormEvent){
   event.preventDefault()
   if(!person)return
   if(!editable){setError("当前员工没有技能评定权限");return}
   try{
     const runtime=await getBusinessRuntime()
     if(!runtime.access.has("hr","skills","edit")&&!runtime.access.has("production","skills","edit")){
       setError("员工权限已发生变化");return
     }
     const ops=runtime.data.ops
     if(!ops)throw Error("业务记录尚未初始化")
     const records=(ops.skills??={}) as Record<string,Record<string,Level>>
     records[person.id]??={}
     records[person.id][skill]=level
     const logs=(ops.logs??=[]) as Array<Record<string,unknown>>
     logs.unshift({at:new Date().toLocaleString("zh-CN"),ts:Date.now(),
       person:runtime.access.current().name,dept:"hr",action:"技能等级评定",ref:person.id,detail:`${skill}=${level}`})
     if(logs.length>120)logs.length=120
     localStorage.setItem("factory-workspace-v4",JSON.stringify(runtime.data))
     window.dispatchEvent(new Event("factory-workspace-update"))
     setPerson(null);setNotice(`${person.name} 的${skill}技能已更新为 ${level}`)
     onRefresh()
   }catch(reason){setError(reason instanceof Error?reason.message:"保存失败")}
 }
 const columns:Column<Employee>[]=[
   {key:"name",label:"员工 / 岗位",value:p=>p.name+" "+p.title,sortable:true,
     render:p=><span><strong>{p.name}</strong><small className="block text-muted-foreground">{p.title}</small></span>},
   ...SKILLS.map((name):Column<Employee>=>({
     key:name,label:name,value:p=>ratings[p.id]?.[name]??"L0",sortable:true,
     render:p=><StatusBadge value={ratings[p.id]?.[name]??"L0"}/>
   })),
   {key:"action",label:"操作",render:p=><Button size="sm" variant="outline" disabled={!editable}
     onClick={()=>edit(p)} aria-label={`评定${p.name}技能`}><Pencil size={13}/>调整技能</Button>}
 ]
 return <section className="business-native-page">
   {notice&&<p className="business-native-notice" role="status">{notice}</p>}
   <DataTable rows={employees} columns={columns} rowKey={p=>p.id} placeholder="搜索生产车间员工或技能等级"/>
   <Dialog open={person!==null} onOpenChange={open=>{if(!open)setPerson(null)}}>
     <DialogContent className="glass-dialog">
       <DialogHeader>
         <DialogTitle>评定员工技能 · {person?.name}</DialogTitle>
         <DialogDescription>技能等级直接参与生产排班校验。保存后立即生效。</DialogDescription>
       </DialogHeader>
       <form className="space-y-4" onSubmit={event=>{void save(event)}}>
         <div className="space-y-2 text-xs">
           <label htmlFor="skill-type">技能项目</label>
           <Select value={skill} onValueChange={value=>{
             const selected=value as Skill;setSkill(selected);setLevel(ratings[person?.id??""]?.[selected]??"L0")
           }}>
             <SelectTrigger className="w-full bg-white/70" id="skill-type"><SelectValue/></SelectTrigger>
             <SelectContent>{SKILLS.map(name=><SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent>
           </Select>
         </div>
         <div className="space-y-2 text-xs">
           <label htmlFor="skill-level">评定等级</label>
           <Select value={level} onValueChange={value=>setLevel(value as Level)}>
             <SelectTrigger className="w-full bg-white/70" id="skill-level"><SelectValue/></SelectTrigger>
             <SelectContent>{LEVELS.map(name=><SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent>
           </Select>
         </div>
         {error&&<p className="text-xs text-red-700" role="alert">{error}</p>}
         <DialogFooter>
           <Button type="button" variant="outline" onClick={()=>setPerson(null)}>取消</Button>
           <Button type="submit" disabled={!editable}>保存技能等级</Button>
         </DialogFooter>
       </form>
     </DialogContent>
   </Dialog>
 </section>
}
