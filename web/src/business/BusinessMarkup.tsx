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
    else if(name==="value")props.defaultValue=attr.value
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
export function BusinessMarkup({markup}:{markup:string}){
  const content=useMemo(()=>{
    const template=document.createElement("template")
    template.innerHTML=markup
    return Array.from(template.content.childNodes).map((node,index)=>convert(node,String(index)))
  },[markup])
  return <>{content}</>
}
