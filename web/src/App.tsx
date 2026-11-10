import { useCallback, useEffect, useState, type FormEvent } from "react"
import {
  ArrowRight, Bell, Check, CheckCheck, ChevronDown, ChevronRight,
  Factory, Info, LockKeyhole, Menu, MessageCircle, Pencil, Search
} from "lucide-react"
import { DEPARTMENTS, FEATURE_HINTS, FEATURE_NAMES, getDepartment, type Department } from "@/catalog"
import { getDepartmentIcon, getFeatureIcon } from "@/icons"
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
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

type Route={kind:"overview"}|{kind:"department";dept:string;feature?:string}
type TabKey="functions"|"members"|"todos"
function parseRoute(hash:string):Route {
  const match=hash.match(/^#\/departments\/([a-z]+)(?:\/([a-zA-Z]+))?$/)
  if(match&&getDepartment(match[1]))return {kind:"department",dept:match[1],feature:match[2]}
  return {kind:"overview"}
}
function Footer() {
  return <footer className="shell-footer">工厂管理系统 · React / shadcn/ui · Lucide Icons
    <span className="ml-3">数据保存在当前浏览器，尚未连接业务服务器</span>
  </footer>
}

function DepartmentNav({route,open,onSelect}:{
  route:Route;open:boolean;onSelect:(hash:string)=>void
}) {
  const OverviewIcon=getFeatureIcon("overview")
  return <aside className={`shell-sidebar ${open?"open":""}`} aria-label="部门导航">
    <div className="sidebar-brand">
      <span className="brand-icon"><Factory size={21} strokeWidth={1.7}/></span>
      <div><div className="brand-title">工厂管理系统</div><div className="brand-caption">FACTORY MANAGEMENT</div></div>
    </div>
    <nav className="sidebar-scroll">
      <div className="department-grid">
        <button className="department-tile" aria-current={route.kind==="overview"?"page":undefined}
          onClick={()=>onSelect("#/overview")}>
          <span className="tile-icon"><OverviewIcon aria-hidden="true"/></span>
          <span className="tile-label">首页总览</span>
        </button>
        {DEPARTMENTS.map(d=>{
          const Icon=getDepartmentIcon(d.id),selected=route.kind==="department"&&route.dept===d.id
          return <button key={d.id} className="department-tile" aria-current={selected?"page":undefined}
            onClick={()=>onSelect(`#/departments/${d.id}`)}>
            <span className="tile-icon"><Icon aria-hidden="true"/></span>
            <span className="tile-label">{d.name}</span>
          </button>
        })}
      </div>
    </nav>
    <div className="sidebar-foot">11 个部门 · 按岗位权限开放功能</div>
  </aside>
}

function Topbar({route,onSelect,onOpenSidebar,employee,staff,onSwitch,messages,onRead,onReadAll}:{
  route:Route;onSelect:(hash:string)=>void;onOpenSidebar:()=>void;
  employee?:Employee;staff:Employee[];onSwitch:(id:string)=>void;
  onRead:(id:string|number)=>void;onReadAll:()=>void;
  messages:Array<{id:string|number;title:string;text:string;date?:string;unread?:boolean;dept?:string;feature?:string}>
}) {
  const dept=route.kind==="department"?getDepartment(route.dept):undefined
  const [infoOpen,setInfoOpen]=useState(false)
  const [featureInfoOpen,setFeatureInfoOpen]=useState(false)
  useEffect(()=>{setInfoOpen(false);setFeatureInfoOpen(false)},[dept?.id,route.kind==="department"?route.feature:undefined])
  const count=messages.filter(m=>m.unread).length
  return <header className="shell-topbar">
    <div className="flex min-w-0 items-center gap-2">
      <Button variant="ghost" size="icon-sm" className="mobile-menu" aria-label="打开部门菜单" onClick={onOpenSidebar}>
        <Menu size={20}/>
      </Button>
      <nav className="crumbs" aria-label="当前位置">
        <button type="button" className="crumb-button" onClick={()=>onSelect("#/overview")}>工厂管理系统</button>
        <ChevronRight className="crumb-separator"/>
        {dept?<div className="flex min-w-0 items-center gap-1">
          <button type="button" className="crumb-button crumb-dept" onClick={()=>onSelect(`#/departments/${dept.id}`)}>{dept.name}</button>
          <Popover open={infoOpen} onOpenChange={setInfoOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon-xs" aria-label={`查看${dept.name}介绍`}
                onPointerEnter={event=>{if(event.pointerType==="mouse")setInfoOpen(true)}}>
                <Info size={14}/>
              </Button>
            </PopoverTrigger>
            <PopoverContent side="bottom" align="start" sideOffset={9} className="glass-tooltip">
              <strong className="block text-xs font-semibold">{dept.name}</strong>
              <span className="mt-1 block text-xs">{dept.description}</span>
            </PopoverContent>
          </Popover>
          {route.kind==="department"&&route.feature&&<>
            <ChevronRight className="crumb-separator"/>
            <strong className="crumb-current">{FEATURE_NAMES[route.feature]??route.feature}</strong>
            <Popover open={featureInfoOpen} onOpenChange={setFeatureInfoOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon-xs"
                  aria-label={`查看${FEATURE_NAMES[route.feature]??route.feature}介绍`}
                  onPointerEnter={event=>{if(event.pointerType==="mouse")setFeatureInfoOpen(true)}}>
                  <Info size={14}/>
                </Button>
              </PopoverTrigger>
              <PopoverContent side="bottom" align="start" sideOffset={9} className="glass-tooltip">
                <strong className="block text-xs font-semibold">{FEATURE_NAMES[route.feature]??route.feature}</strong>
                <span className="mt-1 block text-xs">{FEATURE_HINTS[route.feature]??dept.description}</span>
              </PopoverContent>
            </Popover>
          </>}
        </div>:<strong className="crumb-current">工厂运行总览</strong>}
      </nav>
    </div>
    <div className="topbar-actions">
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon-sm" className="relative" aria-label={`消息中心，${count} 条未读`}>
            <Bell size={17}/>
            {count>0&&<span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-[#2a5f40] px-1 text-[9px] text-white">{count}</span>}
          </Button>
        </DialogTrigger>
        <DialogContent className="glass-dialog">
          <DialogHeader>
            <DialogTitle>消息中心</DialogTitle>
            <DialogDescription>以下消息仅保存在当前浏览器，不会发送到其他设备。</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end"><Button size="sm" variant="outline" disabled={count===0} onClick={onReadAll}>
            <CheckCheck size={14}/>全部标记已读
          </Button></div>
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {messages.length===0?<p className="empty-note">暂无消息</p>:messages.map(m=>
              <DialogClose asChild key={m.id}>
                <button type="button" className="block w-full rounded-lg border border-border/60 bg-white/60 p-3 text-left hover:bg-white/85"
                  onClick={()=>onRead(m.id)}>
                  <span className="flex items-center gap-2 text-xs font-semibold">
                    {m.unread&&<span className="size-1.5 rounded-full bg-green-600"/>}{m.title}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">{m.text}</span>
                  <small className="mt-1 block text-[10px] text-muted-foreground">{m.date??""}</small>
                </button>
              </DialogClose>)}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog>
        <DialogTrigger asChild>
          <button type="button" className="user-action" aria-label="切换当前员工">
            <span className="user-avatar">{employee?.name.slice(-1)??"工"}</span>
            <span className="user-text">
              <span className="user-name">{employee?.name??"员工"}</span>
              <span className="user-dept">{employee?.dept??"正在读取权限"}</span>
            </span>
            <ChevronDown size={13} className="text-muted-foreground"/>
          </button>
        </DialogTrigger>
        <DialogContent className="glass-dialog">
          <DialogHeader>
            <DialogTitle>切换当前员工</DialogTitle>
            <DialogDescription>切换只影响本浏览器内的演示身份。</DialogDescription>
          </DialogHeader>
          <div className="max-h-80 space-y-1 overflow-y-auto">
            {staff.map(person=>
              <button type="button" key={person.id} onClick={()=>onSwitch(person.id)}
                className="flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2 text-left hover:border-border/60 hover:bg-white/60">
                <span className="person-avatar">{person.name.slice(-1)}</span>
                <span className="person-meta flex-1">
                  <strong>{person.name}</strong><span>{person.title} · {person.dept}</span>
                </span>
                {person.id===employee?.id&&<Check size={16} className="text-green-700"/>}
              </button>)}
          </div>
          <DataBackup/>
        </DialogContent>
      </Dialog>
    </div>
  </header>
}

function FeatureGrid({dept,can,onSelect}:{
  dept:Department;can:(dept:string,feature:string,action?:string)=>boolean;
  onSelect:(hash:string)=>void
}) {
  return <Card className="feature-panel gap-0 py-0">
    <CardContent className="p-0">
      <div className="feature-grid">
        {dept.features.map(f=>{
          const Icon=getFeatureIcon(f),allowed=can(dept.id,f)
          return <button key={f} type="button" className="feature-tile" disabled={!allowed}
            aria-label={`${FEATURE_NAMES[f]??f}${allowed?"":"，无访问权限"}`}
            onClick={()=>onSelect(`#/departments/${dept.id}/${f}`)}>
            <span className="feature-icon"><Icon aria-hidden="true"/></span>
            <span className="feature-label">{FEATURE_NAMES[f]??f}</span>
            <span className="feature-description">{FEATURE_HINTS[f]??"业务操作与记录"}</span>
            <span className="feature-arrow">{allowed?<ArrowRight size={16}/>:<LockKeyhole size={15}/>}</span>
          </button>
        })}
      </div>
    </CardContent>
  </Card>
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
  return <Card className="glass-panel gap-4 p-4">
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
      {visible.map(person=><button key={person.id} className="person-tile hover:bg-white/75" type="button" onClick={()=>setPeer(person)}>
        <span className="person-avatar">{person.name.slice(-1)}</span>
        <span className="person-meta flex-1">
          <strong>{person.name}</strong>
          <span>{person.title} · {person.id}</span>
        </span>
        <MessageCircle size={15} className="text-muted-foreground"/>
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
        <TabsTrigger value="functions">业务功能 <span className="count-pill">{dept.features.length}</span></TabsTrigger>
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
  const [sidebarOpen,setSidebarOpen]=useState(false)
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
    setSidebarOpen(false)
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
    <div className="factory-shell">
      <div className={`sidebar-shade ${sidebarOpen?"open":""}`} onClick={()=>setSidebarOpen(false)} aria-hidden="true"/>
      <DepartmentNav route={route} open={sidebarOpen} onSelect={navigate}/>
      <div className="shell-workspace">
        <Topbar route={route} employee={employee} staff={staff} onSwitch={switchEmployee}
          onOpenSidebar={()=>setSidebarOpen(true)} onSelect={navigate} messages={messages}
          onRead={readMessage} onReadAll={readAllMessages}/>
        <main className="shell-content" id="main-content">
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
