import { useMemo, useState, type CSSProperties } from "react"
import {
  Activity, ArrowUpRight, Bot, CheckCircle2, Coins, FileText,
  MessageSquareText, Play, Sparkles, Wallet, Zap
} from "lucide-react"
import "./agent-center.css"

const agentAsset=(name:string)=>`${import.meta.env.BASE_URL}agent-map/${name}`

type DeptKind="sales"|"pmc"|"purchase"|"warehouse"|"production"|"quality"|"finance"|"hr"
type AgentDepartment={
  id:string; kind:DeptKind; name:string; short:string; building:string; pet:string; mascotTone:string;
  agent:string; instance:string; count:number; status:string; tasks:number; credit:number;
  x:number; y:number; size:number; accent:string; skills:string[]; summary:string;
}

const DEPARTMENTS:AgentDepartment[]=[
  {id:"sales",kind:"sales",building:"sales.webp",name:"销售部",short:"销售",pet:"pets/fox.webp",mascotTone:"#ead8c7",agent:"狐狸商务助手",instance:"单实例",count:1,status:"客户需求跟进中",tasks:3,credit:18240,x:18,y:43,size:18,accent:"#6ea17a",skills:["客户需求摘要","订单风险提示","交付沟通草稿"],summary:"盯客户、订单与交付承诺，自动整理关键信息并把异常推给对应部门。"},
  {id:"pmc",kind:"pmc",building:"pmc.webp",name:"生产计划与物料控制部",short:"PMC",pet:"pets/bees.webp",mascotTone:"#f0d77e",agent:"蜂群排程",instance:"多实例",count:3,status:"排程中",tasks:5,credit:86420,x:37,y:27,size:20,accent:"#5d986d",skills:["APS 排程建议","物料齐套分析","交期冲突模拟"],summary:"同时拆解多个订单、物料和产能约束，输出可确认的排程方案与风险解释。"},
  {id:"purchase",kind:"purchase",building:"procurement.webp",name:"采购 / 供应链部",short:"采购",pet:"pets/ants.webp",mascotTone:"#d9b69d",agent:"蚁群寻源",instance:"多实例",count:4,status:"供应风险巡检",tasks:8,credit:46210,x:65,y:27,size:19,accent:"#7da778",skills:["缺料追踪","供应商比价","到货延期预警"],summary:"并行盯采购订单、供应商交付和关键物料缺口，把影响排程的风险提前暴露。"},
  {id:"warehouse",kind:"warehouse",building:"warehouse.webp",name:"仓库 / 物流部",short:"仓库",pet:"pets/birds.webp",mascotTone:"#b8d6df",agent:"鸟群仓巡",instance:"多实例",count:5,status:"库存巡检",tasks:6,credit:35560,x:82,y:47,size:20,accent:"#638b76",skills:["库存异常扫描","FIFO 建议","发运准备核查"],summary:"在库存、批次、效期和出入库之间来回巡查，发现异常就把业务对象挂到消息里。"},
  {id:"production",kind:"production",building:"production.webp",name:"生产车间",short:"生产",pet:"pets/wolves.webp",mascotTone:"#d1d3cb",agent:"狼群执行",instance:"多实例",count:3,status:"任务协同中",tasks:4,credit:73380,x:30,y:69,size:20,accent:"#628a70",skills:["任务拆解","异常上报归因","工序协同提醒"],summary:"围绕生产任务并行执行检查、催办和信息归集，把现场异常快速回传给计划与质量。"},
  {id:"quality",kind:"quality",building:"quality.webp",name:"质量部 QA / QC",short:"质量",pet:"pets/owl.webp",mascotTone:"#d9ccb2",agent:"猫头鹰质检官",instance:"单实例",count:1,status:"检验复核中",tasks:2,credit:28480,x:70,y:69,size:19,accent:"#759b82",skills:["检验结果摘要","异常批次追踪","放行证据整理"],summary:"聚合来料、过程和成品质量信息，帮助 QA/QC 快速定位异常批次和待确认事项。"},
  {id:"finance",kind:"finance",building:"finance.webp",name:"财务部",short:"财务",pet:"pets/bear.webp",mascotTone:"#dfc5a8",agent:"小熊财务管家",instance:"单实例",count:1,status:"经营汇总中",tasks:3,credit:21460,x:52,y:82,size:17,accent:"#78946a",skills:["成本变化摘要","应收应付提醒","经营分析草稿"],summary:"把业务数据翻译成财务语言，汇总成本、结算和经营变化，给管理层准备解释材料。"},
  {id:"hr",kind:"hr",building:"hr.webp",name:"人事行政办公室",short:"人事",pet:"pets/cat.webp",mascotTone:"#e5d9d0",agent:"小猫人事助理",instance:"单实例",count:1,status:"员工服务中",tasks:2,credit:12670,x:54,y:13,size:16,accent:"#83a17c",skills:["请假考勤问答","培训材料整理","员工事项提醒"],summary:"承担日常员工服务、制度问答和材料整理，让行政事务有一个持续在线的助手。"},
]

