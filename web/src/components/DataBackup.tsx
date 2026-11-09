import { useState, type ChangeEvent } from "react"
import { Download, FileJson, RotateCcw, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog"

const DATA_KEYS=["factory-workspace-v2","factory-permissions-v2"] as const
const FORMAT="factory-browser-backup-v1"
type Backup={format:string;exportedAt:string;site:string;storage:Record<string,string|null>}
function validateFile(value:unknown):Backup {
  if(!value||typeof value!=="object")throw Error("不是有效的备份文件")
  const backup=value as Partial<Backup>
  if(backup.format!==FORMAT||!backup.storage||typeof backup.storage!=="object")
    throw Error("备份格式不匹配，请使用本系统导出的 JSON 文件")
  for(const key of DATA_KEYS){
    const raw=backup.storage[key]
    if(raw===undefined)throw Error(`备份缺少 ${key} 数据`)
    if(raw!==null){
      if(typeof raw!=="string")throw Error(`${key} 不是文本数据`)
      const parsed=JSON.parse(raw) as unknown
      if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))
        throw Error(`${key} 数据不是有效对象`)
    }
  }
  return backup as Backup
}
export function DataBackup(){
  const [candidate,setCandidate]=useState<Backup|null>(null)
  const [fileName,setFileName]=useState("")
  const [error,setError]=useState("")
  const [confirm,setConfirm]=useState(false)
  function exportBackup(){
    const data:Backup={
      format:FORMAT,exportedAt:new Date().toISOString(),site:location.origin+location.pathname,
      storage:Object.fromEntries(DATA_KEYS.map(key=>[key,localStorage.getItem(key)]))
    }
    const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json;charset=utf-8"})
    const url=URL.createObjectURL(blob)
    const link=document.createElement("a")
    link.href=url
    link.download=`factory-browser-backup-${new Date().toISOString().slice(0,10)}.json`
    document.body.append(link)
    link.click()
    link.remove()
    window.setTimeout(()=>URL.revokeObjectURL(url),1000)
  }
  async function selectFile(event:ChangeEvent<HTMLInputElement>){
    setError("");setCandidate(null);setConfirm(false)
    const file=event.target.files?.[0]
    setFileName(file?.name??"")
    if(!file)return
    if(file.size>20*1024*1024){setError("备份超过 20 MB，请先检查内容");return}
    try{
      const parsed=JSON.parse(await file.text()) as unknown
      setCandidate(validateFile(parsed))
    }catch(err){setError(err instanceof Error?err.message:"无法读取备份")}
  }
  function restore(){
    if(!candidate||!confirm)return
    // Always keep the original strings so the restore can be rolled back on a quota error.
    const before=Object.fromEntries(DATA_KEYS.map(key=>[key,localStorage.getItem(key)]))
    try{
      for(const key of DATA_KEYS){
        const value=candidate.storage[key]
        if(value===null)localStorage.removeItem(key)
        else localStorage.setItem(key,value)
      }
      location.reload()
    }catch(err){
      for(const key of DATA_KEYS){
        try{
          const value=before[key]
          if(value===null)localStorage.removeItem(key)
          else localStorage.setItem(key,value)
        }catch{}
      }
      setError(err instanceof Error?err.message:"恢复失败，原有记录已尝试保留")
    }
  }
  return <div className="space-y-3 border-t border-border/60 pt-4">
    <div className="flex items-center gap-2 text-xs font-semibold"><ShieldCheck size={14}/>浏览器数据备份</div>
    <p className="text-xs text-muted-foreground">订单、库存、审批及权限目前仅保存在此浏览器。正式切换或清理缓存前，先导出备份。</p>
    <Button variant="outline" size="sm" onClick={exportBackup} className="w-full bg-white/75">
      <Download size={14}/>导出数据和权限（JSON）
    </Button>
    <Dialog onOpenChange={open=>{if(!open){setConfirm(false);setError("");setCandidate(null);setFileName("")}}}>
      <DialogContent className="glass-dialog">
        <DialogHeader><DialogTitle>从备份恢复浏览器数据</DialogTitle>
          <DialogDescription>导入会覆盖此浏览器当前的订单、库存和权限。恢复前建议先导出一份当前数据。</DialogDescription>
        </DialogHeader>
        <label className="space-y-2 text-xs">选择之前导出的 JSON 文件
          <Input type="file" accept=".json,application/json" onChange={selectFile}/>
        </label>
        {candidate&&<div className="rounded-lg bg-white/65 p-3 text-xs">
          <div className="flex items-center gap-2 font-medium"><FileJson size={15}/>{fileName}</div>
          <p className="mt-2 text-muted-foreground">备份日期：{new Date(candidate.exportedAt).toLocaleString("zh-CN")}</p>
          <p className="mt-1 text-muted-foreground">包含工作区数据和员工权限；恢复后页面将刷新。</p>
        </div>}
        {error&&<p role="alert" className="text-xs text-red-700">{error}</p>}
        <label className="flex items-start gap-2 text-xs">
          <input type="checkbox" checked={confirm} onChange={e=>setConfirm(e.target.checked)} className="mt-0.5"/>
          我已确认将使用备份覆盖当前浏览器数据
        </label>
        <DialogFooter>
          <Button variant="destructive" disabled={!candidate||!confirm} onClick={restore}>
            <RotateCcw size={14}/>覆盖并恢复
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <p className="text-[10px] text-muted-foreground">恢复操作只影响当前浏览器，不会修改 GitHub 仓库。</p>
  </div>
}
