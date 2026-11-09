import { useEffect, useRef, useState } from "react"
import { ExternalLink, Info } from "lucide-react"

interface LegacyMessage {
  type: "factory-legacy-height" | "factory-legacy-route"
  height?: number
  hash?: string
}
interface Props {
  dept: string
  feature: string
  employeeId: string
  onRoute: (hash: string) => void
  onRefresh: () => void
}
export function LegacyFrame({dept,feature,employeeId,onRoute,onRefresh}:Props) {
  const iframe = useRef<HTMLIFrameElement>(null)
  const [height,setHeight] = useState(620)
  const route = `#/departments/${dept}/${feature}`
  const source = `${import.meta.env.BASE_URL}legacy/index.html${route}`
  useEffect(()=>{
    setHeight(620)
    function receive(event:MessageEvent<LegacyMessage>){
      if(event.origin!==window.location.origin || event.source!==iframe.current?.contentWindow)return
      const msg=event.data
      if(!msg || typeof msg!=="object")return
      if(msg.type==="factory-legacy-height"&&Number.isFinite(msg.height)){
        setHeight(Math.max(260,Math.min(18000,msg.height??620)))
        onRefresh()
      }
      if(msg.type==="factory-legacy-route"&&msg.hash&&msg.hash!==route){
        if(/^#\/(overview|departments\/[a-z]+(?:\/[a-zA-Z]+)?)$/.test(msg.hash))onRoute(msg.hash)
      }
    }
    window.addEventListener("message",receive)
    return ()=>window.removeEventListener("message",receive)
  },[route,onRoute,onRefresh])
  return <section className="mt-0">
    <div className="legacy-note">
      <Info size={14} aria-hidden="true" />
      <span>此业务模块仍沿用原有单据操作；新界面与旧模块使用同一浏览器数据。</span>
      <a href={source} target="_blank" rel="noreferrer" className="ml-auto inline-flex shrink-0 items-center gap-1 hover:underline">
        独立打开 <ExternalLink size={12}/>
      </a>
    </div>
    <iframe
      ref={iframe} key={`${employeeId}-${route}`}
      title={`业务模块：${feature}`}
      src={source} className="legacy-frame"
      style={{height}} loading="eager"
      onLoad={onRefresh}
    />
  </section>
}
