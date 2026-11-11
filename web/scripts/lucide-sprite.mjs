// Generate Lucide symbols for business HTML mounted inside React. No standalone iframe or old HTML skeleton is required.
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import * as Lucide from "lucide-react"

const ICONS_SOURCE = fileURLToPath(new URL("../src/icons.ts",import.meta.url))

// Names referenced by still-active business markup; feature icons come from the React catalog.
const COMMON = Object.freeze({
  info:"Info",
  building:"Building2",
  users:"UsersRound",
  sales:"ShoppingCart",
  pmc:"CalendarRange",
  purchase:"Truck",
  warehouse:"Warehouse",
  quality:"ShieldCheck",
  production:"Factory",
  tech:"Wrench",
  engineering:"Wrench",
  ehs:"ShieldAlert",
  finance:"Wallet",
  it:"Settings2",
  leadership:"Building2",
  lock:"LockKeyhole",
  chevron:"ChevronDown",
  bell:"Bell",
  search:"Search",
  arrow:"ArrowRight",
  menu:"Menu",
  check:"Check",
  close:"X",
  refresh:"RefreshCw"
})

function parseMap(source, symbol) {
  const body = source.match(new RegExp("const " + symbol + ":\\s*Record<[^\\n]+>\\s*=\\s*\\{([\\s\\S]*?)\\n\\}"))?.[1]
  if(!body)throw new Error("Unable to find React Lucide mapping: " + symbol)
  const result = {}
  for(const line of body.split("\n")){
    const clean = line.trim()
    if(!clean)continue
    const parsed = clean.match(/^([A-Za-z][A-Za-z0-9]*):\s*([A-Za-z][A-Za-z0-9]*),?$/)
    if(!parsed)throw new Error("Invalid Lucide mapping line: "+clean)
    result[parsed[1]]=parsed[2]
  }
  return result
}
const source = await readFile(ICONS_SOURCE,"utf8")
const featureMap = parseMap(source,"FEATURE_ICON_MAP")
const departmentMap = parseMap(source,"DEPARTMENT_ICON_MAP")
if(Object.keys(featureMap).length!==53)throw new Error("Expected all 53 feature icon mappings")
if(Object.keys(departmentMap).length!==10)throw new Error("Expected all 10 department icon mappings")

// Keep React and legacy department symbols consistent.
const departments={
  hr:"users",sales:"sales",pmc:"pmc",purchase:"purchase",
  warehouse:"warehouse",quality:"quality",production:"production",
  finance:"finance",it:"it",leadership:"leadership"
}
for(const [dept,legacyId] of Object.entries(departments)){
  if(departmentMap[dept]!==COMMON[legacyId])throw new Error(`Department icon drift: ${dept}`)
}

const symbols={
  ...Object.fromEntries(Object.entries(COMMON).map(([id,name])=>[`ic-${id}`,name])),
  ...Object.fromEntries(Object.entries(featureMap).map(([id,name])=>[`ic-feature-${id}`,name]))
}
const symbolIds=Object.keys(symbols)
if(symbolIds.length!==77 || new Set(symbolIds).size!==symbolIds.length)
  throw new Error("Expected 77 unique business icon symbols")
export const iconMappings = symbols

export function makeLucideSprite(){
  const rendered=symbolIds.map(id=>{
    const componentName=symbols[id],Component=Lucide[componentName]
    if(!Component)throw new Error(`Missing Lucide export ${componentName} for ${id}`)
    const markup=renderToStaticMarkup(createElement(Component,{size:24,strokeWidth:2}))
    const body=markup.match(/^<svg\b[^>]*>([\s\S]*?)<\/svg>$/)?.[1]
    if(!body)throw new Error(`Unexpected Lucide SVG markup: ${componentName}`)
    return `<symbol id="${id}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" data-lucide-icon="${componentName}">${body}</symbol>`
  }).join("")
  return `<svg class="svg-bank" xmlns="http://www.w3.org/2000/svg" data-icon-library="lucide">${rendered}</svg>`
}
