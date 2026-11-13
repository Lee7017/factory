import { createElement, useMemo, type ReactNode, type ElementType } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

/**
 * Render the original MES business-engine markup as React elements.
 * Common controls use shadcn/ui while the original data-action and form attributes
 * remain available to the existing validated business handlers.
 *
 * This is an incremental UI migration, not a rewrite of the MES business engine.
 */
const tableComponents:Record<string,ElementType>={
  table:Table,thead:TableHeader,tbody:TableBody,
  tr:TableRow,th:TableHead,td:TableCell
}
const attributes:Record<string,string>={
  class:"className",for:"htmlFor",readonly:"readOnly",tabindex:"tabIndex",
  maxlength:"maxLength",minlength:"minLength",autofocus:"autoFocus",
  colspan:"colSpan",rowspan:"rowSpan",viewbox:"viewBox",
  "stroke-width":"strokeWidth","stroke-linecap":"strokeLinecap",
  "stroke-linejoin":"strokeLinejoin","clip-path":"clipPath",
  "fill-rule":"fillRule","clip-rule":"clipRule",
  "aria-readonly":"aria-readonly"
}
const booleanAttributes=new Set(["disabled","required","readOnly","multiple","autoFocus","hidden","open","checked"])
// The MES engines remain the source of truth. Add filters to actual column headings
// while parsing their markup, so React owns the controls and never loses them on rerender.
// Existing sales / procurement / PMC headers are left to their dedicated renderers.
const filterHeadings=/^(?:状态|审批状态|处理状态|执行状态|流程状态|质量状态|订单状态|审核状态|工单状态|任务状态|当前状态|开工前 Gate|QC 判定|判定状态|检验结果|操作结果|结论|状态 \/ 质检)$/
function decorateRemainingTables(root:DocumentFragment){
  const tables=Array.from(root.querySelectorAll("table"))
  tables.forEach((table,tableIndex)=>{
    table.setAttribute("data-flat-ledger-table",String(tableIndex))
    const heads=Array.from(table.querySelectorAll("thead tr:first-child > th"))
    const rows=Array.from(table.querySelectorAll("tbody > tr"))
    rows.forEach(row=>{
      if(row.children.length===heads.length&&heads.length>0)
        row.setAttribute("data-flat-ledger-row",String(tableIndex))
    })
    heads.forEach((head,columnIndex)=>{
      const heading=head.textContent?.trim()??""
      if(!filterHeadings.test(heading)||head.querySelector("select"))return
      const values=Array.from(new Set(rows.flatMap(row=>{
        if(row.children.length!==heads.length)return []
        const value=row.children[columnIndex]?.textContent?.trim()??""
        return value&&value!=="—"&&value.length<=65?[value]:[]
      })))
      head.classList.add("flat-ledger-filter-heading")
      const control=document.createElement("div")
      control.className="sales-order-status-control flat-ledger-filter-control"
      const label=document.createElement("span")
      label.textContent=heading
      control.append(label)
      const symbol=document.createElementNS("http://www.w3.org/2000/svg","svg")
      symbol.setAttribute("class","sales-order-status-caret")
      symbol.setAttribute("viewBox","0 0 24 24")
      symbol.setAttribute("width","15")
      symbol.setAttribute("height","15")
      symbol.setAttribute("aria-hidden","true")
      const shape=document.createElementNS("http://www.w3.org/2000/svg","path")
      shape.setAttribute("d","M4 7h16M7 12h10M10 17h4")
      shape.setAttribute("fill","none")
      shape.setAttribute("stroke","currentColor")
      shape.setAttribute("stroke-width","1.8")
      shape.setAttribute("stroke-linecap","round")
      symbol.append(shape)
      control.append(symbol)
      const select=document.createElement("select")
      select.className="sales-order-status-select flat-ledger-filter-select"
      const key=tableIndex+":"+columnIndex
      select.setAttribute("data-flat-ledger-filter",key)
      select.setAttribute("data-flat-ledger-column",String(columnIndex))
      select.setAttribute("aria-label","筛选"+heading)
      select.title="筛选"+heading
      const all=document.createElement("option")
      all.value=""
      all.textContent="全部状态"
      select.append(all)
      for(const value of values){
        const option=document.createElement("option")
        option.value=value
        option.textContent=value
        select.append(option)
      }
      control.append(select)
      head.replaceChildren(control)
    })
  })
}