const ACTIVE_TASKS=[
  ["PMC 蜂群","分析 SO-20261111-017 的交期冲突","正在并行模拟 3 套产能方案","运行中"],
  ["采购蚁群","追踪 4 个关键物料的到货承诺","其中 1 项可能影响后天开工","需关注"],
  ["质量猫头鹰","整理 B20261111-06 批次放行证据","检验数据已齐，等待 QA 确认","待确认"],
  ["仓库鸟群","扫描冻结批次与 FIFO 偏差","发现 2 项需要仓管复核","运行中"],
]

const OUTPUTS=[
  ["排程方案 V3","APS 草案 · XLSX","PMC 蜂群","10:42"],
  ["缺料影响清单","风险分析 · PDF","采购蚁群","10:18"],
  ["订单交付摘要","经营简报 · DOCX","狐狸商务助手","09:56"],
]

function MapTerrain(){
  const trees=[[75,165],[125,120],[205,92],[890,112],[970,150],[1020,220],[94,520],[150,585],[230,620],[865,590],[940,545],[1010,500],[365,98],[760,105],[125,330],[970,350],[430,625],[770,620]]
  return <svg className="agent-map-terrain" viewBox="0 0 1100 733" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <defs>
      <linearGradient id="agentGrass" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#c8d7b6"/><stop offset="1" stopColor="#9fbe92"/></linearGradient>
      <linearGradient id="agentWater" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#76b9bd"/><stop offset="1" stopColor="#4b929b"/></linearGradient>
      <filter id="agentShadow"><feDropShadow dx="0" dy="9" stdDeviation="8" floodColor="#526458" floodOpacity=".2"/></filter>
      <pattern id="agentRoadDots" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="9" cy="9" r="1.2" fill="#c4c7bd" opacity=".45"/></pattern>
    </defs>
    <path d="M86 86 L548 22 L1014 90 L1072 555 L907 690 L198 695 L38 545 Z" fill="#7c9d78" opacity=".25" filter="url(#agentShadow)"/>
    <path d="M76 70 L548 16 L1018 78 L1060 536 L902 669 L199 675 L48 531 Z" fill="url(#agentGrass)" stroke="#819e78" strokeWidth="5"/>
    <path d="M49 533 C165 495 248 520 344 570 C470 637 586 635 699 602 C807 571 894 553 1058 536 L902 669 L199 675 Z" fill="url(#agentWater)" opacity=".94"/>
    <path d="M68 516 C188 485 270 511 360 558 C481 620 583 616 693 585 C816 550 904 533 1048 520" fill="none" stroke="#e8dfc7" strokeWidth="17" opacity=".76"/>
    <g fill="#d6d4ca" stroke="#b7bbb1" strokeWidth="2">
      <path d="M500 89 L598 86 L603 618 L500 622 Z"/>
      <path d="M117 319 L983 307 L987 395 L116 406 Z"/>
      <path d="M214 159 L278 122 L858 558 L801 596 Z"/>
      <path d="M827 155 L886 193 L295 590 L242 548 Z"/>
    </g>
    <g fill="url(#agentRoadDots)" opacity=".55">
      <path d="M500 89 L598 86 L603 618 L500 622 Z"/><path d="M117 319 L983 307 L987 395 L116 406 Z"/>
    </g>
    <g className="terrain-lots" fill="#dcd9cd" stroke="#aeb5a9" strokeWidth="3">
      <path d="M112 250 L237 213 L318 253 L190 293 Z"/><path d="M328 133 L449 98 L529 139 L405 176 Z"/>
      <path d="M648 132 L770 98 L850 139 L726 177 Z"/><path d="M820 283 L948 247 L1026 289 L895 326 Z"/>
      <path d="M247 472 L378 435 L458 478 L326 518 Z"/><path d="M651 473 L780 438 L860 480 L729 519 Z"/>
      <path d="M456 550 L575 518 L650 555 L529 591 Z"/><path d="M477 48 L571 25 L631 54 L536 79 Z"/>
    </g>
    <g className="terrain-crosswalk" stroke="#f2efe5" strokeWidth="7" opacity=".9">
      <path d="M520 300 l0 72"/><path d="M540 300 l0 72"/><path d="M560 300 l0 72"/><path d="M580 300 l0 72"/>
    </g>
    {trees.map(([x,y],i)=><g key={i} transform={`translate(${x} ${y})`}>
      <ellipse cy="15" rx="20" ry="8" fill="#71886e" opacity=".22"/><rect x="-3" y="5" width="6" height="16" rx="2" fill="#806b4c"/>
      <circle cx="-8" cy="-3" r="17" fill={i%3===0?"#78a769":"#6e9d64"}/><circle cx="9" cy="-7" r="15" fill={i%4===0?"#96b873":"#80aa6e"}/><circle cy="-16" r="15" fill="#8eb477"/>
    </g>)}
    <g opacity=".6" fill="#e9b6b9">{[[155,185],[920,180],[205,560],[890,515]].map(([x,y],i)=><g key={i} transform={`translate(${x} ${y})`}><circle r="17"/><circle cx="13" cy="-6" r="13"/><circle cx="-11" cy="-9" r="12"/></g>)}</g>
    <circle cx="550" cy="356" r="67" fill="#d8dacd" stroke="#aeb8aa" strokeWidth="8"/>
    <circle cx="550" cy="356" r="46" fill="#bdd0b2" stroke="#8ea68a" strokeWidth="4"/>
    <circle cx="550" cy="356" r="25" fill="#dce9d8"/>
  </svg>
}

