import React from "react"
import ReactDOM from "react-dom/client"
import App from "@/App"
import "@/styles.css"
import "@/visual-style.css"
import "@/overview-dashboard.css"

const root=document.getElementById("root")
if(!root)throw new Error("React root not found")
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App/>
  </React.StrictMode>
)
