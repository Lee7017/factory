import { useState, type FormEvent } from "react"
import { ClipboardCheck, Plus } from "lucide-react"
import type { Employee, WorkspaceData, WorkItem } from "@/factory-state"
import { updateWorkspace } from "@/factory-state"
import { DataTable, StatusBadge, type Column } from "@/components/DataTable"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

type LeaveRecord=WorkItem&{person?:string;range?:string;reason?:string;createdBy?:string}
const asLeave=(records:WorkspaceData["leaves"]):LeaveRecord[]=>records??[]
const nextId=()=>`LV-${Date.now().toString().slice(-9)}`
export function LeavePage({feature,workspace,employee,can,onRefresh}:{
  feature:"leave"|"leaveApproval";workspace:WorkspaceData;employee?:Employee;
  can:(dept:string,feature:string,action?:string)=>boolean;onRefresh:()=>void
}){
  const [create,setCreate]=useState(false)
  const [candidate,setCandidate]=useState<string|null>(null)
  const [start,setStart]=useState("")
  const [end,setEnd]=useState("")
  const [reason,setReason]=useState("个人事务")
  const [notice,setNotice]=useState("")
  const [validation,setValidation]=useState("")
  const records=asLeave(workspace.leaves)
  const forApproval=feature==="leaveApproval"
  const canCreate=can("hr","leave","create")
  const canApprove=can("hr","leaveApproval","approve")
  function submit(event:FormEvent){
    event.preventDefault()
    if(!start||!end||end<start){setValidation("请检查开始日期和结束日期");return}
    if(!canCreate||!employee){setValidation("当前员工没有创建权限");return}
    const id=nextId()
    updateWorkspace(data=>{
      (data.leaves??=[]).unshift({id,person:employee.name,createdBy:employee.id,
        range:`${start} ~ ${end}`,reason:reason.trim()||"个人事务",status:"待人事审批"});
      (data.messages??=[]).unshift({id:`message-${id}`,title:"请假待审批",
        text:`${employee.name} 的 ${id} 已提交，等待人事审批`,dept:"hr",feature:"leaveApproval",date:new Date().toLocaleString("zh-CN"),unread:true})
    })
    setNotice(`请假单 ${id} 已提交`)
    setCreate(false);setValidation("");onRefresh()
  }
  function approve(){
    const person=records.find(r=>r.id===candidate)
    if(!person||person.status!=="待人事审批"||!canApprove||!employee){
      setNotice("当前员工没有审批权限，或请假单状态已改变")
      return
    }
    if(person.createdBy===employee.id || person.person===employee.name){
      setNotice("不能审批本人提交的请假单")
      setCandidate(null)
      return
    }
    updateWorkspace(data=>{
      const target=data.leaves?.find(x=>x.id===candidate)
      if(!target||target.status!=="待人事审批")return
      target.status="审核通过"
      target.approvedBy=employee.id
      target.approvedAt=new Date().toISOString();
      (data.messages??=[]).unshift({id:`approved-${candidate}-${Date.now()}`,
        title:"请假审批完成",text:`${candidate} 已审核通过`,dept:"hr",feature:"leave",
        date:new Date().toLocaleString("zh-CN"),unread:true})
    })
    setNotice("审批已保存");setCandidate(null);onRefresh()
  }
  const columns:Column<LeaveRecord>[]=[
    {key:"id",label:"单号",value:r=>r.id,sortable:true,render:r=><strong className="font-mono">{r.id}</strong>},
    {key:"person",label:"申请人",value:r=>r.person,sortable:true},
    {key:"range",label:"请假期间",value:r=>r.range,sortable:true},
    {key:"reason",label:"请假事由",value:r=>r.reason},
    {key:"status",label:"状态",value:r=>r.status,sortable:true,render:r=><StatusBadge value={r.status}/>},
    ...(forApproval?[{key:"action",label:"处理",render:(r:LeaveRecord)=><Button size="sm" variant="outline"
      disabled={!canApprove||r.status!=="待人事审批"||r.createdBy===employee?.id||r.person===employee?.name}
      onClick={()=>setCandidate(r.id)}><ClipboardCheck size={13}/>审批</Button>}] as Column<LeaveRecord>[]:[])
  ]
  return <section className="business-native-page">
    {notice&&<p role="status" className="business-native-notice">{notice}</p>}
    <DataTable rows={records} rowKey={r=>r.id} columns={columns} placeholder="搜索请假单、姓名或日期"
      actions={!forApproval?<Button size="sm" onClick={()=>{setCreate(true);setValidation("")}} disabled={!canCreate}>
        <Plus size={14}/>发起请假
      </Button>:undefined}/>
    <Dialog open={create} onOpenChange={setCreate}>
      <DialogContent className="glass-dialog">
        <DialogHeader><DialogTitle>发起请假</DialogTitle>
          <DialogDescription>请输入真实日期和请假原因。</DialogDescription></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1 text-xs">开始日期<Input type="date" required value={start} onChange={e=>setStart(e.target.value)}/></label>
            <label className="space-y-1 text-xs">结束日期<Input type="date" required value={end} onChange={e=>setEnd(e.target.value)}/></label>
          </div>
          <label className="block space-y-1 text-xs">请假事由<Input maxLength={160} value={reason} onChange={e=>setReason(e.target.value)}/></label>
          {validation&&<p role="alert" className="text-xs text-red-700">{validation}</p>}
          <DialogFooter><Button variant="outline" type="button" onClick={()=>setCreate(false)}>取消</Button><Button type="submit">提交请假</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    <Dialog open={Boolean(candidate)} onOpenChange={open=>{if(!open)setCandidate(null)}}>
      <DialogContent className="glass-dialog">
        <DialogHeader><DialogTitle>审批请假</DialogTitle>
          <DialogDescription>请核实请假日期，审批本人申请将被拒绝。</DialogDescription></DialogHeader>
        <div className="text-sm">{candidate} · {records.find(r=>r.id===candidate)?.person??""} · {records.find(r=>r.id===candidate)?.range??""}</div>
        <DialogFooter><Button variant="outline" onClick={()=>setCandidate(null)}>取消</Button><Button onClick={approve}>审核通过</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </section>
}
