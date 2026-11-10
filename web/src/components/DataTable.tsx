import { useMemo, useState, type ReactNode } from "react"
import { ArrowDownUp, ChevronLeft, ChevronRight, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export type Column<T>={
  key:string;label:string
  value?:(row:T)=>unknown
  render?:(row:T)=>ReactNode
  sortable?:boolean
}
export function StatusBadge({value}:{value:string}){
  const danger=/不合格|驳回|失败|冻结|拒绝|过期|冲突/.test(value)
  const done=/已通过|已完成|已入库|已核准|已发布|合格|已放行|审核通过/.test(value)
  return <Badge variant={danger?"destructive":done?"secondary":"outline"} className="whitespace-nowrap text-[11px]">{value}</Badge>
}
export function DataTable<T>({rows,columns,rowKey,placeholder="搜索记录…",pageSize=10,empty="暂无记录",actions}:{
  rows:T[];columns:Column<T>[];rowKey:(row:T)=>string;
  placeholder?:string;pageSize?:number;empty?:string;actions?:ReactNode
}){
  const [query,setQuery]=useState("")
  const [sort,setSort]=useState<{key:string;desc:boolean}|null>(null)
  const [page,setPage]=useState(0)
  const result=useMemo(()=>{
    const term=query.trim().toLocaleLowerCase()
    let records=rows.filter(row=>!term||columns.some(c=>String(c.value?.(row)??"").toLocaleLowerCase().includes(term)))
    const column=columns.find(c=>c.key===sort?.key)
    if(sort&&column){
      records=[...records].sort((a,b)=>{
        const va=column.value?.(a),vb=column.value?.(b)
        const cmp=typeof va==="number"&&typeof vb==="number"?va-vb:
          String(va??"").localeCompare(String(vb??""),"zh-CN",{numeric:true})
        return sort.desc?-cmp:cmp
      })
    }
    return records
  },[rows,columns,query,sort])
  const pages=Math.max(1,Math.ceil(result.length/pageSize))
  const current=Math.min(page,pages-1)
  return <div className="business-native-list">
    <div className="business-native-list-toolbar">
      <div className="relative w-full max-w-72">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
        <Input value={query} onChange={e=>{setQuery(e.target.value);setPage(0)}}
          className="bg-white/70 pl-9 text-xs" placeholder={placeholder} aria-label="搜索业务记录"/>
      </div>
      {actions&&<div className="business-native-list-actions">{actions}</div>}
    </div>
    <div className="business-native-list-table">
      <Table>
        <TableHeader><TableRow>
          {columns.map(c=><TableHead key={c.key} className="text-xs">
            {c.sortable?<button type="button" className="inline-flex items-center gap-1 hover:underline"
              aria-label={`按${c.label}排序`} onClick={()=>{setSort(old=>({key:c.key,desc:old?.key===c.key?!old.desc:false}));setPage(0)}}>
              {c.label}<ArrowDownUp size={12}/></button>:c.label}
          </TableHead>)}
        </TableRow></TableHeader>
        <TableBody>{result.length?result.slice(current*pageSize,(current+1)*pageSize).map(row=>
          <TableRow key={rowKey(row)}>{columns.map(c=><TableCell key={c.key} className="text-xs">
            {c.render?c.render(row):String(c.value?.(row)??"—")}
          </TableCell>)}</TableRow>):<TableRow><TableCell colSpan={columns.length} className="py-8 text-center text-xs text-muted-foreground">{empty}</TableCell></TableRow>}
        </TableBody>
      </Table>
    </div>
    <div className="business-native-list-footer">
      <span>共 {result.length} 条 · 第 {current+1}/{pages} 页</span>
      <div className="flex gap-1">
        <Button variant="outline" size="icon-xs" disabled={current===0} onClick={()=>setPage(current-1)} aria-label="上一页"><ChevronLeft size={14}/></Button>
        <Button variant="outline" size="icon-xs" disabled={current>=pages-1} onClick={()=>setPage(current+1)} aria-label="下一页"><ChevronRight size={14}/></Button>
      </div>
    </div>
  </div>
}