function inlineStyle(value:string):Record<string,string>{
  return Object.fromEntries(value.split(";").flatMap(chunk=>{
    const index=chunk.indexOf(":")
    if(index<0)return []
    const name=chunk.slice(0,index).trim()
    const text=chunk.slice(index+1).trim()
    if(!name||!text)return []
    return [[name.startsWith("--")?name:name.replace(/-([a-z])/g,(_,letter:string)=>letter.toUpperCase()),text]]
  }))
}
function propsOf(element:Element,path:string):Record<string,unknown>{
  const props:Record<string,unknown>={key:path}
  for(const attr of Array.from(element.attributes)){
    if(/^on[a-z]/i.test(attr.name))continue
    const name=attributes[attr.name.toLowerCase()]??attr.name
    if(name==="style")props.style=inlineStyle(attr.value)
    else if(booleanAttributes.has(name))props[name]=true
    else if(name==="value"){
      // <option value> must remain value: defaultValue is only valid for form input state.
      if(element.localName.toLowerCase()==="input")props.defaultValue=attr.value
      else props.value=attr.value
    }
    else if(name==="selected")continue
    else props[name]=attr.value
  }
  return props
}
function convert(node:Node,path:string):ReactNode{
  if(node.nodeType===Node.TEXT_NODE)return node.textContent
  if(node.nodeType!==Node.ELEMENT_NODE)return null
  const element=node as Element
  const tag=element.localName.toLowerCase()
  if(["script","iframe","object","embed"].includes(tag))return null
  const props=propsOf(element,path)
  const children=Array.from(element.childNodes).map((child,index)=>convert(child,`${path}.${index}`))
  if(tag==="button"){
    const original=String(props.className??"")
    const primary=/(?:^|\s)(?:primary|btn-primary|op-primary)(?:\s|$)/.test(original)
    return createElement(Button,{
      ...props,variant:primary?"default":"outline",size:"sm",
      className:`legacy-shadcn-control ${original}`.trim()
    },...children)
  }
  if(tag==="input"){
    const kind=String(props.type??"text").toLowerCase()
    if(!["checkbox","radio","file","range","hidden","color"].includes(kind)){
      return createElement(Input,{...props,className:`legacy-shadcn-input ${String(props.className??"")}`.trim()})
    }
  }
  if(tag==="textarea"){
    return createElement(Textarea,{
      ...props,defaultValue:element.textContent??"",
      className:`legacy-shadcn-textarea ${String(props.className??"")}`.trim()
    })
  }
  if(tag==="select"){
    const selected=element.querySelector("option[selected]")
    const selectedValue=selected?.getAttribute("value")
    if(selectedValue!==null&&selectedValue!==undefined)props.defaultValue=selectedValue
    props.className=`legacy-shadcn-select ${String(props.className??"")}`.trim()
  }
  if(tag==="option")delete props.selected
  const Component=tableComponents[tag]??tag
  if(["input","img","hr","br","source","area"].includes(tag))
    return createElement(Component,props)
  return createElement(Component,props,...children)
}
export function BusinessMarkup({markup,standardize=false}:{markup:string;standardize?:boolean}){
  const content=useMemo(()=>{
    const template=document.createElement("template")
    template.innerHTML=markup
    if(standardize)decorateRemainingTables(template.content)
    return Array.from(template.content.childNodes).map((node,index)=>convert(node,String(index)))
  },[markup,standardize])
  return <>{content}</>
}
