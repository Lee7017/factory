import { mkdir, copyFile, writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { makeLucideSprite } from "./lucide-sprite.mjs"

// Only the still-active MES business engines are distributed with the React app.
// The former standalone legacy HTML, navigation and iframe bridge are not used.
const sourceDir=fileURLToPath(new URL("../../", import.meta.url))
const outputDir=fileURLToPath(new URL("../public/legacy/", import.meta.url))
await mkdir(outputDir,{recursive:true})
const activeScripts=[
 "access.js","operations.js","gantt.js","modules.js","flow-ui.js","procurement.js"
]
for(const name of activeScripts)
 await copyFile(path.join(sourceDir,name),path.join(outputDir,name))

// React reads these symbols through its own document; legacy business HTML
// continues using <svg><use href="#ic-*"> without an extra iframe.
await writeFile(fileURLToPath(new URL("../src/generated-lucide-sprite.ts",import.meta.url)),
 `/* Generated from active Lucide mappings; do not edit. */
export const SVG_SPRITE = ${JSON.stringify(makeLucideSprite())}
`,"utf8")
await import("./scope-legacy-css.mjs")
console.log(`Prepared ${activeScripts.length} business scripts and scoped styles for React.`)
