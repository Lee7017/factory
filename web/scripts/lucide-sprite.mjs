// Build the legacy iframe icon sprite from the same Lucide React components
// used by the new dashboard. The original <use href="#ic-*"> interface stays
// intact, so we don't need to rewrite each old business module's event code.
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import * as Lucide from "lucide-react"

const ICONS_SOURCE = fileURLToPath(new URL("../src/icons.ts",import.meta.url))
const STANDALONE_HTML = fileURLToPath(new URL("../../index.html",import.meta.url))

// Names also used in old HTML and app.js, including the unused legacy EHS icon.
// All business icon names are imported from the actual React mapping below.
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
if(Object.keys(departmentMap).length!==11)throw new Error("Expected all 11 department icon mappings")

// Keep React and legacy department symbols consistent.
const departments={
  hr:"users",sales:"sales",pmc:"pmc",purchase:"purchase",
  warehouse:"warehouse",quality:"quality",production:"production",
  engineering:"engineering",finance:"finance",it:"it",leadership:"leadership"
}
for(const [dept,legacyId] of Object.entries(departments)){
  if(departmentMap[dept]!==COMMON[legacyId])throw new Error(`Department icon drift: ${dept}`)
}

const symbols={
  ...Object.fromEntries(Object.entries(COMMON).map(([id,name])=>[`ic-${id}`,name])),
  ...Object.fromEntries(Object.entries(featureMap).map(([id,name])=>[`ic-feature-${id}`,name]))
}
const html = await readFile(STANDALONE_HTML,"utf8")
const oldIds = [...html.matchAll(/<symbol\s+id="(ic-[^"]+)"/g)].map(m=>m[1])
if(oldIds.length!==77 || new Set(oldIds).size!==oldIds.length){
  throw new Error(`Expected 77 unique original SVG symbol IDs; found ${oldIds.length}`)
}
if(oldIds.some(id=>!symbols[id]) || Object.keys(symbols).some(id=>!oldIds.includes(id))){
  throw new Error("Legacy SVG IDs differ from Lucide mapping; sync map before building")
}
export const iconMappings = symbols

export function makeLucideSprite(){
  const rendered=oldIds.map(id=>{
    const componentName=symbols[id],Component=Lucide[componentName]
    if(!Component)throw new Error(`Missing Lucide export ${componentName} for ${id}`)
    const markup=renderToStaticMarkup(createElement(Component,{size:24,strokeWidth:2}))
    const body=markup.match(/^<svg\b[^>]*>([\s\S]*?)<\/svg>$/)?.[1]
    if(!body)throw new Error(`Unexpected Lucide SVG markup: ${componentName}`)
    return `<symbol id="${id}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" data-lucide-icon="${componentName}">${body}</symbol>`
  }).join("")
  return `<svg class="svg-bank" xmlns="http://www.w3.org/2000/svg" data-icon-library="lucide">${rendered}</svg>`
}
export function injectLucideSprite(document) {
  const updated = document.replace(/<svg\s+class="svg-bank"[^>]*>[\s\S]*?<\/svg>/,makeLucideSprite())
  if(updated===document)throw new Error("Cannot locate legacy SVG sprite in index.html")
  return updated
}
