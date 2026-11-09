import { fileURLToPath, URL } from "node:url"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "/factory/",
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: { port: 5173, host: true },
  build: { outDir: "dist", emptyOutDir: true }
})
