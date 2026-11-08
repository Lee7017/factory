/* 员工、岗位及个人权限。所有页面计算取岗位权限与个人授权并集。 */
(()=>{'use strict';
const actionNames={view:'查看',create:'创建',edit:'修改',approve:'审批',execute:'执行',config:'配置'};
const capabilities={
 overview:['view'],hours:['view','create'],sop:['view','create','edit','approve','execute'],qaQc:['view','create','approve'],workshop:['view','create','execute','approve'],warehouseOps:['view','create','execute','approve'],settings:['view','config'],leave:['view','create'],leaveApproval:['view','approve'],employees:['view','edit'],skills:['view','edit'],payroll:['view','create','approve'],orders:['view','create','edit'],orderReview:['view','approve'],orderHistory:['view'],schedule:['view','edit','approve'],kitting:['view','execute'],shift:['view','edit','approve'],purchase:['view','create','approve'],inventory:['view','edit'],issue:['view','execute'],inspection:['view','execute'],release:['view','approve'],tasks:['view','execute'],batch:['view','execute'],incentive:['view','create','approve'],templates:['view','edit','approve'],bom:['view','edit'],catalog:['view','edit'],engineering:['view','execute','approve'],finance:['view','approve'],permissions:['view','config'],approvals:['view','approve'],hoursAppeal:['view'],qaSampling:['view'],qaCleanInspection:['view'],qaNcr:['view'],qaQualityStock:['view'],workshopReceive:['view'],workshopDispute:['view'],workshopRework:['view'],warehouseIncoming:['view'],warehousePick:['view'],warehouseOutbound:['view'],warehouseReturns:['view'],warehouseLedger:['view'],shiftPeople:['view'],shiftStats:['view'],orderProductStats:['view'],orderDailyReport:['view'],sopExecutions:['view'],productSettings:['view'],dictionarySettings:['view']
};
const positions=[
 {id:'employee',name:'普通员工',dept:'hr',features:['hr.leave']},
 {id:'hr',name:'人事专员',dept:'hr',features:['hr.hours','hr.hoursAppeal','hr.leave','hr.leaveApproval','hr.employees','hr.skills','hr.payroll']},
 {id:'hr_manager',name:'人事主管',dept:'hr',features:['hr.hours','hr.hoursAppeal','hr.leave','hr.leaveApproval','hr.employees','hr.skills','hr.payroll']},
 {id:'sales',name:'销售专员',dept:'sales',features:['sales.orders','sales.orderReview','sales.orderHistory','hr.leave']},
 {id:'pmc',name:'PMC 计划员',dept:'pmc',features:['pmc.schedule','pmc.kitting','pmc.shift','pmc.shiftPeople','pmc.shiftStats','pmc.orderProductStats','pmc.orderDailyReport','production.skills','hr.leave']},
 {id:'purchase',name:'采购专员',dept:'purchase',features:['purchase.purchase','hr.leave']},
 {id:'purchase_manager',name:'采购主管',dept:'purchase',features:['purchase.purchase','hr.leave']},
 {id:'warehouse',name:'仓库管理员',dept:'warehouse',features:['warehouse.warehouseOps','warehouse.warehouseIncoming','warehouse.warehousePick','warehouse.warehouseOutbound','warehouse.warehouseReturns','warehouse.warehouseLedger','warehouse.inventory','warehouse.issue','hr.leave']},
 {id:'quality',name:'质量专员',dept:'quality',features:['quality.qaQc','quality.qaSampling','quality.qaCleanInspection','quality.qaNcr','quality.qaQualityStock','quality.release','hr.leave']},
 {id:'production',name:'生产操作员',dept:'production',features:['production.workshop','production.workshopReceive','production.workshopDispute','production.workshopRework','production.tasks','production.batch','hr.leave']},
 {id:'production_lead',name:'生产班组长',dept:'production',features:['production.workshop','production.workshopReceive','production.workshopDispute','production.workshopRework','production.tasks','production.batch','production.shift','production.skills','production.incentive','hr.leave']},
 {id:'tech',name:'工艺技术员',dept:'it',features:['it.sop','it.sopExecutions','it.templates','it.bom','it.catalog','hr.leave']},
 {id:'engineering',name:'设备工程师',dept:'engineering',features:['engineering.engineering','hr.leave']},
 {id:'finance',name:'财务专员',dept:'finance',features:['finance.payroll','finance.finance','hr.leave']},
 {id:'it',name:'信息化管理员',dept:'it',features:['it.settings','it.productSettings','it.dictionarySettings','it.permissions','it.employees','it.catalog','it.sop','it.sopExecutions','it.templates','it.bom','hr.leave']},
 {id:'executive',name:'总经办',dept:'leadership',features:['leadership.approvals','hr.leave']},
 {id:'developer',name:'开发人员',dept:'it',features:['*']}
];
// 每名员工均可管理本人工时，岗位及其余个人授权仍按并集计算。
for(const p of positions)if(p.id!=='developer'){if(!p.features.includes('hr.hours'))p.features.push('hr.hours');if(!p.features.includes('hr.hoursAppeal'))p.features.push('hr.hoursAppeal')}
const staff=[
 {id:'E001',name:'陈雯',dept:'人事行政办公室',title:'人事主管',positions:['hr_manager']},
 {id:'E002',name:'李明',dept:'生产车间',title:'配制工',positions:['production']},
 {id:'E003',name:'王强',dept:'生产车间',title:'包装工',positions:['production']},
 {id:'E004',name:'张敏',dept:'生产车间',title:'生产班组长',positions:['production_lead']},
 {id:'E005',name:'赵凯',dept:'生产车间',title:'配料工',positions:['production']},
 {id:'E006',name:'刘洋',dept:'质量部',title:'QA 检验员',positions:['quality']},
 {id:'E007',name:'周琳',dept:'生产计划与物料控制部（PMC）',title:'计划员',positions:['pmc']},
 {id:'E008',name:'吴建',dept:'设备工程部',title:'设备工程师',positions:['engineering']},
 {id:'E009',name:'孙浩',dept:'仓库 / 物流部',title:'仓管员',positions:['warehouse']},
 {id:'E010',name:'林静',dept:'信息化 / 工艺技术部',title:'信息化管理员',positions:['it']},
 {id:'E011',name:'许宁',dept:'人事行政办公室',title:'普通员工',positions:['employee']},
 {id:'E012',name:'小明',dept:'开发人员',title:'开发人员',positions:['developer']},
 {id:'E013',name:'杨澜',dept:'销售部',title:'销售专员',positions:['sales']},
 {id:'E014',name:'唐娟',dept:'采购 / 供应链部',title:'采购专员',positions:['purchase']},
 {id:'E021',name:'何敏',dept:'采购 / 供应链部',title:'采购主管',positions:['purchase_manager']},
 {id:'E015',name:'韩冰',dept:'人事行政办公室',title:'行政员工',positions:['employee']},
 {id:'E016',name:'冯洁',dept:'财务部',title:'财务专员',positions:['finance']},
 {id:'E017',name:'苏晨',dept:'信息化 / 工艺技术部',title:'工艺技术员',positions:['tech']},
 {id:'E018',name:'郑华',dept:'总经办',title:'管理人员',positions:['executive']},
 {id:'E019',name:'戴琴',dept:'人事行政办公室',title:'人事专员',positions:['hr']},
 {id:'E020',name:'马飞',dept:'生产车间',title:'生产 / 仓库兼岗',positions:['production','warehouse']}
];
const storage='factory-permissions-v2';
const defaultRights=()=>Object.fromEntries(positions.filter(p=>p.id!=='developer').map(p=>[p.id,p.features.flatMap(x=>{const f=x.split('.')[1];return (capabilities[f]||['view']).filter(a=>!((p.id==='production'&&x==='production.workshop'&&a==='approve')||(p.id==='purchase'&&x==='purchase.purchase'&&a==='approve'))).map(a=>`${x}.${a}`)})]));
const fresh=()=>({current:'E012',assigned:Object.fromEntries(staff.map(p=>[p.id,[...p.positions]])),extra:{},positionRights:defaultRights()});
let state=fresh();
try{const read=JSON.parse(localStorage.getItem(storage)||'null');if(read&&typeof read==='object'){
  state.current=staff.some(p=>p.id===read.current)?read.current:state.current;
  for(const p of staff){const assigned=read.assigned?.[p.id];if(Array.isArray(assigned))state.assigned[p.id]=assigned.filter(id=>positions.some(r=>r.id===id));const extra=read.extra?.[p.id];if(Array.isArray(extra))state.extra[p.id]=extra.filter(v=>typeof v==='string')}
  for(const p of positions.filter(x=>x.id!=='developer')){const rights=read.positionRights?.[p.id];if(Array.isArray(rights))state.positionRights[p.id]=rights.filter(v=>typeof v==='string')}
}}catch{}
// 历史订单是销售岗位的只读归档入口；仅做一次兼容迁移。
if(!state.orderHistoryMigrated){const rights=state.positionRights.sales||[];if(!rights.includes('sales.orderHistory.view'))rights.push('sales.orderHistory.view');state.positionRights.sales=rights;state.orderHistoryMigrated=true;try{localStorage.setItem(storage,JSON.stringify(state))}catch{}}
// 兼容“一个长 Tab”拆成独立功能格后的既有岗位权限，只迁移一次。
if(!state.splitFeatureRightsMigrated){
 const aliases={
  'hr.hours':['hr.hoursAppeal'],
  'pmc.shift':['pmc.shiftPeople','pmc.shiftStats','pmc.orderProductStats','pmc.orderDailyReport'],
  'warehouse.warehouseOps':['warehouse.warehouseIncoming','warehouse.warehousePick','warehouse.warehouseOutbound','warehouse.warehouseReturns','warehouse.warehouseLedger'],
  'quality.qaQc':['quality.qaSampling','quality.qaCleanInspection','quality.qaNcr','quality.qaQualityStock'],
  'production.workshop':['production.workshopReceive','production.workshopDispute','production.workshopRework'],
  'it.sop':['it.sopExecutions'],
  'it.settings':['it.productSettings','it.dictionarySettings']
 };
 for(const p of positions.filter(x=>x.id!=='developer')){
  const rights=state.positionRights[p.id]||[];
  for(const [base,targets] of Object.entries(aliases))if(rights.includes(base+'.view'))for(const target of targets)if(!rights.includes(target+'.view'))rights.push(target+'.view');
  state.positionRights[p.id]=rights;
 }
 state.splitFeatureRightsMigrated=true;try{localStorage.setItem(storage,JSON.stringify(state))}catch{}
}
// 兼容此前已保存的岗位权限：新增模块只迁移一次，不覆盖后续手动撤权。
if(!state.modulesRightsMigrated){for(const p of positions.filter(p=>p.id!=='developer')){const existing=state.positionRights[p.id]||[];for(const feature of p.features){if(!['hours','qaQc','workshop','warehouseOps','sop','settings'].includes(feature.split('.')[1]))continue;const name=feature.split('.')[1];for(const action of capabilities[name]||['view']){if(p.id==='production'&&feature==='production.workshop'&&action==='approve')continue;const key=feature+'.'+action;if(!existing.includes(key))existing.push(key)}}state.positionRights[p.id]=existing}state.modulesRightsMigrated=true;try{localStorage.setItem(storage,JSON.stringify(state))}catch{}}
// 旧的工艺权限与岗位迁移到信息化部门，保留已保存的其他权限。
if(!state.mergedTechIntoItV1){
 const migrate=key=>key.replace(/^tech\./,'it.');
 for(const [pos,rights] of Object.entries(state.positionRights)){
  state.positionRights[pos]=[...new Set(rights.filter(key=>!key.startsWith('ehs.')).map(migrate))];
 }
 for(const [person,rights] of Object.entries(state.extra)){
  state.extra[person]=[...new Set(rights.filter(key=>!key.startsWith('ehs.')).map(migrate))];
 }
 for(const [person,roles] of Object.entries(state.assigned)){
  state.assigned[person]=roles.filter(role=>role!=='ehs');
  if(person==='E015'&&!state.assigned[person].length)state.assigned[person]=['employee'];
 }
 const itRights=state.positionRights.it||[];
 for(const name of ['sop','sopExecutions','templates','bom']){
  for(const action of capabilities[name]||['view']){
   const key='it.'+name+'.'+action;
   if(!itRights.includes(key))itRights.push(key);
  }
 }
 state.positionRights.it=itRights;
 state.mergedTechIntoItV1=true;
 try{localStorage.setItem(storage,JSON.stringify(state))}catch{}
}
let selectedEmployee='E020',selectedPosition='production',selectedDept='production';
let departments=[],features={};
const save=()=>{try{localStorage.setItem(storage,JSON.stringify(state))}catch{}};
function init(depts,featureNames){departments=depts;features=featureNames}
const current=()=>staff.find(p=>p.id===state.current)||staff[10];
const person=id=>staff.find(p=>p.id===id)||staff[10];
const assigned=id=>state.assigned[id]||[];
const own=id=>state.extra[id]||[];
const position=id=>positions.find(p=>p.id===id);
const roleKeys=id=>state.positionRights[id]||[];
function sources(personId,key){const ids=assigned(personId);if(ids.includes('developer'))return {viaJob:true,viaPersonal:false,developer:true};return {viaJob:ids.some(id=>roleKeys(id).includes(key)),viaPersonal:own(personId).includes(key),developer:false}}
function hasFor(personId,dept,feat,action='view'){
  if(!departments.some(d=>d.id===dept&&d.features.includes(feat)))return false;
  const key=`${dept}.${feat}.${action}`;
  const src=sources(personId,key);
  if(src.viaJob||src.viaPersonal||src.developer)return true;
  // 拥有某项操作权限时，可进入该功能页面
  if(action==='view')return (capabilities[feat]||[]).some(a=>a!=='view'&&sources(personId,`${dept}.${feat}.${a}`).viaJob)||
    (capabilities[feat]||[]).some(a=>a!=='view'&&sources(personId,`${dept}.${feat}.${a}`).viaPersonal);
  return false;
}
const has=(dept,feat,action='view')=>hasFor(state.current,dept,feat,action);
const canEdit=()=>has('it','permissions','config');
function switchCurrent(id){if(!staff.some(p=>p.id===id))return false;state.current=id;save();return true}
function updateSelection(key,value){if(key==='employee'&&staff.some(p=>p.id===value))selectedEmployee=value;
  if(key==='position'&&positions.some(p=>p.id===value))selectedPosition=value;
  if(key==='dept'&&departments.some(d=>d.id===value))selectedDept=value;
}
const permissionRows=()=>{const d=departments.find(x=>x.id===selectedDept);if(!d)return[];return d.features.flatMap(f=>(capabilities[f]||['view']).map(a=>({key:`${d.id}.${f}.${a}`,dept:d.id,feature:f,action:a,name:features[f]||f}))) };
const canChangeDeveloper=()=>assigned(state.current).includes('developer');
function toggleAssignment(empId,posId){if(!canEdit())return false;if(posId==='developer'&&!canChangeDeveloper())return false;
  if(empId==='E012'&&posId==='developer')return false; // 预置开发人员保留岗位
  const arr=assigned(empId);state.assigned[empId]=arr.includes(posId)?arr.filter(x=>x!==posId):[...arr,posId];save();return true;
}
function togglePositionPermission(posId,key){if(!canEdit()||posId==='developer')return false;
  if(!permissionRows().some(x=>x.key===key))return false;
  const arr=roleKeys(posId);state.positionRights[posId]=arr.includes(key)?arr.filter(x=>x!==key):[...arr,key];save();return true;
}
function togglePersonalPermission(empId,key){if(!canEdit()||!permissionRows().some(x=>x.key===key))return false;
  const arr=own(empId);state.extra[empId]=arr.includes(key)?arr.filter(x=>x!==key):[...arr,key];save();return true;
}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&quot;'}[c]));
const setSelect=(id,values,value)=>`<select class="field" id="${id}">${values.map(([v,n])=>`<option value="${esc(v)}" ${v===value?'selected':''}>${esc(n)}</option>`).join('')}</select>`;
function render(){
 const rolesExpanded=!!document.querySelector('.access-role-details[open]');
 const employee=person(selectedEmployee), employed=assigned(employee.id), modifiable=canEdit();
 const rows=permissionRows(), active=position(selectedPosition);
 const keys=[...new Set(departments.flatMap(d=>d.features.flatMap(f=>(capabilities[f]||['view']).map(a=>`${d.id}.${f}.${a}`))))];
 const count=keys.filter(key=>{let [d,f,a]=key.split('.');return hasFor(employee.id,d,f,a)}).length;
 const selectedJob=position(selectedPosition);
 const rights=rows.map(r=>{
  const src=sources(employee.id,r.key),effective=src.developer||src.viaJob||src.viaPersonal;
  const personal=own(employee.id).includes(r.key),pos=roleKeys(selectedPosition).includes(r.key);
  const origin=src.developer?'开发人员':src.viaJob&&src.viaPersonal?'岗位 + 个人':src.viaJob?'岗位权限':src.viaPersonal?'个人权限':'—';
  return `<tr><td><strong>${esc(r.name)}</strong></td><td>${esc(actionNames[r.action])}</td><td><button class="permission-toggle ${pos||selectedPosition==='developer'?'granted':''}" data-access-role="${esc(r.key)}" aria-pressed="${pos||selectedPosition==='developer'}" ${!modifiable||selectedPosition==='developer'?'disabled':''}>${selectedPosition==='developer'?'全部':pos?'已授权':'未授权'}</button></td><td><button class="permission-toggle ${personal?'granted':''}" data-access-personal="${esc(r.key)}" aria-pressed="${personal}" ${!modifiable?'disabled':''}>${personal?'已追加':'未追加'}</button></td><td><span class="tag ${effective?'dark':''}">${effective?'可用':'无权限'}</span></td><td><span class="permission-source">${origin}</span></td></tr>`
 }).join('');
 const assignedRows=employed.map(id=>{const p=position(id);let locked=id==='developer'&&(!canChangeDeveloper()||employee.id==='E012');return `<button data-access-assign="${esc(id)}" ${!modifiable||locked?'disabled':''} title="${locked?'固定岗位':'点击移除此岗位'}"><b>${esc(p?.name||id)}</b><span>${locked?'固定':'×'}</span></button>`}).join('');
 const options=positions.filter(p=>!employed.includes(p.id)).map(p=>`<button type="button" data-access-assign="${esc(p.id)}" ${!modifiable||(p.id==='developer'&&!canChangeDeveloper())?'disabled':''}>${esc(p.name)}</button>`).join('');
 return `<div class="access-workbench">
  <section class="panel access-side"><div class="access-side-head"><h2>员工与岗位</h2></div><div class="access-content"><label class="access-field-label" for="perm-employee">选择员工</label>${setSelect('perm-employee',staff.map(p=>[p.id,`${p.name} · ${p.title}`]),selectedEmployee)}<div class="access-selected-user"><span class="avatar">${esc(employee.name.slice(-1))}</span><div><strong>${esc(employee.name)}</strong><small>${esc(employee.id)} · ${esc(employee.dept)}</small></div></div><h3>当前兼任岗位</h3><div class="access-assigned-list">${assignedRows||'<div class="small-note">尚未分配岗位</div>'}</div><details class="access-role-details" ${rolesExpanded?'open':''}><summary>增加或调整岗位</summary><div class="access-role-options">${options||'<span class="small-note">已拥有全部岗位</span>'}</div></details><div class="access-rights-count"><span>有效操作权限</span><div><strong>${count}</strong><span> / ${keys.length}</span></div></div></div></section>
  <section class="panel access-main"><div class="access-main-head"><h2>操作权限</h2><span>岗位权限 ∪ 个人权限</span></div><div class="access-tools"><label>正在编辑的岗位模板${setSelect('perm-position',positions.map(p=>[p.id,p.name]),selectedPosition)}</label><label>业务部门${setSelect('perm-dept',departments.map(d=>[d.id,d.name]),selectedDept)}</label></div><div class="access-description">修改「岗位模板」会影响该岗位全部员工；「个人追加」只影响 <b>${esc(employee.name)}</b>。${selectedJob?.id==='developer'?' 开发人员岗位拥有全部权限。':''}</div><div class="access-mobile-hint">向左滑动表格，查看个人授权与最终权限</div><div class="table-wrap"><table class="data-table access-table"><thead><tr><th>功能</th><th>操作</th><th>岗位：${esc(active?.name||'')}</th><th>个人追加</th><th>最终权限</th><th>来源</th></tr></thead><tbody>${rights||'<tr><td colspan="6">该部门没有可配置的功能</td></tr>'}</tbody></table></div><div class="access-footer-hint">一个员工可兼任多个岗位，最终权限为所有岗位权限与个人追加权限的并集。</div></section>
 </div>`;
}
function handleClick(el){if(!el||!canEdit())return false;
 const emp=el.dataset.accessAssign;if(emp)return toggleAssignment(selectedEmployee,emp);
 const rp=el.dataset.accessRole;if(rp)return togglePositionPermission(selectedPosition,rp);
 const personal=el.dataset.accessPersonal;if(personal)return togglePersonalPermission(selectedEmployee,personal);
 return false;
}
function reset(){state=fresh();save();selectedEmployee='E020';selectedPosition='production';selectedDept='production'}
window.FactoryAccess={init,positions,staff,capabilities,actionNames,person,assigned,own,position,has,hasFor,canEdit,current,switchCurrent,updateSelection,render,handleClick,reset,get selectedDept(){return selectedDept},get selectedEmployee(){return selectedEmployee}};
})();