function MapPetAvatar({kind}:{kind:DeptKind}){
  const cfg={
    sales:{head:"#f28a35",light:"#fff1dc",dark:"#7a3a1f"},
    pmc:{head:"#f6c945",light:"#fff3c9",dark:"#74451e"},
    purchase:{head:"#e86f3b",light:"#ffe1ca",dark:"#743a27"},
    warehouse:{head:"#7388cc",light:"#eef1ff",dark:"#39456f"},
    production:{head:"#7f817f",light:"#f1eeee",dark:"#3e4141"},
    quality:{head:"#a86539",light:"#f5e7d2",dark:"#60381f"},
    finance:{head:"#c98546",light:"#f4dfc4",dark:"#704122"},
    hr:{head:"#f0c79b",light:"#fff1df",dark:"#9d6538"},
  }[kind]
  const gid="map-pet-"+kind
  const pointy=kind==="sales"||kind==="production"||kind==="hr"
  const antenna=kind==="pmc"||kind==="purchase"
  const bird=kind==="warehouse"
  const owl=kind==="quality"
  const bear=kind==="finance"
  return <svg className={"map-pet-avatar pet-"+kind} viewBox="0 0 72 72" aria-hidden="true">
    <defs>
      <linearGradient id={gid+"-h"} x1="0" y1="0" x2="0" y2="1"><stop stopColor={cfg.head}/><stop offset="1" stopColor={cfg.dark}/></linearGradient>
      <linearGradient id={gid+"-g"} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#ffe878"/><stop offset=".55" stopColor="#f6b91f"/><stop offset="1" stopColor="#c88408"/></linearGradient>
    </defs>
    <ellipse cx="36" cy="66" rx="21" ry="3" fill="#294532" opacity=".15"/>
    {pointy&&<g fill={"url(#"+gid+"-h)"} stroke={cfg.dark} strokeWidth="1.4"><path d="M18 29 12 10 29 20Z"/><path d="M54 29 60 10 43 20Z"/></g>}
    {antenna&&<g fill="none" stroke={cfg.dark} strokeWidth="2.5" strokeLinecap="round"><path d="M27 20C25 11 21 8 18 7"/><path d="M45 20C47 11 51 8 54 7"/><circle cx="17" cy="6" r="3" fill={cfg.head} stroke="none"/><circle cx="55" cy="6" r="3" fill={cfg.head} stroke="none"/></g>}
    {bear&&<g fill={"url(#"+gid+"-h)"} stroke={cfg.dark} strokeWidth="1.3"><circle cx="17" cy="25" r="8"/><circle cx="55" cy="25" r="8"/></g>}
    {owl&&<g fill={"url(#"+gid+"-h)"} stroke={cfg.dark} strokeWidth="1.3"><path d="M15 29 13 13 29 22Z"/><path d="M57 29 59 13 43 22Z"/></g>}
    <path d="M16 31C16 20 24 15 36 15s20 5 20 16v14c0 12-8 20-20 20s-20-8-20-20Z" fill={"url(#"+gid+"-h)"} stroke={cfg.dark} strokeWidth="1.5"/>
    {kind==="hr"&&<g stroke="#b36f37" strokeWidth="2" strokeLinecap="round"><path d="M29 19l1 5"/><path d="M36 18v6"/><path d="M43 19l-1 5"/></g>}
    {bird&&<path d="M20 40c7-8 25-8 32 0v7c-4 10-28 10-32 0Z" fill={cfg.light}/>}
    {!bird&&!owl&&<ellipse cx="36" cy="46" rx="13" ry="10" fill={cfg.light}/>}
    {owl&&<path d="M17 29 25 18 36 25 47 18 55 29 52 43 20 43Z" fill={cfg.light} opacity=".92"/>}
    <g fill="#fff" stroke="#34251e" strokeWidth="1.2"><ellipse cx="28" cy="36" rx={owl?8:6.5} ry={owl?9:7.5}/><ellipse cx="44" cy="36" rx={owl?8:6.5} ry={owl?9:7.5}/></g>
    <g fill="#442817"><ellipse cx="29" cy="37" rx="3.2" ry="4.5"/><ellipse cx="43" cy="37" rx="3.2" ry="4.5"/><circle cx="30" cy="35.5" r="1" fill="#fff"/><circle cx="44" cy="35.5" r="1" fill="#fff"/></g>
    {owl&&<g fill="none" stroke="#d69d19" strokeWidth="2"><circle cx="28" cy="36" r="9"/><circle cx="44" cy="36" r="9"/></g>}
    {bird?<path d="M31 44 36 40 42 44 36 49Z" fill="#f6bd24" stroke="#b76b0b" strokeWidth="1"/>:owl?<path d="M33 44 36 40 39 44 36 48Z" fill="#efad1e"/>:<g><ellipse cx="36" cy="43.5" rx="3.2" ry="2.3" fill={cfg.dark}/><path d="M32 49q4 4 8 0" fill="none" stroke="#702d29" strokeWidth="1.8" strokeLinecap="round"/></g>}
    <path d="M18 25C23 18 29 15 36 15s13 3 18 10l-2 5H20Z" fill="#356f3d" stroke="#e8b72d" strokeWidth="2"/>
    <circle cx="36" cy="22" r="5" fill={"url(#"+gid+"-g)"}/>
    {kind==="pmc"&&<g stroke="#56682d" strokeWidth="1" fill="none"><rect x="33.5" y="19.5" width="5" height="4" rx=".6"/><path d="M34.5 21.5h3"/></g>}
    {kind==="purchase"&&<path d="M33 21h5l-.7 2.5h-3.2L33 19.5h-1.2" fill="none" stroke="#674018" strokeWidth="1"/>}
    {kind==="warehouse"&&<path d="M33 21 36 19.5 39 21v3l-3 1.5-3-1.5Z" fill="none" stroke="#51461e" strokeWidth="1"/>}
    {kind==="production"&&<path d="m33 20 2 2 4-3 1 1-3 4 2 2-1 1-2-2-2 2-1-1 2-2-3-3Z" fill="#62471a"/>}
    {kind==="quality"&&<path d="m33 22 2 2 4-4" fill="none" stroke="#416c2a" strokeWidth="1.5" strokeLinecap="round"/>}
    {kind==="finance"&&<path d="M33 20h6M36 19v6M34 22h4" fill="none" stroke="#684019" strokeWidth="1.1" strokeLinecap="round"/>}
    {kind==="hr"&&<g fill="#56743a"><circle cx="36" cy="21" r="1.3"/><path d="M33.5 24q2.5-3 5 0Z"/></g>}
    {kind==="sales"&&<path d="M34 20h4l1 5h-6Z" fill="none" stroke="#684019" strokeWidth="1"/>}
    <path d="M18 30c-4 1-5 7-4 12" fill="none" stroke="#332823" strokeWidth="3.2" strokeLinecap="round"/>
    <rect x="11" y="38" width="6" height="9" rx="2.5" fill="#2f6840" stroke="#e7b429" strokeWidth="1.5"/>
    <path d="M14 46c2 5 7 7 12 7" fill="none" stroke="#332823" strokeWidth="2.4" strokeLinecap="round"/><circle cx="26" cy="53" r="2.2" fill="#e7b429"/>
  </svg>
}

