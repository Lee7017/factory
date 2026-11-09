import { readFile, writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import path from "node:path"
import postcss from "postcss"

const rootDir=fileURLToPath(new URL("../../",import.meta.url))
const out=fileURLToPath(new URL("../public/legacy-business.css",import.meta.url))
const filenames=[
  "styles.css","layout.css","operations.css","gantt.css",
  "modules.css","flow-ui.css","ui-theme.css","procurement.css"
]
let generated=`/* Generated from current factory CSS for the React business host. */
/* Selectors are scoped to .legacy-root; React navigation styles stay isolated. */
`
for(const name of filenames){
 const css=await readFile(path.join(rootDir,name),"utf8")
 const ast=postcss.parse(css,{from:name})
 ast.walkRules(rule=>{
   for(let parent=rule.parent;parent;parent=parent.parent){
     if(parent.type==="atrule"&&/keyframes$/i.test(parent.name))return
   }
   rule.selectors=rule.selectors.map(selector=>{
     const s=selector.trim()
     if(s.startsWith(":root"))return s.replace(/^:root/,".legacy-root")
     if(/^(?:html|body)(?=[\s.#[>:]|$)/.test(s))return s.replace(/^(?:html|body)/,".legacy-root")
     return `.legacy-root ${s}`
   })
 })
 // Do not let the old body's page-wide background override React.
 ast.walkRules(rule=>{if(/^\.legacy-root(?:\s+\.legacy-root)?\s*$/.test(rule.selector)){
   for(const d of [...rule.nodes??[]])if(d.type==="decl"&&/background(?:-attachment|-image|-color)?/.test(d.prop))d.remove()
 }})
 generated+=`\n/* ${name} */\n${ast.toString()}\n`
}
await writeFile(out,generated,"utf8")
console.log(`Scoped ${filenames.length} existing CSS files to .legacy-root`)
