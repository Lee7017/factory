import { useEffect, useMemo, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { ArrowDownUp, ChevronLeft, ChevronRight, ListFilter, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  const [columnFilters,setColumnFilters]=useState<Record<string,string>>({})
  const [toolbarHost,setToolbarHost]=useState<HTMLElement|null>(null)
  useEffect(()=>{setToolbarHost(document.getElementById("business-context-tools-host"))},[])
  const statusOptions=useMemo<Record<string,string[]>>(()=>Object.fromEntries(columns
    .filter(column=>/(?:状态|结论|结果|审批状态|质量状态)$/.test(column.label)&&column.value)
    .map(column=>[column.key,Array.from(new Set(rows.map(row=>String(column.value?.(row)??"").trim())
      .filter(Boolean)))])),[columns,rows])
  const result=useMemo(()=>{
    const term=query.trim().toLocaleLowerCase()
    let records=rows.filter(row=>
      (!term||columns.some(c=>String(c.value?.(row)??"").toLocaleLowerCase().includes(term)))&&
      Object.entries(columnFilters).every(([key,selected])=>
        !selected||String(columns.find(c=>c.key===key)?.value?.(row)??"").trim()===selected)
    )
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
  },[rows,columns,query,sort,columnFilters])
  const pages=Math.max(1,Math.ceil(result.length/pageSize))
  const current=Math.min(page,pages-1)
  const controls=<div className="business-context-tools">
    {actions&&<div className="business-native-list-actions">{actions}</div>}
    <label className="business-context-search">
      <Search size={14}/>
      <input type="search" value={query}
        onChange={event=>{setQuery(event.target.value);setPage(0)}}
        placeholder={placeholder} aria-label="搜索业务记录"/>
    </label>
  </div>
  return <div className="business-native-list">
    {toolbarHost?createPortal(controls,toolbarHost):
      <div className="business-native-list-toolbar">{controls}</div>}
    <div className="business-native-list-table">
      <Table>
        <TableHeader><TableRow>
          {columns.map(c=><TableHead key={c.key} className="text-xs">
            {statusOptions[c.key]?<div className={"sales-order-status-control flat-ledger-filter-control "+(columnFilters[c.key]?"is-active":"")}>
              <span>{c.label}</span><ListFilter size={14} className="sales-order-status-caret"/>
              <select className="sales-order-status-select flat-ledger-filter-select"
                aria-label={`筛选${c.label}`} title={`筛选${c.label}`}
                value={columnFilters[c.key]??""}
                onChange={event=>{setColumnFilters(old=>({...old,[c.key]:event.target.value}));setPage(0)}}>
                <option value="">全部状态</option>
                {statusOptions[c.key].map(value=><option key={value} value={value}>{value}</option>)}
              </select>
            </div>:
            c.sortable?<button type="button" className="inline-flex items-center gap-1 hover:underline"
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
