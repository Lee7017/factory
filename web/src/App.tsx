import { useCallback, useEffect, useState, type FormEvent } from "react"
import {
  ArrowRight, Bell, Check, CheckCheck, Factory, Home, ListTodo,
  LockKeyhole, MessageCircle, Pencil, Search, Settings, Sparkles
} from "lucide-react"
import { DEPARTMENTS, FEATURE_HINTS, FEATURE_NAMES, getDepartment, type Department } from "@/catalog"
import {
  useFactoryState, readWorkspace, updateWorkspace, getTodos, todoLane, type Employee, type Todo
} from "@/factory-state"
import { NativeBusiness } from "@/business/NativeBusiness"
import { businessFamily } from "@/business/layout"
import { LeavePage } from "@/business/LeavePage"
import { EmployeesPage } from "@/business/EmployeesPage"
import { SkillsPage } from "@/business/SkillsPage"
import { OverviewDashboard } from "@/OverviewDashboard"
import { SVG_SPRITE } from "@/generated-lucide-sprite"
import { DataBackup } from "@/components/DataBackup"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog"

type Route={kind:"overview"}|{kind:"department";dept:string;feature?:string}
type TabKey="functions"|"members"|"todos"
function parseRoute(hash:string):Route {
  const match=hash.match(/^#\/departments\/([a-z]+)(?:\/([a-zA-Z]+))?$/)
  if(match?.[1]==="engineering")return {kind:"department",dept:"production",feature:"nonProductionTasks"}
  if(match&&getDepartment(match[1]))return {kind:"department",dept:match[1],feature:match[2]}
  return {kind:"overview"}
}
function Footer() {
  return <footer className="shell-footer">工厂管理系统 · React / shadcn/ui · Lucide Icons
    <span className="ml-3">数据保存在当前浏览器，尚未连接业务服务器</span>
  </footer>
}


const SHORT_DEPARTMENT_NAMES:Record<string,string>={
  hr:"人事行政",sales:"销售部",pmc:"PMC",purchase:"采购部",warehouse:"仓库",
  quality:"质量部",production:"生产车间",finance:"财务部",it:"信息化",leadership:"总经办"
}
function shortDepartmentName(dept:Department){return SHORT_DEPARTMENT_NAMES[dept.id]??dept.name}
const DEPARTMENT_BAND_ORDER=["sales","pmc","purchase","warehouse","quality","production","finance","hr","it","leadership"]
function departmentsForBand(){
  return [...DEPARTMENTS].sort((a,b)=>DEPARTMENT_BAND_ORDER.indexOf(a.id)-DEPARTMENT_BAND_ORDER.indexOf(b.id))
}

function SystemRail({route,onSelect,employee,staff,onSwitch,messages,onRead,onReadAll,workspace}:{
  route:Route;onSelect:(hash:string)=>void;employee?:Employee;staff:Employee[];onSwitch:(id:string)=>void;
  onRead:(id:string|number)=>void;onReadAll:()=>void;
  messages:Array<{id:string|number;title:string;text:string;date?:string;unread?:boolean;dept?:string;feature?:string}>;
  workspace:ReturnType<typeof useFactoryState>["workspace"]
}) {
  const [query,setQuery]=useState("")
  const unread=messages.filter(m=>m.unread).length
  const todos=DEPARTMENTS.flatMap(dept=>getTodos(dept.id,workspace).map(todo=>({dept,todo})))
  const searchItems=[
    {label:"首页总览",hint:"工厂运行总览",hash:"#/overview"},
    ...DEPARTMENTS.flatMap(dept=>[
      {label:shortDepartmentName(dept),hint:dept.description,hash:"#/departments/"+dept.id},
      ...dept.features.map(feature=>({
        label:FEATURE_NAMES[feature]??feature,
        hint:shortDepartmentName(dept)+" · "+(FEATURE_HINTS[feature]??"业务功能"),
        hash:"#/departments/"+dept.id+"/"+feature
      }))
    ])
  ]
  const normalized=query.trim().toLocaleLowerCase()
  const results=(normalized?searchItems.filter(item=>(item.label+" "+item.hint).toLocaleLowerCase().includes(normalized)):searchItems.slice(0,9)).slice(0,16)
  return <aside className="system-rail" aria-label="系统工具">
    <button type="button" className="rail-brand" title="首页总览" aria-label="首页总览" onClick={()=>onSelect("#/overview")}>
      <Factory size={20} strokeWidth={1.7}/>
    </button>
    <div className="rail-divider"/>
    <nav className="rail-actions">
      <button type="button" className={"rail-button "+(route.kind==="overview"?"active":"")} title="首页" aria-label="首页" onClick={()=>onSelect("#/overview")}>
        <Home size={18}/>
      </button>
      <Dialog>
        <DialogTrigger asChild>
          <button type="button" className="rail-button" title="全局搜索" aria-label="全局搜索"><Search size={18}/></button>
        </DialogTrigger>
        <DialogContent className="glass-dialog command-dialog">
          <DialogHeader><DialogTitle>全局搜索</DialogTitle><DialogDescription>搜索部门、业务功能和常用入口。</DialogDescription></DialogHeader>
          <div className="command-search-wrap">
            <Search size={16}/><Input value={query} autoFocus onChange={event=>setQuery(event.target.value)} placeholder="搜索部门 / 功能"/>
          </div>
          <div className="command-results">
            {results.map(item=><DialogClose asChild key={item.hash}>
              <button type="button" className="command-result" onClick={()=>{onSelect(item.hash);setQuery("")}}>
                <strong>{item.label}</strong><span>{item.hint}</span>
              </button>
            </DialogClose>)}
            {results.length===0&&<p className="empty-note">没有找到匹配入口</p>}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog>
        <DialogTrigger asChild>
          <button type="button" className="rail-button" title="待办" aria-label={"待办，"+todos.length+" 项"}><ListTodo size={18}/>{todos.length>0&&<i className="rail-badge">{Math.min(todos.length,99)}</i>}</button>
        </DialogTrigger>
        <DialogContent className="glass-dialog">
          <DialogHeader><DialogTitle>跨部门待办</DialogTitle><DialogDescription>按当前浏览器里的业务状态汇总。</DialogDescription></DialogHeader>
          <div className="rail-list-dialog">
            {todos.length===0?<p className="empty-note">暂无待办</p>:todos.slice(0,18).map(({dept,todo})=><DialogClose asChild key={dept.id+":"+todo.kind+":"+todo.id}>
              <button type="button" className="rail-list-row" onClick={()=>onSelect("#/departments/"+dept.id+"/"+todo.feature)}>
                <span><strong>{todo.title}</strong><small>{shortDepartmentName(dept)} · {todo.id}</small></span><em>{todo.status}</em>
              </button>
            </DialogClose>)}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog>
        <DialogTrigger asChild>
          <button type="button" className="rail-button rail-message" title="消息" aria-label={"消息中心，"+unread+" 条未读"}>
            <Bell size={18}/>{unread>0&&<i className="rail-unread-dot"/>}
          </button>
        </DialogTrigger>
        <DialogContent className="glass-dialog">
          <DialogHeader><DialogTitle>消息中心</DialogTitle><DialogDescription>以下消息仅保存在当前浏览器。</DialogDescription></DialogHeader>
          <div className="flex justify-end"><Button size="sm" variant="outline" disabled={unread===0} onClick={onReadAll}><CheckCheck size={14}/>全部标记已读</Button></div>
          <div className="rail-list-dialog">
            {messages.length===0?<p className="empty-note">暂无消息</p>:messages.map(m=><DialogClose asChild key={m.id}>
              <button type="button" className="rail-list-row" onClick={()=>onRead(m.id)}>
                <span><strong>{m.unread&&<b className="message-dot"/>}{m.title}</strong><small>{m.text}</small></span><em>{m.date??""}</em>
              </button>
            </DialogClose>)}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog>
        <DialogTrigger asChild>
          <button type="button" className="rail-button rail-ai" title="AI 协同" aria-label="AI 协同"><Sparkles size={18}/><i className="rail-ai-dot"/></button>
        </DialogTrigger>
        <DialogContent className="glass-dialog">
          <DialogHeader><DialogTitle>AI 协同</DialogTitle><DialogDescription>按任务形态区分单实例与多实例 Agent。</DialogDescription></DialogHeader>
          <div className="agent-mini-list">
            <div><span>🐻</span><strong>小熊管家</strong><small>单实例 · 跨部门提醒与汇总</small></div>
            <div><span>🐝</span><strong>蜂群排程</strong><small>多实例 · 并行分析排程任务</small></div>
            <div><span>🐜</span><strong>蚁群巡检</strong><small>多实例 · 并行核查业务异常</small></div>
          </div>
        </DialogContent>
      </Dialog>
    </nav>
    <div className="rail-bottom">
      <button type="button" className={"rail-button "+(route.kind==="department"&&route.dept==="it"?"active":"")} title="系统设置" aria-label="系统设置"
        onClick={()=>onSelect("#/departments/it/settings")}><Settings size={18}/></button>
      <Dialog>
        <DialogTrigger asChild>
          <button type="button" className="rail-user" title={employee?employee.name+" · "+employee.dept:"当前员工"} aria-label="切换当前员工">
            {employee?.name.slice(-1)??"工"}
          </button>
        </DialogTrigger>
        <DialogContent className="glass-dialog">
          <DialogHeader><DialogTitle>切换当前员工</DialogTitle><DialogDescription>切换只影响本浏览器内的演示身份。</DialogDescription></DialogHeader>
          <div className="rail-list-dialog">
            {staff.map(person=><DialogClose asChild key={person.id}>
              <button type="button" className="rail-list-row" onClick={()=>onSwitch(person.id)}>
                <span><strong>{person.name}</strong><small>{person.title} · {person.dept}</small></span>
                {person.id===employee?.id?<Check size={16}/>:<em>{person.id}</em>}
              </button>
            </DialogClose>)}
          </div>
          <DataBackup/>
        </DialogContent>
      </Dialog>
    </div>
  </aside>
}

function DepartmentBand({route,onSelect}:{route:Route;onSelect:(hash:string)=>void}) {
  return <div className="department-band-shell">
    <nav className="department-band" aria-label="部门导航">
      {departmentsForBand().map(dept=>{
        const active=route.kind==="department"&&route.dept===dept.id
        return <button type="button" key={dept.id} className={"department-band-button "+(active?"active":"")}
          aria-current={active?"page":undefined} onClick={()=>onSelect("#/departments/"+dept.id)}>
          <span className="department-band-dot"/>{shortDepartmentName(dept)}
        </button>
      })}
    </nav>
  </div>
}

function FeatureBand({route,onSelect,can}:{route:Route;onSelect:(hash:string)=>void;can:(dept:string,feature:string,action?:string)=>boolean}) {
  if(route.kind!=="department")return null
  const dept=getDepartment(route.dept)
  if(!dept)return null
  return <div className="feature-band">
    <nav className="feature-band-nav" aria-label={dept.name+"业务功能"}>
      <button type="button" className={"feature-band-button "+(!route.feature?"active":"")}
        aria-current={!route.feature?"page":undefined} onClick={()=>onSelect("#/departments/"+dept.id)}>部门总览</button>
      {dept.features.map(feature=>{
        const allowed=can(dept.id,feature),active=route.feature===feature
        return <button type="button" key={feature} className={"feature-band-button "+(active?"active":"")}
          disabled={!allowed} aria-current={active?"page":undefined}
          title={allowed?(FEATURE_HINTS[feature]??"业务功能"):"当前员工无访问权限"}
          onClick={()=>onSelect("#/departments/"+dept.id+"/"+feature)}>
          {FEATURE_NAMES[feature]??feature}
        </button>
      })}
    </nav>
    <div className="business-context-tools-host" id="business-context-tools-host" aria-live="polite"/>
  </div>
}

function FeatureGrid({dept,can,onSelect}:{
  dept:Department;can:(dept:string,feature:string,action?:string)=>boolean;
  onSelect:(hash:string)=>void
}) {
  const available=dept.features.filter(feature=>can(dept.id,feature))
  return <section className="department-overview-panel">
    <div className="department-overview-copy">
      <span>部门工作台</span><h1>{shortDepartmentName(dept)}</h1><p>{dept.description}</p>
    </div>
    <div className="department-overview-strip">
      <div><span>可用业务功能</span><strong>{available.length}</strong></div>
      <div><span>部门全部功能</span><strong>{dept.features.length}</strong></div>
      <div><span>导航方式</span><strong>顶部功能带</strong></div>
    </div>
    <div className="department-overview-links">
      {dept.features.map(feature=>{
        const allowed=can(dept.id,feature)
        return <button key={feature} type="button" disabled={!allowed}
          onClick={()=>onSelect("#/departments/"+dept.id+"/"+feature)}>
          <span>{FEATURE_NAMES[feature]??feature}</span><ArrowRight size={14}/>
        </button>
      })}
    </div>
  </section>
}

function Roster({dept,staff,employee,can,office,onUpdate}:{
  dept:Department;staff:Employee[];employee?:Employee;
  can:(dept:string,feat:string,action?:string)=>boolean;
  office:string;onUpdate:()=>void
}) {
  const [search,setSearch]=useState("")
  const [editing,setEditing]=useState(false)
  const [address,setAddress]=useState(office)
  const [peer,setPeer]=useState<Employee|null>(null)
  const [draft,setDraft]=useState("")
  const [chatVersion,setChatVersion]=useState(0)
  const people=staff.filter(p=>p.dept===dept.name||(dept.id==="quality"&&p.dept==="质量部")||(dept.id==="it"&&p.dept==="开发人员"))
  const visible=people.filter(p=>[p.name,p.id,p.title,p.dept].join(" ").toLowerCase().includes(search.toLowerCase()))
  const canEdit=can("it","employees","edit")||can("it","permissions","config")
  const conversation=peer&&employee?[peer.id,employee.id].sort().join("::"):null
  const messages=conversation?readChat(conversation):[]
  void chatVersion
  function saveOffice(event:FormEvent) {
    event.preventDefault()
    updateWorkspace(data=>{(data.offices??={})[dept.id]=address.trim().slice(0,140)})
    setEditing(false);onUpdate()
  }
  function sendChat(event:FormEvent) {
    event.preventDefault()
    if(!conversation||!employee||!draft.trim())return
    updateWorkspace(data=>{(data.chatThreads??={})[conversation]??=[]
      data.chatThreads[conversation].push({from:employee.id,text:draft.trim(),time:new Date().toLocaleTimeString("zh-CN",{hour:"2-digit",minute:"2-digit"})})
    })
    setDraft("");setChatVersion(v=>v+1);onUpdate()
  }
  return <Card className="glass-panel roster-panel gap-3 p-3">
    <div className="roster-header">
      <div><h2 className="roster-title">部门花名簿</h2>
        <p className="roster-description">可按姓名、岗位或工号查找，点击成员进入私聊</p></div>
      <div className="relative w-full max-w-60">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
        <Input value={search} onChange={event=>setSearch(event.target.value)} placeholder="搜索成员 / 岗位 / 工号" className="bg-white/60 pl-9 text-xs" aria-label="搜索部门花名簿"/>
      </div>
    </div>
    <div className="roster-office">
      <span className="office-label">办公位置</span>
      <strong className="office-address">{office||"尚未登记，请填写实际办公位置"}</strong>
      {canEdit&&<Button variant="outline" size="sm" className="shrink-0 bg-white/70" onClick={()=>{setAddress(office);setEditing(true)}}>
        <Pencil size={13}/>{office?"修改位置":"填写位置"}
      </Button>}
    </div>
    <Dialog open={editing} onOpenChange={setEditing}>
      <DialogContent className="glass-dialog">
        <DialogHeader>
          <DialogTitle>编辑办公位置</DialogTitle>
          <DialogDescription>请输入实际厂区、楼栋、楼层、房间号，不是网页链接。</DialogDescription>
        </DialogHeader>
        <form onSubmit={saveOffice} className="space-y-4">
          <Input value={address} maxLength={140} onChange={event=>setAddress(event.target.value)} aria-label="办公位置"/>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={()=>setEditing(false)}>取消</Button>
            <Button type="submit">保存位置</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    <div className="roster-grid">
      {visible.map(person=><button key={person.id} className="person-tile hover:bg-white/75" type="button"
        title={`${person.name} · ${person.title} · ${person.id}`}
        aria-label={`与${person.name}私聊，${person.title}，工号${person.id}`}
        onClick={()=>setPeer(person)}>
        <span className="person-avatar">{person.name.slice(-1)}</span>
        <span className="person-meta flex-1">
          <strong>{person.name}</strong>
          <span>{person.title} · {person.id}</span>
        </span>
        <MessageCircle size={14} className="shrink-0 text-muted-foreground" aria-hidden="true"/>
      </button>)}
      {visible.length===0&&<p className="empty-note">没有找到匹配的部门成员</p>}
    </div>
    <Dialog open={Boolean(peer)} onOpenChange={open=>{if(!open)setPeer(null)}}>
      <DialogContent className="glass-dialog">
        <DialogHeader>
          <DialogTitle>与{peer?.name??"成员"}私聊</DialogTitle>
          <DialogDescription>本地演示消息，不会送达其他设备。</DialogDescription>
        </DialogHeader>
        <div className="max-h-64 min-h-24 space-y-2 overflow-y-auto rounded-lg border border-border/70 p-3">
          {messages.length===0?<p className="empty-note">还没有消息</p>:messages.map((m,i)=>
            <div key={i} className={`max-w-[90%] rounded-lg p-2 text-xs ${m.from===employee?.id?"ml-auto bg-green-100/80":"bg-white/80"}`}>
              <small className="mb-1 block text-[10px] text-muted-foreground">{m.time}</small>{m.text}
            </div>)}
        </div>
        <form className="flex gap-2" onSubmit={sendChat}>
          <Input value={draft} onChange={event=>setDraft(event.target.value)} placeholder="输入本地消息…"/>
          <Button type="submit" disabled={!draft.trim()}>发送</Button>
        </form>
      </DialogContent>
    </Dialog>
  </Card>
}
function readChat(key:string) {
  try {return readWorkspace().chatThreads?.[key]??[]}
  catch{return []}
}

function TodoBoard({todos,onSelect,dept}:{
  todos:Todo[];onSelect:(hash:string)=>void;dept:string
}) {
  const columns:[string,string][]=[["waiting","待处理"],["doing","进行中"],["review","待审核 / 复核"]]
  return <div className="todo-grid">
    {columns.map(([key,label])=>{
      const entries=todos.filter(t=>todoLane(t.status)===key)
      return <Card key={key} className="glass-panel todo-lane gap-0 py-0">
        <h3 className="todo-title">
          <span className="size-1.5 rounded-full bg-green-700"/>
          {label}<span className="todo-count">{entries.length}</span>
        </h3>
        {entries.length===0?<p className="empty-note">暂无此类待办</p>:entries.map(task=>
          <button type="button" key={`${task.kind}:${task.feature}:${task.id}`} className="todo-card" onClick={()=>onSelect(`#/departments/${dept}/${task.feature}`)}>
            <small className="font-mono">{task.id}</small>
            <strong>{task.title}</strong>
            <small>{task.status} · 查看业务单据 →</small>
          </button>)}
      </Card>
    })}
  </div>
}

function DepartmentPage({dept,staff,employee,workspace,can,onSelect,onRefresh}:{
  dept:Department;staff:Employee[];employee?:Employee;
  workspace:ReturnType<typeof useFactoryState>["workspace"];
  can:(dept:string,feat:string,action?:string)=>boolean;
  onSelect:(hash:string)=>void;onRefresh:()=>void
}) {
  const [tab,setTab]=useState<TabKey>("functions")
  useEffect(()=>setTab("functions"),[dept.id])
  const todos=getTodos(dept.id,workspace),members=staff.filter(p=>p.dept===dept.name||(dept.id==="it"&&p.dept==="开发人员")||(dept.id==="quality"&&p.dept==="质量部"))
  return <div className="dept-main">
    <Tabs value={tab} onValueChange={value=>setTab(value as TabKey)} className="dept-tabs">
      <TabsList>
        <TabsTrigger value="functions">部门概况</TabsTrigger>
        <TabsTrigger value="members">部门花名簿 <span className="count-pill">{members.length}</span></TabsTrigger>
        <TabsTrigger value="todos">待办 <span className="count-pill">{todos.length}</span></TabsTrigger>
      </TabsList>
      <TabsContent value="functions"><FeatureGrid dept={dept} can={can} onSelect={onSelect}/></TabsContent>
      <TabsContent value="members">
        <Roster dept={dept} staff={staff} employee={employee} can={can} office={workspace.offices?.[dept.id]??""} onUpdate={onRefresh}/>
      </TabsContent>
      <TabsContent value="todos"><TodoBoard dept={dept.id} todos={todos} onSelect={onSelect}/></TabsContent>
    </Tabs>
  </div>
}

export default function App() {
  const [route,setRoute]=useState<Route>(()=>parseRoute(window.location.hash))
  const {access,employee,workspace,refresh,can,switchEmployee}=useFactoryState()
  useEffect(()=>{
    if(!window.location.hash)history.replaceState(null,"","#/overview")
    const handle=()=>setRoute(parseRoute(window.location.hash))
    window.addEventListener("hashchange",handle)
    return ()=>window.removeEventListener("hashchange",handle)
  },[])
  const navigate=useCallback((hash:string)=>{
    if(window.location.hash!==hash)window.location.hash=hash
    setRoute(parseRoute(hash))
    window.scrollTo({top:0,behavior:"auto"})
  },[])
  const readMessage=useCallback((id:string|number)=>{
    let target:{dept?:string;feature?:string}|undefined
    updateWorkspace(data=>{
      const item=data.messages?.find(m=>String(m.id)===String(id))
      if(item){item.unread=false;target={dept:item.dept,feature:item.feature}}
    })
    refresh()
    if(target?.dept&&getDepartment(target.dept))
      navigate(`#/departments/${target.dept}${target.feature?"/"+target.feature:""}`)
  },[navigate,refresh])
  const readAllMessages=useCallback(()=>{
    updateWorkspace(data=>{for(const item of data.messages??[])item.unread=false})
    refresh()
  },[refresh])
  const currentDept=route.kind==="department"?getDepartment(route.dept):undefined
  const currentFeature=route.kind==="department"?route.feature:undefined
  const staff=access?.staff??[]
  const messages=workspace.messages??[]
  const validFeature=Boolean(currentDept&&currentFeature&&currentDept.features.includes(currentFeature))
  return <>
    <div aria-hidden="true" style={{position:"absolute",width:0,height:0,overflow:"hidden"}} dangerouslySetInnerHTML={{__html:SVG_SPRITE}}/>
    <div className="factory-shell factory-shell-v2">
      <SystemRail route={route} onSelect={navigate} employee={employee} staff={staff} onSwitch={switchEmployee}
        messages={messages} onRead={readMessage} onReadAll={readAllMessages} workspace={workspace}/>
      <div className="shell-workspace">
        <DepartmentBand route={route} onSelect={navigate}/>
        <FeatureBand route={route} onSelect={navigate} can={can}/>
        <main className={"shell-content "+(route.kind==="overview"?"is-overview":"is-department")+" "+(currentFeature?"is-business":"")} id="main-content">
          {route.kind==="overview"?<OverviewDashboard workspace={workspace} onSelect={navigate} onRefresh={refresh}/>:
            currentDept&&(!currentFeature||!validFeature)?
              <DepartmentPage key={currentDept.id} dept={currentDept} staff={staff} employee={employee}
                workspace={workspace} can={can} onSelect={navigate} onRefresh={refresh}/>
              :currentDept&&currentFeature?<section className={`business-page-frame business-family-${businessFamily(currentFeature)}`} data-business-family={businessFamily(currentFeature)} aria-label={FEATURE_NAMES[currentFeature]??currentFeature}>
                <div className="business-page-body">
                {can(currentDept.id,currentFeature)?
                  currentFeature==="leave"||currentFeature==="leaveApproval"?
                    <LeavePage key={currentFeature} feature={currentFeature} workspace={workspace}
                      employee={employee} can={can} onRefresh={refresh}/>:
                    currentFeature==="skills"&&access?
                    <SkillsPage key={currentFeature} access={access} workspace={workspace} onRefresh={refresh}/>:
                    currentFeature==="employees"&&access?
                    <EmployeesPage key={currentFeature} access={access} workspace={workspace} onRefresh={refresh}/>:
                    access?<NativeBusiness key={`${currentFeature}-${employee?.id??"none"}`} dept={currentDept.id}
                      feature={currentFeature} access={access} onRoute={navigate} onRefresh={refresh}/>:
                    <p className="text-xs text-muted-foreground" role="status">正在加载员工权限…</p>:
                  <Card className="glass-panel gap-2 p-6">
                    <div className="flex items-center gap-2 text-sm font-semibold"><LockKeyhole size={18}/>该功能没有访问权限</div>
                    <p className="text-xs text-muted-foreground">请在员工权限矩阵中配置相应岗位或个人权限。</p>
                    <Button variant="outline" size="sm" className="w-fit" onClick={()=>navigate(`#/departments/${currentDept.id}`)}>返回部门</Button>
                  </Card>}
                </div>
              </section>:null}
          <Footer/>
        </main>
      </div>
    </div>
  </>
}