function MascotSwarm({dept,large=false}:{dept:AgentDepartment;large?:boolean}){
  return <span className={"mascot-swarm "+(large?"large":"")}>
    <i>{large?<img src={agentAsset(dept.pet)} alt="" draggable={false}/>:<MapPetAvatar kind={dept.kind}/>}</i>
    {dept.count>1?<em className="pet-instance-count">×{dept.count}</em>:null}
  </span>
}

export function AgentCenter({onSelect}:{onSelect:(hash:string)=>void}){
  const [selectedId,setSelectedId]=useState("pmc")
  const selected=useMemo(()=>DEPARTMENTS.find(item=>item.id===selectedId)??DEPARTMENTS[1],[selectedId])
  const totalCredits=638420, limit=800000
  return <section className="agent-center-page">
    <header className="agent-center-head">
      <div>
        <span className="agent-kicker"><Sparkles size={13}/>AI Agent 中心</span>
        <h1>工厂智能协同地图</h1>
        <p>部门建筑、守护兽、业务状态和 AI 网络都是独立图层，可分别动起来。</p>
      </div>
      <div className="agent-head-status"><i/>Agent 网络在线 <strong>28</strong></div>
    </header>

    <section className="agent-wallet glass-panel">
      <div className="agent-wallet-main"><span className="agent-wallet-icon"><Coins size={21}/></span><div><small>企业共享 Credits</small><strong>{totalCredits.toLocaleString()}</strong><em>所有部门 / 所有 Agent 共用</em></div></div>
      <div className="agent-wallet-progress"><div><span>本月可用额度</span><b>{Math.round(totalCredits/limit*100)}%</b></div><i><span style={{width:`${totalCredits/limit*100}%`}}/></i></div>
      <div className="agent-wallet-metrics"><span>今日消耗 <b>28,640</b></span><span>运行任务 <b>12</b></span><span>待确认 <b>4</b></span></div>
      <button type="button" className="agent-recharge"><Wallet size={14}/>充值</button>
    </section>

    <div className="agent-main-grid">
      <section className="agent-map-panel glass-panel">
        <div className="agent-panel-head"><div><h2>智慧地图</h2><p>点击建筑查看守护兽；线路、建筑和宠物均独立动画</p></div><div className="agent-map-legend"><span><i className="online"/>在线</span><span><i className="busy"/>执行中</span><span><i className="confirm"/>待确认</span></div></div>
        <div className="agent-map-viewport">
          <div className="agent-map-stage">
            <MapTerrain/>
            <svg className="agent-map-network" viewBox="0 0 1100 733" preserveAspectRatio="none" aria-hidden="true">
              <g className="network-soft"><path d="M550 356 L198 315"/><path d="M550 356 L410 198"/><path d="M550 356 L715 195"/><path d="M550 356 L910 345"/><path d="M550 356 L335 505"/><path d="M550 356 L748 505"/><path d="M550 356 L550 590"/><path d="M550 356 L590 95"/></g>
              <g className="network-flow"><path d="M550 356 L198 315"/><path d="M550 356 L410 198"/><path d="M550 356 L715 195"/><path d="M550 356 L910 345"/><path d="M550 356 L335 505"/><path d="M550 356 L748 505"/><path d="M550 356 L550 590"/><path d="M550 356 L590 95"/></g>
            </svg>
            <div className="agent-core" aria-hidden="true"><span>AI</span><i/><i/><i/></div>
            {DEPARTMENTS.map((dept)=>{
              const heightPct=dept.size*1100/733
              const style={left:`${dept.x-dept.size/2}%`,top:`${dept.y-heightPct/2}%`,width:`${dept.size}%`} as CSSProperties
              return <button type="button" key={dept.id} style={style} className={`agent-map-dept ${selectedId===dept.id?"selected":""}`} onClick={()=>setSelectedId(dept.id)} aria-label={`查看${dept.name} Agent`}>
                <img className="dept-building-image" src={agentAsset(dept.building)} alt="" draggable={false}/><MascotSwarm dept={dept}/>
                <span className="agent-map-badge"><b>{dept.short}</b><small>{dept.agent}</small><em><i/>{dept.status}</em></span>
              </button>
            })}
          </div>
        </div>
      </section>

      <aside className="agent-inspector glass-panel">
        <div className="agent-inspector-top"><div className="agent-inspector-art"><MascotSwarm dept={selected} large/></div><div><span>{selected.instance}{selected.count>1?` · ${selected.count}`:""}</span><h2>{selected.agent}</h2><p>{selected.name}</p></div></div>
        <div className="agent-live-status"><span><Activity size={14}/>当前状态</span><strong><i/>{selected.status}</strong></div>
        <p className="agent-summary">{selected.summary}</p>
        <div className="agent-inspector-stats"><div><small>正在处理</small><b>{selected.tasks}</b><em>个任务</em></div><div><small>今日消耗</small><b>{selected.credit.toLocaleString()}</b><em>Credits</em></div></div>
        <div className="agent-skill-list"><h3>主要能力</h3>{selected.skills.map(skill=><div key={skill}><CheckCircle2 size={13}/><span>{skill}</span></div>)}</div>
        <div className="agent-inspector-actions"><button type="button" onClick={()=>onSelect(`#/departments/${selected.id}`)}>打开部门<ArrowUpRight size={13}/></button><button type="button" className="quiet"><MessageSquareText size={13}/>历史会话</button></div>
        <div className="agent-inspector-foot"><Zap size={13}/>任务执行产生的会话、文件和业务引用会自动归档到 Agent 档案。</div>
      </aside>
    </div>

    <div className="agent-lower-grid">
      <section className="agent-task-panel glass-panel"><div className="agent-panel-head compact"><div><h2>正在执行</h2><p>跨部门 Agent 任务实时队列</p></div><button type="button">全部任务<ArrowUpRight size={12}/></button></div><div className="agent-task-list">{ACTIVE_TASKS.map(([agent,title,desc,state],index)=><button type="button" key={title} className="agent-task-row"><span className={`agent-task-icon t${index}`}><Play size={12}/></span><span className="agent-task-copy"><small>{agent}</small><strong>{title}</strong><em>{desc}</em></span><span className="agent-task-state">{state}</span></button>)}</div></section>
      <section className="agent-output-panel glass-panel"><div className="agent-panel-head compact"><div><h2>最近产物</h2><p>Agent 自动归档的文件与分析结果</p></div><button type="button">产物库<ArrowUpRight size={12}/></button></div><div className="agent-output-list">{OUTPUTS.map(([title,type,agent,time])=><button type="button" key={title} className="agent-output-row"><span><FileText size={15}/></span><div><strong>{title}</strong><small>{type} · {agent}</small></div><em>{time}</em></button>)}</div><div className="agent-output-note"><Bot size={14}/><span>产物可继续被其他 Agent 引用，形成可追溯的企业智能工作链。</span></div></section>
    </div>
  </section>
}
