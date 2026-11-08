(()=>{'use strict';
const $=id=>document.getElementById(id),e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const access=window.FactoryAccess;
const icon=(id,cls='ico')=>`<svg aria-hidden="true" class="${cls}"><use href="#ic-${id}"></use></svg>`;
const departments=[
 {id:'hr',name:'人事行政办公室',icon:'users',description:'员工自助、培训档案、请假与考勤',features:['leave','hours','hoursAppeal','leaveApproval','employees','skills','payroll']},
 {id:'sales',name:'销售部',icon:'sales',description:'销售订单、客户需求、订单评审与历史订单',features:['orders','orderReview','orderHistory']},
 {id:'pmc',name:'生产计划与物料控制部（PMC）',icon:'pmc',description:'生产计划、物料齐套、产线排程及人员班次安排',features:['schedule','kitting','shift','shiftPeople','shiftStats','orderProductStats','orderDailyReport']},
 {id:'purchase',name:'采购 / 供应链部',icon:'purchase',description:'采购申请、供应商与到货协同',features:['purchase']},
 {id:'warehouse',name:'仓库 / 物流部',icon:'warehouse',description:'库存批次、来料收货、备料、出库、退库与收发存',features:['warehouseOps','warehouseIncoming','warehousePick','warehouseOutbound','warehouseReturns','warehouseLedger','inventory','issue']},
 {id:'quality',name:'质量部 QA / QC',icon:'quality',description:'报检判定、抽检、清洗报检、不合格处置与 QA 放行',features:['qaQc','qaSampling','qaCleanInspection','qaNcr','qaQualityStock','release']},
 {id:'production',name:'生产车间',icon:'production',description:'领退料、到料接收、返洗返工、生产任务与班组管理',features:['workshop','workshopReceive','workshopDispute','workshopRework','tasks','batch','shift','skills','incentive']},
 {id:'engineering',name:'设备工程部',icon:'engineering',description:'设备维护、调机调线和非生产工单',features:['engineering']},
 {id:'finance',name:'财务部',icon:'finance',description:'应收应付、加班费和激励工资审核',features:['payroll','finance']},
 {id:'it',name:'信息化 / 工艺技术部',icon:'it',description:'权限组织、主数据、操作标准、工艺模板与 BOM 统一管理',features:['permissions','employees','settings','productSettings','dictionarySettings','catalog','sop','sopExecutions','templates','bom']},
 {id:'leadership',name:'总经办',icon:'leadership',description:'跨部门审批与重点事项',features:['approvals']}
];
const features={overview:'工厂运行总览',hours:'我的工时',hoursAppeal:'工时申诉',sop:'操作标准卡',sopExecutions:'标准卡执行记录',qaQc:'报检判定',qaSampling:'抽检',qaCleanInspection:'清洗报检',qaNcr:'不合格品处置',qaQualityStock:'质量库存',workshop:'车间领料 / 退库',workshopReceive:'到料接收双签',workshopDispute:'工时申诉审批',workshopRework:'返洗 / 返工',warehouseOps:'库存批次',warehouseIncoming:'采购到货',warehousePick:'备料执行 · FIFO',warehouseOutbound:'成品出库',warehouseReturns:'退库接收',warehouseLedger:'月末收发存',settings:'流程与工艺设置',productSettings:'产品与物料设置',dictionarySettings:'基础字典',leave:'我的请假',leaveApproval:'请假审批',employees:'员工档案',skills:'员工技能矩阵',payroll:'加班费 / 激励工资',orders:'销售订单',orderReview:'订单评审',orderHistory:'历史订单',schedule:'生产排程',kitting:'物料齐套',shift:'排班编排',shiftPeople:'员工排班',shiftStats:'排班统计',orderProductStats:'订单产品统计',orderDailyReport:'订单日报表',purchase:'采购单',inventory:'库存与生产入库',issue:'领料与发料',inspection:'检验任务',release:'QA 放行',tasks:'生产 / 非生产任务',batch:'生产批次卡',incentive:'生产激励提报',templates:'工艺模板',bom:'BOM 关系',catalog:'产品与产线',engineering:'设备与调机调线',finance:'财务审核',permissions:'员工权限矩阵',approvals:'总经办审批'};
const baseItems=[
 ['FG-001','720g/L 百菌清悬浮剂','成品','5L × 4桶','桶'],['FG-002','500g/L 悬浮剂 B','成品','1L × 12瓶','箱'],['SF-001','百菌清配制半成品','半成品','720g/L','L'],['SF-002','悬浮剂配制半成品 B','半成品','500g/L','L'],['RM-001','主剂 A','原料','工业级','kg'],['RM-002','主剂 B','原料','工业级','kg'],['AD-001','分散剂','辅料','25kg/袋','kg'],['AD-002','稳定剂','辅料','20kg/袋','kg'],['PK-001','5L 包装桶','包材','5L','个'],['PK-002','外箱','包材','4桶/箱','个'],['CO-001','清洗耗材','耗材','通用','套'],['SP-001','泵用密封件','备件','通用','个']
].map(([id,name,type,spec,unit])=>({id,name,type,spec,unit}));
const lines=[['L01 配制一线','配制','SF-001 / SF-002','可用'],['L02 配制二线','配制','SF-002','可用'],['S03-4# 瓶装线','包装','FG-001','可用'],['S04 包装二线','包装','FG-002','维护中']];
const formerPeople=[['E001','陈雯','人事行政办公室','人事主管'],['E002','李明','生产车间','配制工'],['E003','王强','生产车间','包装工'],['E004','张敏','生产车间','班组长'],['E005','赵凯','生产车间','配料工'],['E006','刘洋','质量部','QA 检验员'],['E007','周琳','生产计划与物料控制部（PMC）','计划员'],['E008','吴建','设备工程部','设备工程师'],['E009','孙浩','仓库 / 物流部','仓管员'],['E010','林静','信息化 / 主数据管理','信息化管理员']];
const people=access.staff.map(p=>[p.id,p.name,p.dept,p.title]);
const ability=['配料','搅拌','灌装','包装','在线检验','设备换型','清洗','叉车'];
const initial={role:'employee',dept:'it',feature:null,expanded:'it',home:true,orders:[{id:'SO-2026-1023-018',product:'720g/L 百菌清悬浮剂',spec:'5L × 4桶',qty:3000,unit:'L',status:'待排产',owner:'生产计划与物料控制部（PMC）'},{id:'SO-2026-1106-003',product:'500g/L 悬浮剂 B',spec:'1L × 12瓶',qty:1800,unit:'L',status:'待评审',owner:'销售部'}],tasks:[{id:'TK-001',type:'清洗',line:'L01 配制一线',status:'待复核',category:'非生产任务'},{id:'TK-002',type:'配制',line:'L01 配制一线',status:'待开始',category:'生产任务'},{id:'TK-003',type:'调机调线',line:'S03-4# 瓶装线',status:'待开始',category:'非生产任务'},{id:'TK-004',type:'包装',line:'S03-4# 瓶装线',status:'待开始',category:'生产任务'}],leaves:[{id:'LV-001',person:'员工',range:'2026-11-10 ~ 2026-11-11',reason:'个人事务',status:'待人事审批'}],messages:[{id:1,title:'待处理 · 生产任务',text:'TK-002 配制任务等待生产车间承接',dept:'production',date:'11月06日 09:18',unread:true,feature:'tasks'},{id:2,title:'待处理 · 请假申请',text:'LV-001 请假单等待人事审核',dept:'hr',date:'11月06日 09:05',unread:true,feature:'leaveApproval'},{id:3,title:'排程已更新',text:'SO-2026-1023-018 已生成正式排程草稿',dept:'pmc',date:'11月06日 08:50',unread:true,feature:'schedule'}],payroll:[{id:'OT-001',name:'李明',type:'加班',basis:'4 小时',status:'待人事复核',amount:'—'},{id:'IN-001',name:'王强',type:'生产激励',basis:'合格 900 单位',status:'待财务核准',amount:'—'}],approvals:[],offices:{},chatThreads:{},plans:[]};
access.init(departments,features);
let data;try{data=Object.assign({},structuredClone(initial),JSON.parse(localStorage.getItem('factory-workspace-v2')||'{}'))}catch{data=JSON.parse(JSON.stringify(initial))}data.offices=data.offices&&typeof data.offices==='object'?data.offices:{};data.chatThreads=data.chatThreads&&typeof data.chatThreads==='object'?data.chatThreads:{};data.plans=Array.isArray(data.plans)?data.plans:[];let q='',drawer=false;
if(data.dept==='tech')data.dept='it';
if(data.dept==='ehs'){data.dept='hr';data.feature=null;}
if(data.expanded==='tech')data.expanded='it';
if(data.expanded==='ehs')data.expanded='hr';
const deptTabs={};
const save=()=>{try{localStorage.setItem('factory-workspace-v2',JSON.stringify(data))}catch{}};
// 已保存的订单仍可能使用旧部门名称，加载时只更正名称，不改变单据状态。
for(const order of data.orders||[])if(order.owner==='PMC 办公室')order.owner='生产计划与物料控制部（PMC）';
const allowed=(dept,feat,action='view')=>access.has(dept,feat,action);
const ops=window.FactoryOperations;
ops.init({data,save,access,toast,flashDenied,render,openFeature});window.FactoryGantt.init({data,save,access,render,flashDenied});window.FactoryModules.init({data,save,access,toast,render,openFeature,ops});
function navRender(){const node=$('nav');node.innerHTML=departments.filter(d=>(d.name+' '+d.features.map(f=>features[f]||f).join(' ')).toLowerCase().includes(q)).map(d=>`<div class="nav-dept"><button class="dept-row ${!data.home&&data.dept===d.id?'active':''}" data-dept="${d.id}"><span class="dept-ico">${icon(d.icon)}</span><strong>${e(d.name)}</strong></button></div>`).join('')||'<div class="empty-state">没有匹配的部门</div>'}
const deptURL=id=>`${location.origin}${location.pathname}#/departments/${id}`;
const homeHash=()=>`#/overview`;
const pageHash=(dept,feat)=>`#/departments/${dept}${feat?'/'+feat:''}`;
function updateAddress(dept,feat){if(location.hash!==pageHash(dept,feat))history.pushState(null,'',pageHash(dept,feat));}
function updateHomeAddress(){if(location.hash!==homeHash())history.pushState(null,'',homeHash());}
function crumbs(d,f){
 const root=$('breadcrumbs');
 root.innerHTML=`<button type="button" class="crumb-link crumb-home" data-breadcrumb-home>工厂管理系统</button><span class="crumb-sep">/</span><button type="button" class="crumb-link crumb-dept" data-breadcrumb-dept="${e(d.id)}">${e(d.name)}</button>${f?`<span class="crumb-sep">/</span><strong class="crumb-current">${e(features[f])}</strong>`:''}`;
 $('view-title').textContent=f?features[f]:d.name;$('view-description').textContent=f?featureHint(f):d.description
}
function crumbsHome(){
 const root=$('breadcrumbs');
 root.innerHTML='<button type="button" class="crumb-link crumb-home" data-breadcrumb-home>工厂管理系统</button><span class="crumb-sep">/</span><strong class="crumb-current">工厂运行总览</strong>';
 $('view-title').textContent='工厂运行总览';
 $('view-description').textContent=featureHint('overview');
}
function panel(title,contents,extra=''){return `<section class="panel"><div class="section-title">${title}<small>${extra}</small></div>${contents}</section>`}
function table(columns,rows){return `<div class="table-wrap"><table class="data-table"><thead><tr>${columns.map(c=>`<th>${e(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(x=>`<td>${x??''}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`}
function tag(s){const dark=['执行中','已完成','审核通过','已发布','合格','可排班','已确认','可用'].includes(s);return `<span class="tag ${dark?'dark':''}">${e(s)}</span>`}
function action(text,kind,payload='',css=''){return `<button class="btn btn-xs ${css}" data-action="${kind}" ${payload?`data-id="${e(payload)}"`:''}>${text}</button>`}
function toast(message,dept='it'){const root=$('toast-host'),name=departments.find(d=>d.id===dept);let el=document.createElement('div');el.className='toast-item';el.innerHTML=`<span class="toast-icon">${icon(name?.icon||'check')}</span><span>${e(message)}</span>`;root.prepend(el);setTimeout(()=>el.remove(),3800);while(root.children.length>3)root.lastElementChild.remove()}
function message(title,text,dept,feature){data.messages.unshift({id:Date.now(),title,text,dept,date:'刚刚',unread:true,feature});save();updateUnread();if(drawer)drawMessages()}
function overview(){const stages=[['订单评审','sales'],['PMC 排程','pmc'],['采购齐套','purchase'],['仓库发料','warehouse'],['配制生产','production'],['半成品检验','quality'],['包装生产','production'],['成品入库','warehouse']];return `<div class="grid stats">${[['待办任务','18','跨部门待处理'],['生产任务','06','配制 / 包装'],['非生产任务','04','清洗 / 调机调线'],['已配置模板','05','含历史停用版']].map(([k,n,h],i)=>`<div class="panel stat"><div class="stat-top">${k}${icon(['pmc','production','engineering','tech'][i])}</div><strong>${n}</strong><span class="stat-foot">${h}</span></div>`).join('')}</div><div class="grid split">${panel('订单与批次主流程',`<div class="kpi-caption">SO-2026-1023-018 · 720g/L 百菌清悬浮剂 · 5L × 4桶 · 3,000 L</div><div class="task-timeline">${stages.map(([name,dept],i)=>`<div class="task-node ${i===1?'current':''}"><span class="step-id">STEP ${String(i+1).padStart(2,'0')}</span><span class="node-icon">${icon(departments.find(d=>d.id===dept).icon)}</span><b>${name}</b><small>${i===0?'已完成':i===1?'排程确认中':'等待流转'}</small></div>`).join('')}</div><div class="toolbar" style="margin:14px 0 0"><span class="small-note">本页面不连接后端审批与库存扣减服务。</span>${action('查看生产排程','nav','schedule')}</div>`,'08 个业务阶段')}${panel('最新业务动态',`<div class="activity-item"><span class="activity-mark">${icon('pmc')}</span><div><strong>PMC 排程方案已生成</strong><p>订单 SO-2026-1023-018 · 草稿</p></div><time>09:18</time></div><div class="activity-item"><span class="activity-mark">${icon('engineering')}</span><div><strong>设备工程部等待调线</strong><p>包装线 S03-4# · 待执行</p></div><time>09:05</time></div><div class="activity-item"><span class="activity-mark">${icon('quality')}</span><div><strong>半成品报检任务</strong><p>质量放行 · 待检验</p></div><time>08:42</time></div>`,'今日') }</div>${panel(departments.length+' 部门协同总览',`<div class="dept-summary">${departments.map(d=>`<div class="dept-summary-item"><span class="ico-wrap">${icon(d.icon)}</span><div><b>${e(d.name)}</b><small>${d.features.filter(f=>allowed(d.id,f)).length} / ${d.features.length} 项功能可用</small></div></div>`).join('')}</div>`,'按部门配置功能权限')}`}
// 待办只从单据状态计算，不再用功能菜单伪造“工作事项”。
function pendingForDept(id){
 const records=ops.pendingForDept(id).concat(window.FactoryModules.pendingForDept(id));
 const add=(kind,feature,docId,title,detail,status)=>records.push({kind,feature,id:docId,title,detail,status});
 if(id==='hr'){
  data.leaves.filter(x=>x.status==='待人事审批').forEach(x=>add('leave','leaveApproval',x.id,`请假审批 · ${x.person}`,x.range,x.status));
  data.payroll.filter(x=>x.status==='待人事复核').forEach(x=>add('hrPay','payroll',x.id,`工资核算 · ${x.name}`,x.basis,x.status));
 }
 if(id==='finance')data.payroll.filter(x=>x.status==='待财务核准').forEach(x=>add('financePay','payroll',x.id,`工资核准 · ${x.name}`,x.basis,x.status));
 if(id==='engineering')data.tasks.filter(x=>x.type==='调机调线'&&!['已完成','已取消'].includes(x.status)).forEach(x=>add('engineering','engineering',x.id,`${x.type} · ${x.line}`,x.category,x.status));
 return records;
}
function departmentMembers(d){
 return access.staff.filter(p=>p.dept===d.name||(d.id==='quality'&&p.dept==='质量部')||(d.id==='it'&&p.dept==='开发人员'));
}
function canEditOffice(){return access.has('it','employees','edit')||access.has('it','permissions','config')}
function todoColumn(status){
 const st=String(status||'');
 if(/待(审批|判定|复核|审核|确认|质量|放行|检查)|待人事|待财务|待核准|未通过|比对差异/.test(st))return 'review';
 if(/执行中|进行中|生产中|待发料|待备料|待签发|待签收|待接收|待到货|待收货|已排程|处理中/.test(st))return 'doing';
 return 'waiting';
}
function deptHome(d){
 const office=data.offices[d.id]||'';
 const pending=pendingForDept(d.id),members=departmentMembers(d);
 const current=deptTabs[d.id]||'functions';
 // 恢复 V18 紧凑横向功能行：图标、名称、用途、进入箭头，使用统一功能行组件。
 const funcs=d.features.map(f=>{const ok=allowed(d.id,f);return `<button type="button" class="feature-row ${ok?'':'is-locked'}" data-feature="${f}" data-feature-dept="${d.id}" aria-label="${e(features[f])}${ok?'':'（无访问权限）'}"><span class="feature-glyph">${icon('feature-'+f)}${ok?'':`<span class="feature-lock">${icon('lock')}</span>`}</span><span class="feature-copy"><strong>${e(features[f])}</strong><small>${e(featureHint(f))}</small></span><span class="feature-side">${icon(ok?'arrow':'lock')}</span></button>`}).join('');

  // 不再填充空白功能格，让背景色透过卡片。
 const people=members.map(person=>`<button type="button" class="dept-member-card" data-chat-person="${e(person.id)}" data-member-search="${e([person.id,person.name,person.title,person.dept].join(' ')).toLowerCase()}"><span class="member-avatar">${e(person.name.slice(-1))}</span><span class="member-info"><strong>${e(person.name)}</strong><small>${e(person.title)} · ${e(person.id)}</small></span><span class="member-chat">私聊 →</span></button>`).join('');
 const lanes=[['waiting','待处理'],['doing','进行中'],['review','待审核 / 复核']].map(([key,label])=>{
   const records=pending.filter(x=>todoColumn(x.status)===key);
   return `<section class="dept-todo-lane"><header class="dept-todo-head"><span class="lane-dot"></span>${label}<em>${records.length}</em></header><div class="dept-todo-list">${records.map(item=>{const ok=allowed(d.id,item.feature);return `<button type="button" class="dept-todo-card ${ok?'':'is-locked'}" data-todo-kind="${e(item.kind)}" data-todo-id="${e(item.id)}" data-todo-dept="${d.id}"><span class="todo-code">${e(item.id)}</span><strong>${e(item.title)}</strong><small>${e(item.detail)}</small><span class="todo-status">${e(item.status)} · ${ok?'查看单据 →':'权限锁定'}</span></button>`}).join('')||'<div class="dept-todo-void">暂无此类待办</div>'}</div></section>`
 }).join('');
 const tab=(id,title,num)=>`<button type="button" class="dept-hub-tab" role="tab" aria-selected="${current===id}" data-dept-tab="${id}">${title}<em>${num}</em></button>`;
 const body=current==='functions'?`<section class="dept-feature-panel"><div class="feature-list">${funcs}</div></section>`:current==='members'?`<section class="dept-members"><div class="dept-members-head"><div><strong>部门成员</strong><small>可通过姓名、岗位或工号查找，点击成员进入私聊</small></div><input id="dept-member-search" class="dept-members-search" type="search" placeholder="搜索姓名 / 岗位 / 工号" autocomplete="off" aria-label="搜索部门成员"></div><div class="dept-member-grid" id="dept-member-grid">${people||'<div class="dept-hub-empty">暂无部门成员</div>'}</div><div id="dept-members-no-results" class="dept-hub-empty" hidden>没有找到匹配的成员</div></section>`:`<div class="dept-todo-board">${lanes}</div>`;
 return `<div class="dept-hub"><div class="office-location"><span class="office-label">办公位置</span><strong class="${office?'':'office-unset'}">${office?e(office):'尚未登记，请填写实际办公位置'}</strong>${canEditOffice()?`<button type="button" data-action="editOffice" data-id="${d.id}">${office?'修改位置':'填写位置'}</button>`:''}</div><div class="dept-hub-tabs" role="tablist" aria-label="${e(d.name)}工作区">${tab('functions','业务功能',d.features.length)}${tab('members','部门成员',members.length)}${tab('todos','待办',pending.length)}</div><div class="dept-hub-panel" role="tabpanel">${body}</div></div>`;
}
function openTodoRecord(kind,id,dept,trigger){
 const item=pendingForDept(dept).find(t=>t.kind===kind&&t.id===id);
 if(!item)return render();
 if(!allowed(dept,item.feature)){flashDenied(trigger);return}
 if(kind==='ops'){ops.openTodo({...item,dept});return;}
 if(kind==='mod'){window.FactoryModules.openTodo({...item,dept});return;}
 const record=[...data.orders,...data.leaves,...data.payroll,...data.tasks].find(x=>x.id===id);
 if(!record)return render();
 window._workItem={kind,id,dept};
 const details=`单据编号：${id}。${item.title}。${item.detail}。当前状态：${item.status}。`;
 const actions={leave:'approve',reviewOrder:'approve',planOrder:'edit',task:'execute',engineering:'execute',hrPay:'approve',financePay:'approve'};
 if(!access.has(dept,item.feature,actions[kind])){modal(`单据详情 · ${id}`,details);return}
 const buttons={leave:'审批通过',reviewOrder:'评审通过',planOrder:'生成排程记录',task:'推进任务状态',engineering:'推进任务状态',hrPay:'人事复核通过',financePay:'财务核准'};
 modal(`${item.title}`,details,`<div class="info-bar">操作对象为 ${e(id)}，处理后会更新这条记录的状态与待办数量。</div>`,'finishWorkItem');
 const submit=document.querySelector('#modal-host [data-action="finishWorkItem"]');if(submit)submit.textContent=buttons[kind];
}
function finishWorkItem(){
 const w=window._workItem;if(!w)return;
 const current=pendingForDept(w.dept).find(x=>x.id===w.id&&x.kind===w.kind);
 if(!current)return closeModal();
 const actions={leave:'approve',reviewOrder:'approve',planOrder:'edit',task:'execute',engineering:'execute',hrPay:'approve',financePay:'approve'};
 if(!access.has(w.dept,current.feature,actions[w.kind]))return;
 const find=(arr)=>arr.find(x=>x.id===w.id);
 if(w.kind==='leave'){const x=find(data.leaves);if(x)x.status='审核通过'}
 if(w.kind==='reviewOrder'){const x=find(data.orders);if(x)x.status='待排产'}
 if(w.kind==='planOrder'){const x=find(data.orders);if(x){x.status='已排产';data.plans.push({orderId:x.id,createdAt:new Date().toLocaleString('zh-CN'),type:'生产排程记录'})}}
 if(['task','engineering'].includes(w.kind)){const x=find(data.tasks);if(x)x.status=x.status==='待开始'?'执行中':x.status==='执行中'?'待复核':'已完成'}
 if(w.kind==='hrPay'){const x=find(data.payroll);if(x)x.status='待财务核准'}
 if(w.kind==='financePay'){const x=find(data.payroll);if(x)x.status='已核准'}
 closeModal();save();render();toast(`${w.id} 已更新`);window._workItem=null;
}
function chatKey(other){return [access.current().id,other].sort().join('::')}
function openChat(personId){
 const other=access.staff.find(p=>p.id===personId);if(!other)return;
 window._chatPeer=other.id;
 if(!data.chatThreads||typeof data.chatThreads!=='object')data.chatThreads={};
 const msgs=data.chatThreads[chatKey(other.id)]||[];
 const rows=msgs.map(m=>`<div class="chat-message ${m.from===access.current().id?'mine':''}"><small>${e(access.staff.find(p=>p.id===m.from)?.name||'员工')} · ${e(m.time)}</small><p>${e(m.text)}</p></div>`).join('');
 $('chat-host').innerHTML=`<div class="chat-backdrop" data-chat-close></div><aside class="chat-panel" role="dialog" aria-modal="true" aria-label="与${e(other.name)}私聊"><header class="chat-head"><div><h2>${e(other.name)}</h2><p>${e(other.title)} · ${e(other.dept)}</p></div><button type="button" class="icon-btn" data-chat-close aria-label="关闭私聊">${icon('close')}</button></header><div class="chat-warning">当前网页仅保存本浏览器的消息，无法发送到对方设备。</div><div class="chat-thread" id="chat-thread">${rows||'<div class="dept-empty">还没有消息</div>'}</div><form id="chat-form" class="chat-compose"><textarea id="chat-input" maxlength="1000" rows="3" placeholder="输入消息…" required></textarea><button class="btn btn-primary" type="submit">发送</button></form></aside>`;
 const thread=$('chat-thread');thread.scrollTop=thread.scrollHeight;
 $('chat-input').focus();
}
function closeChat(){$('chat-host').innerHTML='';window._chatPeer=null}
function submitChat(){
 const peer=window._chatPeer,field=$('chat-input');if(!peer||!field)return;
 const content=field.value.trim();if(!content)return;
 const key=chatKey(peer);(data.chatThreads[key]||(data.chatThreads[key]=[])).push({from:access.current().id,text:content,time:new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})});
 save();openChat(peer);
}
function featureHint(f){return ({overview:'订单、产线、质量、物料及人员运行状态',hours:'本人管理岗与辅助工时、班次工时确认',hoursAppeal:'本人对工时计算结果发起申诉并查看处理结果',sop:'受控操作步骤、版本、审核与发布',sopExecutions:'标准卡执行人、版本、签名与执行时间',qaQc:'来料、半成品与成品报检单的 QC 判定',qaSampling:'按批次执行抽检并记录判定结果',qaCleanInspection:'清洗任务报检、判定与返洗衔接',qaNcr:'隔离、返洗、返工、报废等不合格品处置',qaQualityStock:'待检、合格、冻结等质量库存状态',workshop:'车间发起领料与结余退库申请',workshopReceive:'仓库签发后由车间人员完成到料接收双签',workshopDispute:'车间管理人员审批员工工时申诉',workshopRework:'根据质量异常发起返洗或返工任务',warehouseOps:'库存批次、效期、质量状态与冻结管理',warehouseIncoming:'采购到货、来料比对、报检和入库确认',warehousePick:'按合格批次和 FIFO 执行生产备料',warehouseOutbound:'按订单成品批次执行销售出库',warehouseReturns:'接收生产结余退库并回补原批次',warehouseLedger:'按月查看收入、发出、结存与批次流水',shift:'产线×岗位排班、技能与请假校验、开工前检查',settings:'清洗报检、双签、FIFO、技能与请假等流程规则',productSettings:'产品、物料主数据、BOM 与产线关系入口',dictionarySettings:'班次、工种、物料分类、检验项目等基础字典',leave:'员工自助发起并查看请假记录',leaveApproval:'人事审批请假单及结果通知',employees:'员工身份、岗位与组织关系',skills:'技能等级、工种与资质有效期',payroll:'加班申请、激励计量与审批',orders:'产品 · 规格 · 数量 · 交期',orderReview:'订单提交、评审与审批',orderHistory:'已交付订单、完成时间与完整流转记录',schedule:'时间、产线、配制包装、清洗、调机调线及质检任务',kitting:'库存齐套与批号预留',shift:'按产线 × 岗位编排班次并执行开工前 Gate',shiftPeople:'按员工查看日期、岗位、产线和班次',shiftStats:'查看排班数量、Gate 通过率与人员覆盖',orderProductStats:'按订单汇总已确认工时与参与员工',orderDailyReport:'按日期和订单查看已确认工时报表',purchase:'采购下单、主管审批与到货进度',inventory:'成品、半成品及原辅包分类',issue:'按正式任务领料、发料、签收',inspection:'来料、半成品、成品检验',release:'成品 QC 合格后的 QA 最终放行',tasks:'配制、包装、清洗、调机调线',batch:'生产实绩与批次过程记录',incentive:'按合格计量提报激励',templates:'受控模板、版本、一键填充',bom:'成品与半成品及原辅料关系',catalog:'产品、规格、产线、品类关系',engineering:'非生产任务、设备维护',safety:'安全巡检与整改闭环',finance:'财务审核记录和汇总',permissions:'个人 × 操作权限，独立授权',approvals:'高风险权限与经营决策'}[f]||'业务操作与记录')}
function orders(){return `${panel('销售订单',`<div class="toolbar"><input class="field field-search" id="table-search" placeholder="搜索订单号 / 产品…"><div class="toolbar-actions">${action('新增订单','newOrder','','btn-primary')}</div></div>${table(['订单号','产品','规格','数量','责任部门','状态','操作'],data.orders.map(o=>[`<strong>${e(o.id)}</strong>`,e(o.product),e(o.spec),`${o.qty.toLocaleString()} ${o.unit}`,o.owner,tag(o.status),action('查看','detailOrder',o.id)]))}`,'产品 · 规格 · 数量')}`}
function tasks(){return `${panel('生产任务 / 非生产任务',`<div class="info-bar">生产任务：<b>配制、包装</b>。非生产任务：<b>清洗、调机调线</b>。非生产任务有独立工单，原则上不计入产量。</div>${table(['任务号','分类','任务类型','产线','状态','操作'],data.tasks.map(t=>[`<strong>${t.id}</strong>`,e(t.category),`<strong>${e(t.type)}</strong>`,e(t.line),tag(t.status),action('查看 / 处理','task',t.id)]))}`,'4 种任务类型')}`}
function catalog(){return `${panel('产品与物料分类',`<div class="toolbar"><input class="field field-search" placeholder="搜索产品编码 / 规格…" id="table-search">${action('查看关联产线','lines')}</div>${table(['编码','名称','分类','规格','单位'],baseItems.map(i=>[`<strong>${i.id}</strong>`,e(i.name),tag(i.type),e(i.spec),e(i.unit)]))}`,'成品 / 半成品 / 原料 / 辅料 / 包材 / 耗材 / 备件')}${panel('产品与生产线关联',table(['产线','任务类型','适配产品','状态'],lines.map(l=>l.map((v,i)=>i===3?tag(v):e(v)))),'可产关系校验')}`}
function bom(){return `${panel('成品与半成品关系',`<div class="info-bar">成品通过 <b>BOM</b> 关联所需半成品及包材，半成品通过 BOM 关联原辅料。配方比例以受控版本为准，此处展示产品关系，不包含实际化工配方。</div>${table(['父项','子项','分类','关联方式'],[['FG-001 成品','SF-001 半成品','半成品','成品包装领用'],['FG-001 成品','PK-001 5L 包装桶','包材','按规格用量展开'],['FG-001 成品','PK-002 外箱','包材','按包装比例展开'],['SF-001 半成品','RM-001 主剂 A','原料','受控 BOM 配方'],['SF-001 半成品','AD-001 分散剂','辅料','受控 BOM 配方']].map(a=>a.map((v,i)=>i===2?tag(v):e(v))))}`,'按产品 · 规格 · 数量展开')}`}
function templates(){const t=[['TPL-SF-01','配制工艺模板 A','半成品','v2.1','已发布'],['TPL-SF-02','配制工艺模板 B','半成品','v1.4','已发布'],['TPL-FG-01','5L 桶装包装工艺','成品','v1.3','已发布'],['TPL-FG-02','1L 瓶装包装工艺','成品','v1.2','已发布'],['TPL-OLD-01','配制旧版模板','半成品','v1.0','已停用']];return `${panel('工艺模板库',`<div class="info-bar">选择模板后，一键填充批次卡字段。<b>受控 BOM、关键工艺和审批版本</b>不能直接现场修改；允许字段可按权限调整。</div>${table(['模板编号','模板名称','对象','版本','状态','操作'],t.map(([id,n,k,v,s])=>[`<strong>${id}</strong>`,e(n),tag(k),e(v),tag(s),s==='已发布'?action('一键填充','fillTemplate',id):'—']))}`,'4 个发布模板 · 1 个停用版本')}`}
function skills(){return `${panel('员工 / 技能矩阵',`<div class="info-bar">L0 未培训 · L1 训练中 · <b>L2 独立作业</b> · L3 可带教。排班时还要校验证书、实操确认、请假、系统权限与撞班。</div>${table(['员工 / 岗位',...ability],people.filter(p=>p[2]==='生产车间').map((p,i)=>[`<strong>${p[1]}</strong><div class="small-note">${p[3]}</div>`,...ability.map((_,j)=>{let v=[['L2','L1','L0','L0','L0','L1','L2','L0'],['L0','L0','L2','L3','L0','L1','L2','L0'],['L3','L2','L3','L2','L1','L3','L3','L1'],['L2','L2','L0','L1','L0','L0','L2','L0']][i]?.[j]||'L0';return `<span class="matrix-cell ${v==='L0'?'no':v==='L1'?'mixed':'yes'}">${v}</span>`})]))}`,'能力等级 L0–L3')}`}
function permissions(){return access.render()}
function employees(){return `${panel('员工档案',table(['工号','员工姓名','所属部门','岗位','状态'],people.map(p=>[`<strong>${p[0]}</strong>`,p[1],p[2],access.assigned(p[0]).map(id=>access.position(id)?.name||id).join(' / ')||'未分配',tag('在职')])), '组织 / 岗位 / 权限的基础资料')}`}
function leave(){return `${panel('我的请假',`<div class="toolbar"><div class="small-note">员工可申请请假，但不能审批本人假单。</div>${action('发起请假','newLeave','','btn-primary')}</div>${table(['单号','申请人','请假期间','事由','状态'],data.leaves.map(l=>[`<strong>${l.id}</strong>`,e(l.person),e(l.range),e(l.reason),tag(l.status)]))}`,'请假记录')}`}
function leaveApproval(){return `${panel('请假审批待办',table(['单号','员工','日期','原因','状态','处理'],data.leaves.map(l=>[`<strong>${l.id}</strong>`,e(l.person),e(l.range),e(l.reason),tag(l.status),l.status==='待人事审批'?action('审批','approveLeave',l.id):'已处理'])),'人员授权 · 审批')}`}
function payroll(){return `${panel('加班费 / 生产激励工资',`<div class="toolbar"><span class="small-note">加班和激励分开建单，实际金额须经人事和财务审核。</span>${action('加班申请','newOvertime','','btn-primary')}</div>${table(['单号','员工','类型','核算依据','状态','金额'],data.payroll.map(p=>[`<strong>${p.id}</strong>`,p.name,tag(p.type),e(p.basis),tag(p.status),e(p.amount)]))}`,'工资核算记录')}`}
function schedule(){return `${panel('生产排程 · 版本全量',`<div class="toolbar"><div class="small-note">订单评审 → 排产试算 → 采用草稿 → 转正式 → 齐套 → 领料与批次执行</div>${action('智能排产','schedule','','btn-primary')}</div>${table(['计划任务','类型','产线','班次','关联订单','状态'],[['PLAN-01','清洗','L01 配制一线','日班','SO-2026-1023-018','已计划'],['PLAN-02','配制','L01 配制一线','日班','SO-2026-1023-018','草稿'],['PLAN-03','调机调线','S03-4# 瓶装线','夜班','SO-2026-1023-018','草稿'],['PLAN-04','包装','S03-4# 瓶装线','夜班','SO-2026-1023-018','草稿']].map(a=>a.map((v,i)=>i===5?tag(v):e(v))))}`,'试算与正式任务分离')}`}
function shift(){const positions=[['配料','李明','L2','合格'],['搅拌','赵凯','L2','合格'],['灌装','王强','L2','合格'],['包装','张敏','L2','合格'],['在线检验','待分配','—','缺岗']];return `${panel('生产线班组排班',`<div class="toolbar"><span class="small-note">A01 灌装线 · 日班 · 技能符合且无撞班才可上岗</span>${action('智能匹配人员','match','','btn-primary')}</div>${table(['工位','候选员工','技能资格','校验'],positions.map(x=>[x[0],`<strong>${x[1]}</strong>`,x[2],tag(x[3])]))}`,'查看员工技能矩阵')}`}
function simpleView(f){const configs={kitting:['物料齐套',['订单 / 任务','物料分类','应需量','锁库量','状态'],[['SO-2026-1023-018','原料','300 kg','300 kg','齐套'],['SO-2026-1023-018','包材','750 个','500 个','部分缺料']]],issue:['车间领料与仓库发料',['领料单','对应正式任务','物料','状态'],[['PICK-001','PLAN-02 配制','主剂 A','待仓库发料'],['PICK-002','PLAN-04 包装','包装桶','待车间签收']]],purchase:['采购申请',['申请单','物料类别','数量','进度'],[['PO-001','包材','1,000 个','待审核'],['PO-002','原料','300 kg','待到货']]],inventory:['库存与批号',['库存批号','品类','规格','现存量','状态'],[['LOT-2026-011','原料','主剂 A','500 kg','可用'],['LOT-2026-012','半成品','720g/L','1,200 L','待检'],['LOT-2026-013','成品','5L × 4桶','140 箱','可用']]],inspection:['质量检验任务',['报检单','检验阶段','批次','状态'],[['QC-101','半成品检验','BTH-006','待检'],['QC-102','成品检验','BTH-007','已完成']]],release:['质量放行',['检验单','产品','结论','复核状态'],[['QA-201','配制半成品','合格','已确认'],['QA-202','包装成品','待检验','待确认']]],batch:['生产批次卡',['批次卡','任务类型','关联任务','状态'],[['BTH-2026-1023-006','配制','PLAN-02','待开工'],['BTH-2026-1023-007','包装','PLAN-04','待开工']]],engineering:['设备与调机调线',['工单','对象产线','内容','状态'],[['ENG-001','S03-4# 瓶装线','调机调线','待执行'],['ENG-002','L01 配制一线','设备点检','已完成']]],safety:['EHS 安全检查',['检查单','场所','问题','状态'],[['EHS-001','配制车间','现场防护检查','待整改'],['EHS-002','包装车间','巡检','已完成']]],finance:['财务审核',['凭证','类型','金额','状态'],[['FIN-001','加班费','待核算','待确认'],['FIN-002','激励工资','待核算','待确认']]],approvals:['总经办审批',['事项','申请部门','审批类型','状态'],[['APR-001','信息化','敏感权限','待复核'],['APR-002','PMC','排程授权','待复核']]],orderReview:['订单评审',['订单号','产品 / 规格','数量','评审状态'],data.orders.map(o=>[o.id,o.product+' / '+o.spec,`${o.qty} ${o.unit}`,o.status])],incentive:['生产激励提报',['单号','员工','计量依据','状态'],data.payroll.filter(p=>p.type==='生产激励').map(p=>[p.id,p.name,p.basis,p.status])]};const [title,cols,rows]=configs[f]||['业务记录',['记录','内容'],[['REC-001','记录']]];return panel(title,`${table(cols,rows.map(r=>r.map((x,i)=>i===r.length-1?tag(x):i===0?`<strong>${e(x)}</strong>`:e(x))))}<div class="small-note" style="padding-top:12px">浏览器本地保存记录，审批和生产状态须由业务服务器确认。</div>`,'业务数据')}
function updateUserHeader(){
 const user=access.current();
 $('user-name').textContent=user.name;
 $('user-department').textContent=user.dept;
 $('user-avatar').textContent=user.name.slice(-1);
 const chooser=$('employee-chooser');
 if(chooser)chooser.innerHTML=access.staff.map(p=>`<button type="button" role="option" aria-selected="${p.id===user.id}" class="employee-option ${p.id===user.id?'active':''}" data-switch-employee="${e(p.id)}"><span class="employee-initial">${e(p.name.slice(-1))}</span><span class="employee-info"><strong>${e(p.name)}</strong><small>${e(p.title)} · ${e(p.dept)}</small></span>${p.id===user.id?icon('check'):''}</button>`).join('');
}
function switchEmployee(id){
 if(!access.switchCurrent(id))return;
 closeChat();
 const pos=access.position(access.assigned(access.current().id)[0]);
 data.dept=pos?.dept||'it';data.expanded=data.dept;data.feature=null;
 render();updateAddress(data.dept);toggleUserMenu(false);
}
function toggleUserMenu(force){const menu=$('user-menu'),trigger=$('user-menu-toggle');const show=typeof force==='boolean'?force:menu.hidden;menu.hidden=!show;trigger.setAttribute('aria-expanded',String(show));}
function render(){let d=departments.find(x=>x.id===data.dept)||departments[0];const f=data.feature;navRender();updateUserHeader();if(data.home){data.feature=null;crumbsHome();try{$('view').innerHTML=window.FactoryModules?.render('overview')||overview()}catch(err){console.error('overview render failed',err);$('view').innerHTML=overview()}save();return}crumbs(d,f);if(f&&!allowed(d.id,f)){data.feature=null;return render()}$('view').innerHTML=!f?deptHome(d):window.FactoryModules.supports(f)?window.FactoryModules.render(f):(['permissions','leave','leaveApproval'].includes(f)?({permissions,leave,leaveApproval}[f])():ops.render(f));save()}
const deniedFlashTimers=new WeakMap();
function flashDenied(target){
  if(!target)return;
  target.classList.remove('access-denied-flash');
  void target.offsetWidth; // 连续点击时重新播放动画
  target.classList.add('access-denied-flash');
  clearTimeout(deniedFlashTimers.get(target));
  deniedFlashTimers.set(target,setTimeout(()=>{target.classList.remove('access-denied-flash');deniedFlashTimers.delete(target)},800));
}
function openDept(id){
  if(!departments.some(d=>d.id===id))return;
  data.home=false;data.dept=id;data.feature=null;data.expanded=id;render();updateAddress(id);closeSidebar();
}
function openFeature(feat,dept,trigger){
  let d=dept||data.dept;
  if(!allowed(d,feat)){
    // 不弹窗、不跳转、不出现 Toast，只有被点击的锁定项短暂泛红
    flashDenied(trigger||document.querySelector(`#nav [data-feature="${feat}"][data-feature-dept="${d}"]`)||document.querySelector(`#nav [data-dept="${d}"]`));
    return;
  }
  data.home=false;data.dept=d;data.expanded=d;data.feature=feat;render();updateAddress(d,feat);closeSidebar();window.scrollTo({top:0,behavior:'smooth'});
}

function trackBottleneck(target,ref=''){
 if(!target?.dept||!target?.feature)return;
 const dept=target.dept,feature=target.feature;
 if(!allowed(dept,feature)){
  data.home=false;data.dept=dept;data.feature=null;data.expanded=dept;render();updateAddress(dept);closeSidebar();
  setTimeout(()=>{
   const tile=document.querySelector(`[data-feature="${CSS.escape(feature)}"][data-feature-dept="${CSS.escape(dept)}"]`);
   flashDenied(tile);
   tile?.scrollIntoView({block:'center',behavior:'smooth'});
  },40);
  return;
 }
 data.home=false;data.dept=dept;data.expanded=dept;data.feature=feature;render();updateAddress(dept,feature);closeSidebar();
 setTimeout(()=>{
  const needle=String(ref||target.record||'').trim();
  if(!needle)return;
  const rows=[...document.querySelectorAll('#view tbody tr,.dept-todo-card,.op-quality-link,.mw-table tbody tr,.op-table tbody tr')];
  const hit=rows.find(el=>el.textContent.includes(needle));
  if(hit){
   hit.classList.remove('bottleneck-track-highlight');
   void hit.offsetWidth;
   hit.classList.add('bottleneck-track-highlight');
   hit.scrollIntoView({block:'center',behavior:'smooth'});
   setTimeout(()=>hit.classList.remove('bottleneck-track-highlight'),3200);
  }
 },70);
}
window.FactoryNavigation={trackBottleneck,openHome,openDept,openFeature};

function openHome(update=true){data.home=true;data.feature=null;render();if(update)updateHomeAddress();closeSidebar();window.scrollTo({top:0,behavior:'smooth'})}
function loadAddress(){
  if(location.hash==='#/overview'){data.home=true;data.feature=null;render();return}
  const match=location.hash.match(/^#\/departments\/([a-z]+)(?:\/([a-zA-Z]+))?$/);
  if(!match)return;
  const oldDept=match[1];if(oldDept==='ehs'){openHome();return;}
  const d=departments.find(x=>x.id===(oldDept==='tech'?'it':oldDept));if(!d)return;
  if(oldDept==='tech')history.replaceState(null,'',pageHash('it',match[2]));
  const feat=match[2];if(feat&&(!d.features.includes(feat)||!allowed(d.id,feat)))return;
  data.home=false;data.dept=d.id;data.expanded=d.id;data.feature=feat||null;render();
}
function modal(title,body,fields='',handler=''){let host=$('modal-host');host.innerHTML=`<div class="modal-screen" id="modal-screen"><div class="modal-box"><button class="icon-btn modal-close" id="close-modal" aria-label="关闭">${icon('close')}</button><div class="eyebrow">FACTORY OS / WORKSPACE</div><h2>${e(title)}</h2><p class="modal-description">${e(body)}</p>${fields?`<div class="modal-content">${fields}</div>`:''}<div class="modal-foot"><button class="btn btn-quiet" id="cancel-modal">取消</button>${handler?`<button class="btn btn-primary" data-action="${handler}">确认</button>`:action('知道了','close')}</div></div></div>`}
function closeModal(){$('modal-host').innerHTML=''}
function field(label,id,type='text',value='',other=''){return `<div class="form-group"><label for="${id}">${e(label)}</label><input class="field" id="${id}" type="${type}" value="${e(value)}" ${other}></div>`}
function reset(){if(!confirm('重置本浏览器内的数据和消息？'))return;data=JSON.parse(JSON.stringify(initial));data.offices={};data.chatThreads={};access.reset();ops.init({data,save,access,toast,flashDenied,render,openFeature});window.FactoryGantt.init({data,save,access,render,flashDenied});window.FactoryModules.init({data,save,access,toast,render,openFeature,ops});data.dept='it';data.expanded='it';data.home=true;save();render();updateHomeAddress();updateUnread();toast('本地数据已重置')}
function updateUnread(){let n=data.messages.filter(m=>m.unread).length;$('unread-badge').textContent=n;$('unread-badge').classList.toggle('zero',n===0);$('drawer-unread').textContent=n}
function drawMessages(){updateUnread();$('message-list').innerHTML=data.messages.map(m=>{let d=departments.find(d=>d.id===m.dept);return `<div class="message ${m.unread?'unread':''}" data-message="${m.id}"><span class="message-icon">${icon(d?.icon||'bell')}</span><div class="message-main"><strong>${e(m.title)}</strong><p>${e(m.text)}</p><small>${e(m.date)} · ${e(d?.name||'系统消息')}</small></div>${icon('arrow','ico tiny')}</div>`}).join('')||'<div class="empty-state">暂无消息</div>'}
function toggleDrawer(open){drawer=open;$('notify-drawer').classList.toggle('open',drawer);$('drawer-shade').classList.toggle('visible',drawer);if(drawer)drawMessages()}
function closeSidebar(){$('sidebar').classList.remove('open');$('shade').classList.remove('visible')}
document.addEventListener('click',ev=>{
const homeCrumb=ev.target.closest('[data-breadcrumb-home]');if(homeCrumb){openHome();return;}
const deptCrumb=ev.target.closest('[data-breadcrumb-dept]');if(deptCrumb){openDept(deptCrumb.dataset.breadcrumbDept);return;}
const tabBtn=ev.target.closest('[data-dept-tab]');if(tabBtn){deptTabs[data.dept]=tabBtn.dataset.deptTab;render();return;}
const modBtn=ev.target.closest('[data-module-action]');if(modBtn){window.FactoryModules.handleClick(modBtn);return;}
const opBtn=ev.target.closest('[data-op-action]');if(opBtn){ops.handleClick(opBtn);return;}
let chatClose=ev.target.closest('[data-chat-close]');if(chatClose){closeChat();return;}
let chatOpen=ev.target.closest('[data-chat-person]');if(chatOpen){openChat(chatOpen.dataset.chatPerson);return;}
let todoBtn=ev.target.closest('[data-todo-kind]');if(todoBtn){openTodoRecord(todoBtn.dataset.todoKind,todoBtn.dataset.todoId,todoBtn.dataset.todoDept,todoBtn);return;}
let employeeButton=ev.target.closest('[data-switch-employee]');if(employeeButton){switchEmployee(employeeButton.dataset.switchEmployee);return;}
let rightsButton=ev.target.closest('[data-access-assign],[data-access-role],[data-access-personal]');
if(rightsButton){if(access.handleClick(rightsButton))render();else flashDenied(rightsButton);return;}
let overviewButton=ev.target.closest('[data-dept-overview]');if(overviewButton){const id=overviewButton.dataset.deptOverview;if(departments.some(d=>d.id===id)){data.expanded=id;data.dept=id;data.feature=null;render();updateAddress(id);closeSidebar()}return;}
let a=ev.target.closest('[data-action]');if(a){let op=a.dataset.action,id=a.dataset.id;if(op==='finishWorkItem')return finishWorkItem();
if(op==='editOffice'){if(!canEditOffice())return flashDenied(a);window._officeId=id;return modal('编辑办公位置','请填写实际厂区、楼栋、楼层、房间号，不是网页链接。',field('办公位置','office-location-input','text',data.offices[id]||'','maxlength=140'),'saveOffice')}
if(op==='saveOffice'){if(!canEditOffice())return flashDenied(a);const key=window._officeId;if(!departments.some(d=>d.id===key))return closeModal();data.offices[key]=($('office-location-input')?.value||'').trim().slice(0,140);save();closeModal();render();return;}
if(op==='close')return closeModal();if(op==='copyDeptURL'){const url=deptURL(id);navigator.clipboard?.writeText(url).then(()=>toast('地址已复制')).catch(()=>toast(url));return;}
const requireAction={newLeave:['hr','leave','create'],submitLeave:['hr','leave','create'],approveLeave:['hr','leaveApproval','approve'],doApproveLeave:['hr','leaveApproval','approve'],newOrder:['sales','orders','create'],submitOrder:['sales','orders','create'],task:['production','tasks','view'],advanceTask:['production','tasks','execute'],fillTemplate:['it','templates','edit'],saveTemplate:['it','templates','edit'],schedule:['pmc','schedule','edit'],match:['production','shift','edit'],newOvertime:['hr','payroll','create'],submitOvertime:['hr','payroll','create']};const need=requireAction[op];if(need&&!access.has(...need)){flashDenied(a);return;}
if(op==='nav')return openFeature(id,'pmc',a);if(op==='newLeave')return modal('发起请假','请输入请假日期和事由。当前记录保存在本浏览器。',`<div class="form-grid">${field('开始日期','leave-start','date','2026-11-09')}${field('结束日期','leave-end','date','2026-11-09')}<div class="form-group wide"><label>请假事由</label><input class="field" id="leave-reason" value="个人事务"></div></div>`,'submitLeave');if(op==='submitLeave'){let start=$('leave-start').value,end=$('leave-end').value;if(!start||!end||end<start)return toast('请检查请假日期','hr');let n='LV-'+String(Date.now()).slice(-6);data.leaves.unshift({id:n,person:'当前员工',range:`${start} ~ ${end}`,reason:$('leave-reason').value||'个人事务',status:'待人事审批'});message('请假待审批',`${n} 已提交，等待人事人员处理`,'hr','leaveApproval');closeModal();render();return toast(`${n} 请假申请已提交`,'hr')}
if(op==='approveLeave'){let l=data.leaves.find(x=>x.id===id);if(!l)return;window._approveId=id;return modal('审批请假',`${id} · ${l.person} · ${l.range}`,`<div class="info-bar">处理记录保存在本浏览器中。</div>`,'doApproveLeave')}
if(op==='doApproveLeave'){let l=data.leaves.find(x=>x.id===window._approveId);if(l)l.status='审核通过';message('请假审批完成',`${l?.id||''} 已审核通过`,'hr','leave');closeModal();render();return toast('请假审批已完成','hr')}
if(op==='newOrder')return modal('创建销售订单','产品 · 规格 · 数量是订单必填信息。',`<div class="form-grid">${field('产品名称','ord-product','text','720g/L 百菌清悬浮剂')}${field('规格','ord-spec','text','5L × 4桶')}${field('计划数量（L）','ord-qty','number','1000','min="1"')}</div>`,'submitOrder');if(op==='submitOrder'){let prod=$('ord-product').value.trim(),spec=$('ord-spec').value.trim(),qty=Number($('ord-qty').value);if(!prod||!spec||!(qty>0))return toast('产品、规格、数量必填','sales');let id='SO-'+Date.now().toString().slice(-5);data.orders.unshift({id,product:prod,spec,qty,unit:'L',status:'待评审',owner:'销售部'});message('新建销售订单',`${id} 已进入订单评审流程`,'sales','orderReview');closeModal();render();return toast(`${id} 订单已创建`,'sales')}
if(op==='detailOrder'){let x=data.orders.find(v=>v.id===id);return x&&modal('销售订单详情',`${x.id} · ${x.product} · ${x.spec} · ${x.qty.toLocaleString()} ${x.unit} · ${x.status}`)}
if(op==='task'){let t=data.tasks.find(t=>t.id===id);if(!t)return;window._taskId=id;return modal(`${t.type} · ${t.id}`,`任务类型：${t.category}。执行产线：${t.line}。当前状态：${t.status}。生产任务与非生产任务分开建单。`, `<div class="info-bar">任务状态保存在本浏览器，实际开工前须完成现场安全联锁和批次记录。</div>`,'advanceTask')}
if(op==='advanceTask'){let t=data.tasks.find(t=>t.id===window._taskId);if(t)t.status=t.status==='待开始'?'执行中':t.status==='执行中'?'待复核':'已完成';if(t)message('任务状态已更新',`${t.id} ${t.type} · ${t.status}`,t.type==='调机调线'?'engineering':'production','tasks');closeModal();render();return toast('任务状态已更新','production')}
if(op==='fillTemplate')return modal('模板一键填充',`${id} · 将受控模板字段带入批次卡草稿。只有允许调整的现场记录字段可微改。`,`<div class="form-grid">${field('实际处理量（L）','tpl-qty','number','1000')}${field('现场备注','tpl-note','text','按标准工艺执行')}</div>`,'saveTemplate');if(op==='saveTemplate'){closeModal();message('工艺模板已带入','批次卡草稿已带入工艺模板','it','templates');return toast('模板字段已填充','tech')}
if(op==='schedule'){message('智能排产试算完成','已生成配制、包装、清洗、调机调线任务','pmc','schedule');return toast('排产试算完成','pmc')}
if(op==='match')return toast('已按技能矩阵筛选适岗候选人','production');if(op==='lines')return modal('产品与产线关联',lines.map(l=>`${l[0]} · ${l[1]} · ${l[2]}`).join('；'));
if(op==='newOvertime')return modal('提交加班申请','加班费由人事复核、财务核准后确认。工资计价参数以实际核准规则为准。',`<div class="form-grid">${field('员工姓名','ot-name','text','当前员工')}${field('加班小时数','ot-hours','number','2','min="0.5" step="0.5"')}</div>`,'submitOvertime');if(op==='submitOvertime'){let hours=Number($('ot-hours').value);if(!hours)return toast('请填写加班时长','hr');let id='OT-'+Date.now().toString().slice(-5);data.payroll.unshift({id,name:$('ot-name').value||'当前员工',type:'加班',basis:`${hours} 小时`,status:'待人事复核',amount:'—'});message('加班申请待复核',`${id} 已提交`,'hr','payroll');closeModal();render();return toast('加班申请已提交','hr')}return}
let nav=ev.target.closest('[data-dept]');if(nav)return openDept(nav.dataset.dept,nav);
let feat=ev.target.closest('[data-feature]');if(feat)return openFeature(feat.dataset.feature,feat.dataset.featureDept,feat);
let m=ev.target.closest('[data-message]');if(m){let x=data.messages.find(x=>String(x.id)===m.dataset.message);if(x){x.unread=false;save();updateUnread();toggleDrawer(false);if(x.feature)openFeature(x.feature,x.dept);else openHome()}}
if(ev.target.closest('#close-modal')||ev.target.closest('#cancel-modal')||ev.target.id==='modal-screen')closeModal();
});
document.addEventListener('submit',ev=>{if(window.FactoryModules.submitForm(ev))return;if(ops.submitForm(ev))return;if(ev.target.id==='chat-form'){ev.preventDefault();submitChat()}});
document.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&window._chatPeer)closeChat()});
document.addEventListener('input',ev=>{if(ev.target.id!=='dept-member-search')return;const term=ev.target.value.trim().toLowerCase();let found=0;document.querySelectorAll('#dept-member-grid [data-member-search]').forEach(card=>{const ok=card.dataset.memberSearch.includes(term);card.hidden=!ok;if(ok)found++});const empty=document.querySelector('#dept-members-no-results');if(empty)empty.hidden=found>0;});
$('dept-search').addEventListener('input',ev=>{q=ev.target.value.trim().toLowerCase();navRender()});

document.addEventListener('change',ev=>{const lookup={'perm-employee':'employee','perm-position':'position','perm-dept':'dept'};const key=lookup[ev.target.id];if(key){access.updateSelection(key,ev.target.value);render();}});
window.addEventListener('popstate',loadAddress);window.addEventListener('hashchange',loadAddress);

$('user-menu-toggle').addEventListener('click',()=>toggleUserMenu());document.addEventListener('click',ev=>{if(!ev.target.closest('.user-account'))toggleUserMenu(false)});document.addEventListener('keydown',ev=>{if(ev.key==='Escape')toggleUserMenu(false)});$('notify-btn').addEventListener('click',()=>toggleDrawer(true));$('drawer-close').addEventListener('click',()=>toggleDrawer(false));$('drawer-shade').addEventListener('click',()=>toggleDrawer(false));$('read-all').addEventListener('click',()=>{data.messages.forEach(x=>x.unread=false);save();drawMessages();toast('全部消息已标记已读')});$('reset-local').addEventListener('click',reset);$('mobile-menu').addEventListener('click',()=>{$('sidebar').classList.add('open');$('shade').classList.add('visible')});$('shade').addEventListener('click',closeSidebar);
$('view').addEventListener('input',ev=>{if(ev.target.id==='table-search'){let search=ev.target.value.trim().toLowerCase();$('view').querySelectorAll('.data-table tbody tr').forEach(row=>row.style.display=row.textContent.toLowerCase().includes(search)?'':'none')}});updateUnread();if(!location.hash)history.replaceState(null,'','#/overview');loadAddress();
})();