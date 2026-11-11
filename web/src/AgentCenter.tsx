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

function MascotSwarm({dept,large=false}:{dept:AgentDepartment;large?:boolean}){
  return <span className={"mascot-swarm "+(large?"large":"")}>
    <i><img src={agentAsset(dept.pet)} alt="" draggable={false}/></i>
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
              const style={left:`${dept.x}%`,top:`${dept.y}%`,width:`${dept.size}%`} as CSSProperties
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
