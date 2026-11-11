import { useMemo, useState, type CSSProperties } from "react"
import {
  Activity, ArrowUpRight, Bot, CheckCircle2, Coins, FileText,
  MessageSquareText, Play, Sparkles, Wallet, Zap
} from "lucide-react"
import "./agent-center.css"

type AgentDepartment={
  id:string; name:string; short:string; building:string; mascot:string;
  agent:string; instance:string; status:string; tasks:number; credit:number;
  x:number; y:number; size:number; skills:string[]; summary:string;
}

const asset=(name:string)=>`${import.meta.env.BASE_URL}agent-map/${name}`

const DEPARTMENTS:AgentDepartment[]=[
  {id:"sales",name:"销售部",short:"销售",building:"sales.webp",mascot:"fox.webp",agent:"狐狸商务助手",instance:"单实例",status:"客户需求跟进中",tasks:3,credit:18240,x:20,y:43,size:21,skills:["客户需求摘要","订单风险提示","交付沟通草稿"],summary:"盯客户、订单与交付承诺，自动整理关键信息并把异常推给对应部门。"},
  {id:"pmc",name:"生产计划与物料控制部",short:"PMC",building:"pmc.webp",mascot:"bees.webp",agent:"蜂群排程",instance:"多实例 · 3",status:"排程中",tasks:5,credit:86420,x:38,y:29,size:22,skills:["APS 排程建议","物料齐套分析","交期冲突模拟"],summary:"同时拆解多个订单、物料和产能约束，输出可确认的排程方案与风险解释。"},
  {id:"purchase",name:"采购 / 供应链部",short:"采购",building:"procurement.webp",mascot:"ants.webp",agent:"蚁群寻源",instance:"多实例 · 4",status:"供应风险巡检",tasks:8,credit:46210,x:65,y:29,size:21,skills:["缺料追踪","供应商比价","到货延期预警"],summary:"并行盯采购订单、供应商交付和关键物料缺口，把影响排程的风险提前暴露。"},
  {id:"warehouse",name:"仓库 / 物流部",short:"仓库",building:"warehouse.webp",mascot:"birds.webp",agent:"鸟群仓巡",instance:"多实例 · 5",status:"库存巡检",tasks:6,credit:35560,x:80,y:47,size:22,skills:["库存异常扫描","FIFO 建议","发运准备核查"],summary:"在库存、批次、效期和出入库之间来回巡查，发现异常就把业务对象挂到消息里。"},
  {id:"production",name:"生产车间",short:"生产",building:"production.webp",mascot:"ants.webp",agent:"蚁群执行",instance:"多实例 · 6",status:"任务协同中",tasks:4,credit:73380,x:32,y:68,size:22,skills:["任务拆解","异常上报归因","工序协同提醒"],summary:"围绕生产任务并行执行检查、催办和信息归集，把现场异常快速回传给计划与质量。"},
  {id:"quality",name:"质量部 QA / QC",short:"质量",building:"quality.webp",mascot:"owl.webp",agent:"猫头鹰质检官",instance:"单实例",status:"检验复核中",tasks:2,credit:28480,x:63,y:69,size:21,skills:["检验结果摘要","异常批次追踪","放行证据整理"],summary:"聚合来料、过程和成品质量信息，帮助 QA/QC 快速定位异常批次和待确认事项。"},
  {id:"finance",name:"财务部",short:"财务",building:"finance.webp",mascot:"bear.webp",agent:"小熊财务管家",instance:"单实例",status:"经营汇总中",tasks:3,credit:21460,x:50,y:82,size:19,skills:["成本变化摘要","应收应付提醒","经营分析草稿"],summary:"把业务数据翻译成财务语言，汇总成本、结算和经营变化，给管理层准备解释材料。"},
  {id:"hr",name:"人事行政办公室",short:"人事",building:"hr.webp",mascot:"cat.webp",agent:"小猫人事助理",instance:"单实例",status:"员工服务中",tasks:2,credit:12670,x:55,y:15,size:17,skills:["请假考勤问答","培训材料整理","员工事项提醒"],summary:"承担日常员工服务、制度问答和材料整理，让行政事务有一个持续在线的助手。"},
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

export function AgentCenter({onSelect}:{onSelect:(hash:string)=>void}){
  const [selectedId,setSelectedId]=useState("pmc")
  const selected=useMemo(()=>DEPARTMENTS.find(item=>item.id===selectedId)??DEPARTMENTS[1],[selectedId])
  const totalCredits=638420, limit=800000
  return <section className="agent-center-page">
    <header className="agent-center-head">
      <div>
        <span className="agent-kicker"><Sparkles size={13}/>AI Agent 中心</span>
        <h1>工厂智能协同地图</h1>
        <p>每个部门都有自己的 AI 守护兽；多实例 Agent 会按任务临时分群，企业 Credits 统一共享。</p>
      </div>
      <div className="agent-head-status"><i/>Agent 网络在线 <strong>28</strong></div>
    </header>

    <section className="agent-wallet glass-panel">
      <div className="agent-wallet-main">
        <span className="agent-wallet-icon"><Coins size={21}/></span>
        <div><small>企业共享 Credits</small><strong>{totalCredits.toLocaleString()}</strong><em>所有部门 / 所有 Agent 共用</em></div>
      </div>
      <div className="agent-wallet-progress"><div><span>本月可用额度</span><b>{Math.round(totalCredits/limit*100)}%</b></div><i><span style={{width:`${totalCredits/limit*100}%`}}/></i></div>
      <div className="agent-wallet-metrics"><span>今日消耗 <b>28,640</b></span><span>运行任务 <b>12</b></span><span>待确认 <b>4</b></span></div>
      <button type="button" className="agent-recharge"><Wallet size={14}/>充值</button>
    </section>

    <div className="agent-main-grid">
      <section className="agent-map-panel glass-panel">
        <div className="agent-panel-head">
          <div><h2>智慧地图</h2><p>点击建筑查看该部门守护兽与正在处理的业务</p></div>
          <div className="agent-map-legend"><span><i className="online"/>在线</span><span><i className="busy"/>执行中</span><span><i className="confirm"/>待确认</span></div>
        </div>
        <div className="agent-map-viewport">
          <div className="agent-map-stage">
            <img className="agent-map-base" src={asset("map-base.webp")} alt="2.5D 工厂部门地图" draggable={false}/>
            <svg className="agent-map-network" viewBox="0 0 1100 733" preserveAspectRatio="none" aria-hidden="true">
              <g className="network-soft"><path d="M550 362 L218 315"/><path d="M550 362 L420 210"/><path d="M550 362 L715 205"/><path d="M550 362 L895 350"/><path d="M550 362 L355 510"/><path d="M550 362 L700 510"/><path d="M550 362 L550 600"/><path d="M550 362 L605 110"/></g>
              <g className="network-flow"><path d="M550 362 L218 315"/><path d="M550 362 L420 210"/><path d="M550 362 L715 205"/><path d="M550 362 L895 350"/><path d="M550 362 L355 510"/><path d="M550 362 L700 510"/><path d="M550 362 L550 600"/><path d="M550 362 L605 110"/></g>
            </svg>
            <div className="agent-core" aria-hidden="true"><span>AI</span><i/><i/><i/></div>
            {DEPARTMENTS.map((dept,index)=>{
              const style={left:`${dept.x}%`,top:`${dept.y}%`,width:`${dept.size}%`,"--idle-delay":`${index*-.37}s`} as CSSProperties
              return <button type="button" key={dept.id} style={style}
                className={`agent-map-dept ${selectedId===dept.id?"selected":""}`}
                onClick={()=>setSelectedId(dept.id)} aria-label={`查看${dept.name} Agent`}>
                <img className="agent-map-building" src={asset(dept.building)} alt="" draggable={false}/>
                <img className="agent-map-mascot" src={asset(dept.mascot)} alt="" draggable={false}/>
                <span className="agent-map-badge"><b>{dept.short}</b><small>{dept.agent}</small><em><i/>{dept.status}</em></span>
              </button>
            })}
          </div>
        </div>
      </section>

      <aside className="agent-inspector glass-panel">
        <div className="agent-inspector-top">
          <div className="agent-inspector-art"><img src={asset(selected.mascot)} alt=""/></div>
          <div><span>{selected.instance}</span><h2>{selected.agent}</h2><p>{selected.name}</p></div>
        </div>
        <div className="agent-live-status"><span><Activity size={14}/>当前状态</span><strong><i/>{selected.status}</strong></div>
        <p className="agent-summary">{selected.summary}</p>
        <div className="agent-inspector-stats"><div><small>正在处理</small><b>{selected.tasks}</b><em>个任务</em></div><div><small>今日消耗</small><b>{selected.credit.toLocaleString()}</b><em>Credits</em></div></div>
        <div className="agent-skill-list"><h3>主要能力</h3>{selected.skills.map(skill=><div key={skill}><CheckCircle2 size={13}/><span>{skill}</span></div>)}</div>
        <div className="agent-inspector-actions">
          <button type="button" onClick={()=>onSelect(`#/departments/${selected.id}`)}>打开部门<ArrowUpRight size={13}/></button>
          <button type="button" className="quiet"><MessageSquareText size={13}/>历史会话</button>
        </div>
        <div className="agent-inspector-foot"><Zap size={13}/>任务执行产生的会话、文件和业务引用会自动归档到 Agent 档案。</div>
      </aside>
    </div>

    <div className="agent-lower-grid">
      <section className="agent-task-panel glass-panel">
        <div className="agent-panel-head compact"><div><h2>正在执行</h2><p>跨部门 Agent 任务实时队列</p></div><button type="button">全部任务<ArrowUpRight size={12}/></button></div>
        <div className="agent-task-list">{ACTIVE_TASKS.map(([agent,title,desc,state],index)=><button type="button" key={title} className="agent-task-row">
          <span className={`agent-task-icon t${index}`}><Play size={12}/></span><span className="agent-task-copy"><small>{agent}</small><strong>{title}</strong><em>{desc}</em></span><span className="agent-task-state">{state}</span>
        </button>)}</div>
      </section>
      <section className="agent-output-panel glass-panel">
        <div className="agent-panel-head compact"><div><h2>最近产物</h2><p>Agent 自动归档的文件与分析结果</p></div><button type="button">产物库<ArrowUpRight size={12}/></button></div>
        <div className="agent-output-list">{OUTPUTS.map(([title,type,agent,time])=><button type="button" key={title} className="agent-output-row"><span><FileText size={15}/></span><div><strong>{title}</strong><small>{type} · {agent}</small></div><em>{time}</em></button>)}</div>
        <div className="agent-output-note"><Bot size={14}/><span>产物可继续被其他 Agent 引用，形成可追溯的企业智能工作链。</span></div>
      </section>
    </div>
  </section>
}
