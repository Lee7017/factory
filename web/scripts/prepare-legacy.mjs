import { mkdir, readFile, readdir, copyFile, writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { injectLucideSprite } from "./lucide-sprite.mjs"

const sourceDir = fileURLToPath(new URL("../../", import.meta.url))
const outputDir = fileURLToPath(new URL("../public/legacy/", import.meta.url))
await mkdir(outputDir, { recursive: true })
for (const name of await readdir(sourceDir)) {
  if (!/\.(?:html|css|js)$/.test(name)) continue
  await copyFile(path.join(sourceDir, name), path.join(outputDir, name))
}
let document = injectLucideSprite(await readFile(path.join(outputDir, "index.html"), "utf8"))
document = document.replace("</head>", '<link rel="stylesheet" href="./legacy-embed.css"></head>')
document = document.replace("</body>", '<script src="./legacy-bridge.js" defer></script></body>')
await writeFile(path.join(outputDir, "index.html"), document, "utf8")
for (const name of ["legacy-embed.css", "legacy-bridge.js"]) {
  await copyFile(fileURLToPath(new URL(`../legacy/${name}`, import.meta.url)), path.join(outputDir, name))
}
await import("./scope-legacy-css.mjs")
console.log("Legacy assets and React-scoped business styles prepared.")
