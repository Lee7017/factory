/* 工厂业务工作台：前端可操作的单据状态、关联流程和操作记录。 */
(()=>{'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stages={draft:'草稿',review:'待评审',approved:'已评审',trial:'试算完成',formal:'正式排程',reserved:'物料已锁定',issued:'物料已发放',blending:'配制进行中',blend_clean:'配制完成·待清洗',semi_qc:'半成品待检',semi_ok:'半成品合格',packaging:'包装进行中',pack_clean:'包装完成·待清洗',final_qc:'成品待检',inspected:'成品检验合格',released:'质量已放行',stored:'成品已入库',dispatch:'待成品出库',shipping:'部分发货',shipped:'已发货',delivered:'客户已确认收货'};
const orderActions={submit:['提交评审','sales','orders','edit','draft','review'],review:['评审通过','sales','orderReview','approve','review','approved'],reject:['退回修改','sales','orderReview','approve','review','draft'],trial:['排程试算','pmc','schedule','edit','approved','trial'],formal:['发布正式排程','pmc','schedule','approve','trial','formal'],reserve:['确认齐套并锁库','pmc','kitting','execute','formal','reserved'],issue:['确认领料发料','warehouse','issue','execute','reserved','issued'],blendStart:['配制开工','production','tasks','execute','issued','blending'],blendFinish:['配制任务完成','production','tasks','execute','blending','blend_clean'],semiPass:['半成品检验合格','quality','qaQc','approve','semi_qc','semi_ok'],semiFail:['半成品不合格 / 返回配制','quality','qaQc','approve','semi_qc','blending'],packStart:['包装开工','production','tasks','execute','semi_ok','packaging'],packFinish:['包装任务完成','production','tasks','execute','packaging','pack_clean'],finalPass:['成品检验合格并放行','quality','qaQc','approve','final_qc','released'],finalFail:['成品不合格 / 返回包装','quality','qaQc','approve','final_qc','packaging'],receipt:['成品入库','warehouse','inventory','edit','released','stored'],notifyDelivery:['发起发货通知','sales','orders','edit','stored','dispatch'],confirmDelivery:['确认客户收货','sales','orders','edit','shipped','delivered']};
const featureActions={orders:['submit','notifyDelivery','confirmDelivery'],orderReview:['review','reject'],schedule:['trial','formal'],kitting:['reserve'],issue:['issue'],tasks:['blendStart','blendFinish','packStart','packFinish'],batch:['blendStart','blendFinish','packStart','packFinish'],inspection:['semiPass','semiFail','finalPass','finalFail'],release:[],inventory:['receipt']};
const nextWorkForStage={
 draft:{dept:'sales',feature:'orders'},
 review:{dept:'sales',feature:'orderReview'},
 approved:{dept:'pmc',feature:'schedule'},
 trial:{dept:'pmc',feature:'schedule'},
 formal:{dept:'pmc',feature:'kitting'},
 reserved:{dept:'warehouse',feature:'issue'},
 issued:{dept:'production',feature:'tasks'},
 blending:{dept:'production',feature:'tasks'},
 blend_clean:{dept:'production',feature:'tasks'},
 semi_qc:{dept:'quality',feature:'qaQc'},
 semi_ok:{dept:'production',feature:'tasks'},
 packaging:{dept:'production',feature:'tasks'},
 pack_clean:{dept:'production',feature:'tasks'},
 final_qc:{dept:'quality',feature:'qaQc'},
 released:{dept:'warehouse',feature:'inventory'},
 stored:{dept:'sales',feature:'orders'},
 dispatch:{dept:'warehouse',feature:'warehouseOutbound'},
 shipping:{dept:'warehouse',feature:'warehouseOutbound'},
 shipped:{dept:'sales',feature:'orders'},
 delivered:{dept:'sales',feature:'orderHistory'}
};
const catalogs={
 purchase:{title:'采购单',prefix:'PO',dept:'purchase',feature:'purchase',perm:'create',fields:[['material','采购物料','select',['RM-001','PK-001','AD-001','RM-002','PK-002']],['qty','采购数量','number'],['supplier','供应商','text']],columns:['物料编码','采购数量','供应商'],stages:['草稿','待审批','待到货','已入库'],actions:[['提交采购','草稿','待审批','create'],['审批通过','待审批','待到货','approve'],['审批驳回','待审批','草稿','approve']]},
 approvals:{title:'重大事项审批',prefix:'APR',dept:'leadership',feature:'approvals',perm:'approve',fields:[['subject','事项名称','text'],['owner','申请部门','text'],['reason','申请说明','text']],columns:['事项名称','申请部门','申请说明'],stages:['待复核','已通过','已驳回'],actions:[['审批通过','待复核','已通过','approve'],['驳回','待复核','已驳回','approve']]},
 finance:{title:'财务审核单',prefix:'FIN',dept:'finance',feature:'finance',perm:'approve',fields:[['subject','费用事项','text'],['amount','金额（元）','number'],['owner','所属部门','text']],columns:['费用事项','金额（元）','所属部门'],stages:['待确认','已核准','已退回'],actions:[['核准','待确认','已核准','approve'],['退回','待确认','已退回','approve']]}
};
let ctx, S, activeFeature='', openForm=null, currentRecord='', notice='', newIdSeq=0;
const bucketFor=type=>type==='purchase'?S.purchases:S[type];
const now=()=>new Date().toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
function init(context){ctx=context;const d=ctx.data;
 if(!d.ops||d.ops.version!==16){
  d.ops={version:16,flows:{},stock:{'RM-001':500,'PK-001':500,'AD-001':150,'RM-002':300,'PK-002':200},purchases:[{id:'PO-001',material:'PK-001',qty:250,supplier:'包材供应商',status:'待审批'}],approvals:[{id:'APR-001',subject:'敏感权限申请',owner:'信息化部',reason:'需总经办复核',status:'待复核'}],finance:[{id:'FIN-001',subject:'生产激励核算',amount:1200,owner:'财务部',status:'待确认'}],products:[{id:'FG-001',name:'720g/L 百菌清悬浮剂',category:'成品',spec:'5L × 4桶',unit:'桶'},{id:'SF-001',name:'百菌清配制半成品',category:'半成品',spec:'720g/L',unit:'L'}],bom:[{id:'BOM-01',parent:'SF-001',child:'RM-001',qty:.1,unit:'kg/L'},{id:'BOM-02',parent:'FG-001',child:'PK-001',qty:.25,unit:'个/L'}],templates:[{id:'TPL-SF-01',name:'配制工艺模板 A',version:'v2.1',kind:'配制',status:'已发布'},{id:'TPL-FG-01',name:'桶装包装模板',version:'v1.3',kind:'包装',status:'已发布'}],skills:{},roster:[{id:'SHIFT-001',slot:'配料',person:'E002',level:'L2',status:'已排班'},{id:'SHIFT-002',slot:'包装',person:'E003',level:'L2',status:'已排班'}],staffEdits:{},logs:[]};
 }
 S=d.ops;S.reservations??={};for(const o of d.orders||[])if(!S.flows[o.id])S.flows[o.id]={stage:o.status==='待评审'?'review':o.status==='草稿'?'draft':'approved',audit:[{at:now(),action:'订单记录导入',person:'系统'}]};
 // 旧数据已通过成品 QC、停在人工 QA 放行前的订单，按现行规则放行一次。
 for(const o of d.orders||[]){const f=S.flows[o.id];if(f?.stage!=='inspected')continue;
  f.stage='released';o.status=stages.released;
  (f.audit??=[]).push({at:now(),person:'系统',action:'历史成品检验合格并放行',from:'quality',to:'warehouse',state:stages.released});
 }
 for(const t of d.tasks||[])if(!t.audit)t.audit=[];
 const defaults={E002:{配料:'L2',清洗:'L2'},E003:{包装:'L2',灌装:'L2'},E004:{包装:'L3',调机调线:'L3'},E005:{配料:'L2',搅拌:'L2'},E008:{调机调线:'L3'}};
 for(const [id,vals] of Object.entries(defaults))S.skills[id]??={...vals};
 for(const p of ctx.access.staff){
  if(S.staffEdits[p.id])Object.assign(p,S.staffEdits[p.id]);
  // 兼容保存过的员工档案里的旧部门名称。
  if(p.dept==='工艺技术部'||p.dept==='信息化 / 主数据管理'||p.dept==='信息化部')p.dept='信息化部';
  if(p.dept==='EHS 安全环保部')p.dept='人事行政办公室';
 }
 ctx.save();
}
const current=()=>ctx.access.current().name;
function log(action,ref,detail=''){S.logs.unshift({at:now(),ts:Date.now(),person:current(),dept:ctx.data.dept,action,ref,detail});S.logs=S.logs.slice(0,120);ctx.save()}
function can(dept,feature,action='view'){return ctx.access.has(dept,feature,action)}
function flash(el){ctx.flashDenied(el)}
function warn(msg){const modalError=document.querySelector('#ops-form');if(modalError){let box=modalError.querySelector('.op-form-error');if(!box){box=document.createElement('div');box.className='op-form-error';box.setAttribute('role','alert');modalError.prepend(box)}box.textContent=msg;return}notice='';ctx.toast(msg);}
function showShortageDialog(o,shortages){
 const modules=window.FactoryModules;
 const rows=shortages.map(([material,required])=>{
  const available=Math.max(0,availableStock(material)-(modules?.blockedFromFlow(material)||0));
  return {material,required,available,missing:Math.max(0,required-available)};
 });
 const purchases=S.purchases.filter(p=>rows.some(x=>x.material===p.material));
 const purchaseInfo=purchases.length?`<div class="op-shortage-purchases"><h3>相关采购单</h3>${purchases.map(p=>{
  const receipts=window.FactoryProcurement?.shipments?.(p.id)||[];const receipt=receipts.find(r=>!['已驳回','不合格'].includes(r.status));
  return `<p><strong>${esc(p.id)}</strong><span>${esc(p.material)} · ${esc(p.status)}${receipt?` · 到货 ${esc(receipt.id)}（${esc(receipt.status)}）`:''}</span>${cmd('查看采购单','viewShortagePurchase',p.id)}</p>`;
 }).join('')}</div>`:'<p class="op-shortage-none">当前缺口还没有采购单，可以直接在这里生成，不用再创建采购需求。</p>';
 document.querySelector('#ops-modal-host').innerHTML=`<div class="op-modal-shade" data-op-action="close"></div><section class="op-modal op-shortage-modal" role="alertdialog" aria-modal="true" aria-labelledby="shortage-title" aria-describedby="shortage-description"><div class="op-modal-head"><h2 id="shortage-title">物料库存不足，暂不能锁库</h2>${cmd('关闭','close')}</div><p id="shortage-description" class="op-shortage-intro">订单 ${esc(o.id)} 的物料尚未齐套，请先核对采购与到货进度。</p><div class="op-shortage-table"><div class="op-shortage-labels"><span>物料编码</span><span>需求</span><span>可用</span><span>缺口</span></div>${rows.map(x=>`<div class="op-shortage-row"><strong>${esc(x.material)}</strong><span>${esc(x.required)}</span><span>${esc(x.available)}</span><strong class="op-shortage-missing">-${esc(x.missing)}</strong></div>`).join('')}</div>${purchaseInfo}<p class="op-shortage-hint">采购审批通过不等于库存增加。到货登记后直接进入 QC；QC 合格后由仓库确认入库。同一采购单允许按实际到货分批登记。</p><div class="op-shortage-actions">${cmd('关闭','close')}${cmd('生成／查看采购单','createPurchaseFromShortage',o.id,'primary')}</div></section>`;
}
function success(msg){notice='';ctx.save();ctx.render();ctx.toast(msg)}

function taskForOrder(order,type,create=false,phase='',newRun=false){
 const o=typeof order==='string'?ctx.data.orders.find(x=>x.id===order):order;
 if(!o)return null;
 const flow=S.flows[o.id]||{};
 const cleanPhase=type==='清洗'?(phase||(flow.stage==='pack_clean'?'包装':'配制')):'';
 const line=type==='清洗'&&cleanPhase==='包装'?(flow.packLine||'S03-4# 瓶装线'):
  type==='清洗'?(flow.planLine||'L01 配制一线'):(flow.packLine||'S03-4# 瓶装线');
 const linked=t=>t.type===type&&(t.orderId===o.id||t.order===o.id)&&
  (type!=='清洗'||t.cleanPhase===cleanPhase||(!t.cleanPhase&&cleanPhase==='配制'&&t.line===line));
 let task=ctx.data.tasks.find(t=>linked(t)&&(!newRun||t.status!=='已完成'));
 if(!task&&!newRun)task=ctx.data.tasks.find(linked);
 if(!task&&create&&type!=='清洗'){
  task=ctx.data.tasks.find(t=>t.type===type&&!t.orderId&&!t.order&&t.line===line&&t.status!=='已完成');
  if(task){task.orderId=o.id;if(type==='清洗')task.cleanPhase=cleanPhase;ctx.save()}
 }
 if(!task&&create){
  task={id:gen(type==='清洗'?'CLN':'SET'),type,line,orderId:o.id,status:'待开始',category:'非生产任务',audit:[]};
  if(type==='清洗')task.cleanPhase=cleanPhase;
  ctx.data.tasks.unshift(task);log('创建'+(cleanPhase||'')+type+'任务',task.id,o.id);
 }
 return task||null;
}
function showTaskGate(o,type,task){
 const cleanQc=type==='清洗'&&window.FactoryModules?.state?.rules?.cleanQC;
 const report=cleanQc?window.FactoryModules?.state?.cleanReports?.find(x=>x.task===task.id&&x.status==='待判定'):null;
 const note=report?'清洗报检 '+report.id+' 待 QC 判定':
  cleanQc&&task.status==='待复核'&&!window.FactoryModules?.hasCleaningPass?.(task.id)?'需提交清洗报检并取得 QC 合格结论':
  task.status==='待复核'?'待确认完工复核':task.status==='执行中'?'待执行结束并提交复核':'待开始执行';
 const next=report?{dept:'quality',feature:'qaCleanInspection',record:report.id}:
  {dept:type==='清洗'?'production':'engineering',feature:type==='清洗'?'tasks':'engineering',record:task.id};
 window.FactoryFlowUI?.openDocument({kind:'order',ref:o.id,docType:'销售订单',
  summary:o.product+' · '+o.spec+' · '+o.qty+' '+(o.unit||'L'),stage:stageOf(o),
  status:stageForOrder(o),history:S.flows[o.id]?.audit||[],
  blockedTask:{id:task.id,type,line:task.line,status:task.status,note,report:report?.id||''},
  nextOpen:next});
}
function trackCleanQc(taskId){
 const t=ctx.data.tasks.find(x=>x.id===taskId);
 if(!t||t.type!=='清洗'||t.status!=='待复核')return warn('清洗任务尚未提交复核');
 if(!can('production','tasks','execute'))return warn('当前员工没有清洗任务办理权限');
 const report=window.FactoryModules?.ensureCleaningReport?.(taskId);
 if(!report)return warn('清洗报检尚不能提交');
 ctx.save();
 window.FactoryNavigation?.trackBottleneck?.({dept:'quality',feature:'qaCleanInspection',record:report.id},report.id);
}
function stageOf(o){return S.flows[o.id]?.stage||'draft'}
function stepIndex(stage){return Object.keys(stages).indexOf(stage)}
// 开工前物料复查只使用正式发布时确认的开工日期，不读取甘特图自动生成的占位任务。
function plannedStartFromGantt(id){
 const dates=(S.gantt||[]).filter(x=>x.orderId===id&&x.type==='配制'&&/^\d{4}-\d{2}-\d{2}T/.test(String(x.start||''))).map(x=>String(x.start).slice(0,10)).sort();
 return dates[0]||null;
}
function dayBeforeStart(id){
 const start=S.flows?.[id]?.plannedStart;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(String(start||'')))return null;
 const day=new Date(start+'T12:00:00');
 if(!Number.isFinite(day.getTime()))return null;
 day.setDate(day.getDate()-1);
 return [day.getFullYear(),String(day.getMonth()+1).padStart(2,'0'),String(day.getDate()).padStart(2,'0')].join('-');
}
function materialShortages(order){
 return Object.entries(requirements(order)).map(([material,required])=>{
  const reserved=Number(S.reservations?.[order.id]?.[material]||0);
  const free=Math.max(0,availableStock(material)-(window.FactoryModules?.blockedFromFlow?.(material)||0));
  const available=free+reserved;
  return {material,required,available,missing:Math.max(0,required-available)};
 }).filter(x=>x.missing>0.00001);
}
function checkPrestartMaterials(){
 if(!ctx||!S||!Array.isArray(ctx.data.orders))return 0;
 const nowDate=new Date();
 const today=[nowDate.getFullYear(),String(nowDate.getMonth()+1).padStart(2,'0'),String(nowDate.getDate()).padStart(2,'0')].join('-');
 let count=0;
 for(const order of ctx.data.orders){
  const flow=S.flows?.[order.id];
  if(!flow||!['formal','reserved'].includes(flow.stage)||!flow.plannedStart)continue;
  const deadline=dayBeforeStart(order.id);
  if(!deadline||today<deadline)continue;
  const shortages=materialShortages(order);
  if(!shortages.length)continue;
  const detail=shortages.map(x=>x.material+' 缺 '+x.missing+'（需要 '+x.required+'，可用 '+x.available+'）').join('；');
  delete S.reservations?.[order.id];
  flow.stage='trial';order.status='待重新排程';
  (flow.audit??=[]).push({at:now(),person:'系统',action:'开工前一天物料不齐套，退回排程',from:'warehouse',to:'pmc',state:detail});
  (S.logs??=[]).unshift({at:now(),ts:Date.now(),person:'系统',dept:'pmc',action:'开工前一天物料不齐套，退回排程',ref:order.id,detail});
  count++;
 }
 if(count){S.logs=S.logs.slice(0,120);ctx.save();}
 return count;
}
function orderBy(id){return ctx.data.orders.find(x=>x.id===id)}
function requirements(o){const raw=S.bom.find(x=>x.child==='RM-001')?.qty??.1,pack=S.bom.find(x=>x.child==='PK-001')?.qty??.25;return {'RM-001':Math.ceil(o.qty*raw),'PK-001':Math.ceil(o.qty*pack)}}
function stageForOrder(o){return stages[stageOf(o)]||'未知状态'}
function reservedTotal(id){return Object.values(S.reservations||{}).reduce((sum,res)=>sum+Number(res[id]||0),0)}
function availableStock(id){return Math.max(0,(S.stock[id]||0)-reservedTotal(id))}
function recordTable(cols,rows,toolbar=''){return `<div class="op-table-wrap">${toolbar?`<div class="op-table-toolbar"><div class="op-tools">${toolbar}</div></div>`:''}<table class="op-table"><thead><tr>${cols.map(x=>`<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.join(''):`<tr><td colspan="${cols.length}" class="op-empty">暂无记录</td></tr>`}</tbody></table></div>`}

 // Shared order-list controls. Status facts fold independently from always-available filters.
 const orderPanelFolded=Object.create(null);
 function orderPanel({key,table,stats=[],toolbar='',statuses=[],item='销售订单',placeholder='搜索单号 / 产品'}){
  const folded=Boolean(orderPanelFolded[key]);
  const opts=[...new Set(statuses.filter(Boolean))];
  const count=(table.match(/class="biz-order-row"/g)||[]).length;
  return `<section class="biz-order-panel ${folded?'is-folded':''}" data-order-panel="${esc(key)}">
   <div class="biz-order-stats" id="biz-order-stats-${esc(key)}" ${folded?'hidden':''}>${stats.map(([label,num])=>`<div class="biz-order-stat"><span>${esc(label)}</span><strong>${Number(num)||0}</strong></div>`).join('')}</div>
   <div class="biz-order-toolbar">
    ${toolbar?`<div class="biz-order-create">${toolbar}</div>`:''}
    <input class="biz-order-search" type="search" placeholder="${esc(placeholder)}" aria-label="搜索${esc(item)}">
    <select class="biz-order-status" aria-label="${esc(item)}状态筛选"><option value="">状态：全部</option>${opts.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('')}</select>
    <button type="button" class="biz-order-fold" data-op-action="orderUi:fold" data-op-id="${esc(key)}" aria-expanded="${!folded}" aria-controls="biz-order-stats-${esc(key)}"><span class="biz-fold-arrow" aria-hidden="true">${folded?'⌄':'⌃'}</span><span>${folded?'展开状态统计':'收起状态统计'}</span></button>
   </div>
   <div class="biz-order-table-area">${table}</div>
   <div class="biz-order-footer">共 <strong class="biz-order-visible-count">${count}</strong> 条${esc(item)}</div>
  </section>`;
 }
 function filterOrderPanel(panel){
  if(!panel)return;
  const search=(panel.querySelector('.biz-order-search')?.value||'').trim().toLocaleLowerCase();
  const status=panel.querySelector('.biz-order-status')?.value||'';
  let visible=0;
  for(const row of panel.querySelectorAll('.biz-order-row')){
   const matches=(!search||(row.textContent||'').toLocaleLowerCase().includes(search))&&(!status||row.dataset.orderStatus===status);
   row.hidden=!matches;
   if(matches)visible++;
  }
  const count=panel.querySelector('.biz-order-visible-count');if(count)count.textContent=String(visible);
 }
 document.addEventListener('input',event=>{
  if(event.target instanceof Element&&event.target.matches('.biz-order-search'))filterOrderPanel(event.target.closest('.biz-order-panel'));
 });
 document.addEventListener('change',event=>{
  if(event.target instanceof Element&&event.target.matches('.biz-order-status'))filterOrderPanel(event.target.closest('.biz-order-panel'));
 });
 window.FactoryOrderListUI={panel:orderPanel,filter:filterOrderPanel};
 function salesOrderStats(){
  const all=ctx.data.orders||[];
  const count=keys=>all.filter(o=>keys.includes(stageOf(o))).length;
  return [
   ['待评审',count(['review'])],['待排程',count(['approved','trial'])],
   ['正式排程',count(['formal','reserved'])],
   ['生产中',count(['issued','blending','blend_clean','semi_qc','semi_ok','packaging','pack_clean','final_qc'])],
   ['已交付',count(['delivered'])]
  ];
 }
const td=x=>`<td>${x}</td>`;
function cmd(label,op,id='',style=''){return `<button type="button" class="op-button ${style}" data-op-action="${esc(op)}" data-op-id="${esc(id)}">${esc(label)}</button>`}
function badge(status){let done=/已通过|已完成|已入库|已核准|已关闭|已发布|合格|已放行/.test(status);return `<span class="op-badge ${done?'complete':''}">${esc(status)}</span>`}
function tip(text){return `<details class="business-help"><summary>操作规则</summary><p>${esc(text)}</p></details>`}
function shell(title,toolbar,content,tipText=''){
 return `<div class="ops-workbench">${toolbar?`<div class="op-inline-toolbar"><div class="op-tools">${toolbar}</div></div>`:''}${content}</div>`
}
function historyView(){const rows=S.logs.slice(0,5);return `<details class="op-history"><summary>最近操作记录 <span>${S.logs.length} 条</span></summary>${rows.length?rows.map(x=>`<div><time>${esc(x.at)}</time><strong>${esc(x.action)}</strong><span>${esc(x.ref)} · ${esc(x.person)}</span></div>`).join(''):'<p>尚无操作</p>'}</details>`}
function rowActions(o,which=''){const stage=stageOf(o);let list=Object.entries(orderActions).filter(([k,v])=>v[4]===stage&&(!which||(featureActions[which]||[]).includes(k)));return list.map(([key,meta])=>cmd(meta[0],`flow:${key}`,o.id,key==='reject'?'muted':'')).join('')}
function flowActionsFor(feature){const names={orders:'销售订单',orderReview:'销售订单评审',schedule:'APS 排程',kitting:'物料齐套核查',issue:'仓库发料与签收',tasks:'生产 / 非生产任务',batch:'生产批次卡',inspection:'报检进度',release:'QA 放行',inventory:'库存和入库'};
 const activeOrders=ctx.data.orders.filter(o=>stageOf(o)!=='delivered');
 const orderRows=(orders=activeOrders)=>orders.map(o=>{const stage=stageOf(o),r=requirements(o),available=Object.entries(r).map(([id,qty])=>`${id} 需 ${qty} / 可用 ${availableStock(id)}`).join('；');
  const actions=feature==='orders'?cmd('查看订单','detailFlow',o.id)+cmd('修改订单','editOrder',o.id)+rowActions(o,feature):feature==='kitting'?`${rowActions(o,feature)}<small class="op-inline-note">${esc(available)}</small>`:cmd('查看订单','detailFlow',o.id)+rowActions(o,feature);
  return `<tr class="biz-order-row" data-order-status="${esc(stageForOrder(o))}">${td(`<strong>${esc(o.id)}</strong>`)}${td(esc(o.product))}${td(`${esc(o.qty)} ${esc(o.unit||'L')}`)}${td(badge(stageForOrder(o)))}${td(`<div class="op-row-actions">${actions}</div>`)}</tr>`});
 const intro={orders:'订单必须有产品、规格和大于 0 的数量。创建保存后自动提交评审；评审通过后才能排程。',orderReview:'只有待评审订单可以通过或退回，评审结果决定 PMC 是否可以排程。',schedule:'只能对评审通过的订单试算；试算完成后发布正式排程，才能进行齐套和领料。',kitting:'根据 BOM 和库存核算缺口；缺料弹窗可直接生成并跟踪采购单，采购员在同一单据补充价格，仓库待 QC 合格入库后再锁库。',issue:'仅正式排程并锁定库存后可以发料，确认发料时实际扣减原料和包材库存。',tasks:'配制任务完成后清洗；包装任务开始前调机调线、完成后清洗。清洗需要执行、QC（启用时）与复核。',batch:'批次任务跟随订单的配制和包装阶段，填写、提交和报检会推动同一订单流程。',inspection:'检验判定统一在质量部 → 报检判定办理。成品检验合格自动放行，不合格退回包装返工。',release:'成品检验合格即自动放行，可在此查看订单状态；不再需要单独点击放行。',inventory:'可调整库存数量；成品必须通过质量放行才能入库。'}[feature]||'';
 const orderToolbar=feature==='orders'?cmd('新建销售订单','newOrder','','primary'):'';
 const stockToolbar=feature==='inventory'?cmd('库存调整','adjustStock','','primary'):'';
 const taskToolbar=feature==='tasks'?cmd('新增非生产任务','newTask','','primary'):'';
 const stock=feature==='inventory'?recordTable(['物料编码','库存数量','单位','操作'],Object.keys(S.stock).map(id=>`<tr>${td(esc(id))}${td(`<strong>${esc(S.stock[id])}</strong>`)}${td(id==='FG-001'?'箱':id.startsWith('PK-')?'个':id.startsWith('SF-')?'L':'kg')}${td(cmd('调整','adjustStock',id))}</tr>`)):'';
 const flow=feature==='kitting'
  ?recordTable(['订单号','产品','数量','流程状态','齐套核查','操作'],activeOrders.map(o=>{const r=requirements(o),available=Object.entries(r).map(([id,qty])=>`${id} 需 ${qty} / 可用 ${availableStock(id)}`).join('；');return `<tr class="biz-order-row" data-order-status="${esc(stageForOrder(o))}">${td(`<strong>${esc(o.id)}</strong>`)}${td(esc(o.product))}${td(`${esc(o.qty)} ${esc(o.unit||'L')}`)}${td(badge(stageForOrder(o)))}${td(`<small class="op-inline-note">${esc(available)}</small>`)}${td(`<div class="op-row-actions">${rowActions(o,feature)||'<span class="op-muted">—</span>'}</div>`)}</tr>`}))
  :recordTable(['订单号','产品','数量','流程状态','当前操作'],orderRows());
 const tasks=feature==='tasks'?taskRows(taskToolbar):'';
 if(feature==='inventory'){
  const pending=activeOrders.filter(o=>stageOf(o)==='released');
  const receipt=recordTable(['订单号','产品','数量','流程状态','当前操作'],orderRows(pending));
  return shell(names[feature],'',`<section class="op-subsection"><header><h3>当前库存</h3><div class="op-tools">${stockToolbar}</div></header>${stock}</section><section class="op-subsection"><header><h3>待入库生产订单</h3></header>${receipt}</section>`,intro);
 }
 if(feature==='tasks'){
  return shell(names[feature],'',`${tasks}${orderPanel({key:feature,table:flow,stats:salesOrderStats(),statuses:activeOrders.map(stageForOrder),item:'关联销售订单'})}`,intro);
 }
 if(feature==='batch'){
  const productionStages=new Set(['issued','blending','blend_clean','semi_qc','semi_ok','packaging','pack_clean','final_qc','released','stored']);
  const rows=activeOrders.filter(o=>productionStages.has(stageOf(o))).map(o=>{const audit=S.flows[o.id]?.audit||[],last=audit[audit.length-1];
   return `<tr class="biz-order-row" data-order-status="${esc(stageForOrder(o))}">${td(`<strong>${esc(o.id)}</strong>`)}${td(esc(o.product))}${td(badge(stageForOrder(o)))}${td(esc(last?.action||'—'))}${td(esc(last?.at||'—'))}${td(`<div class="op-row-actions">${cmd('查看订单','detailFlow',o.id)}${rowActions(o,feature)}</div>`)}</tr>`});
  return shell(names[feature],'',orderPanel({key:feature,table:recordTable(['订单号','产品','当前阶段','最近记录','记录时间','操作'],rows),stats:salesOrderStats(),statuses:activeOrders.filter(o=>productionStages.has(stageOf(o))).map(stageForOrder),item:'关联销售订单'}),intro);
 }
 return shell(names[feature],'',orderPanel({key:feature,table:flow,stats:salesOrderStats(),toolbar:orderToolbar,statuses:activeOrders.map(stageForOrder),item:'销售订单'}),intro);
}

function taskRows(toolbar=''){
 const tasks=ctx.data.tasks.filter(t=>['清洗','调机调线','设备点检'].includes(t.type))
  .sort((a,b)=>(a.status==='已完成'?1:0)-(b.status==='已完成'?1:0));
 const rows=tasks.map(t=>`<tr class="${t.status==='已完成'?'':'op-task-pending'}" data-task-row="${esc(t.id)}">
  ${td(`<strong>${esc(t.id)}</strong>`)}${td(esc(t.type==='清洗'&&t.cleanPhase?t.cleanPhase+'线清洗':t.type))}${td(esc(t.line))}
  ${td(esc(t.orderId||t.order||'—'))}${td(badge(t.status))}
  ${td(`<div class="op-row-actions">${taskButtons(t)}</div>`)}
 </tr>`);
 return `<section class="op-subsection op-task-inbox" aria-label="清洗与调机任务待办">
  <header><div><h3>清洗与调机 · 当前待办</h3><small class="op-task-help">配制完成后清洗；包装开工前调机调线、完成后清洗。清洗执行、QC（启用时）及复核都在这里办理。</small></div>
   ${toolbar?`<div class="op-tools">${toolbar}</div>`:''}</header>
  ${recordTable(['任务号','类型','产线','关联订单','状态','立即办理'],rows)}
 </section>`;
}
function taskButtons(t){
 const needsQc=t.type==='清洗'&&window.FactoryModules?.state?.rules?.cleanQC;
 const passed=needsQc&&window.FactoryModules?.hasCleaningPass?.(t.id);
 const pending=needsQc&&window.FactoryModules?.state?.cleanReports?.some(r=>r.task===t.id&&r.status==='待判定');
 if(t.status==='待复核'&&needsQc&&!passed)return cmd(pending?'跟踪清洗报检':'提交清洗报检','task:qc',t.id,'primary');
 const mode=t.status==='待开始'?'start':t.status==='执行中'?'finish':t.status==='待复核'?'verify':null;
 return mode?cmd({start:'开始执行',finish:'提交复核',verify:'确认复核'}[mode],`task:${mode}`,t.id,'primary'):'<span class="op-muted">已闭环</span>';
}
function historyOrderPage(){const rows=ctx.data.orders.filter(o=>stageOf(o)==='delivered').map(o=>{const audit=S.flows[o.id]?.audit||[],last=audit[audit.length-1];return `<tr class="biz-order-row" data-order-status="已交付">${td(`<strong>${esc(o.id)}</strong>`)}${td(esc(o.product))}${td(`${esc(o.qty)} ${esc(o.unit||'L')}`)}${td(esc(o.completedAt||last?.at||'—'))}${td(badge('已完成'))}${td(cmd('查看订单','detailFlow',o.id))}</tr>`});return shell('历史订单','',orderPanel({key:'orderHistory',table:recordTable(['订单号','产品','数量','完成时间','状态','操作'],rows),stats:salesOrderStats(),statuses:['已交付'],item:'历史销售订单'}),'客户交付确认后的订单才会归档。成品入库不是订单完成，仍需销售发货通知、仓库出库和客户收货确认。')}
function purchasePage(){return genericPage('purchase',S.purchases)}
function genericPage(type,list){const cfg=catalogs[type], cols=['单号',...cfg.columns,'状态','操作'],toolbar=cmd('新建'+cfg.title,`new:${type}`,'','primary');return shell(cfg.title,'',recordTable(cols,list.map(r=>`<tr>${td(`<strong>${esc(r.id)}</strong>`)}${cfg.fields.map(([k])=>td(esc(r[k]))).join('')}${td(badge(r.status))}${td(`<div class="op-row-actions">${type==='purchase'&&r.status!=='草稿'?'':cmd('编辑',`edit:${type}`,r.id)}${cfg.actions.filter(a=>a[1]===r.status).map(a=>cmd(a[0],`next:${type}:${a[2]}`,r.id)).join('')}</div>`)}</tr>`),toolbar),type==='purchase'?'采购单由采购模块统一办理；仓库到货只在“采购到货”页面登记。':'单据状态及操作记录会被保留.')}
function maintenancePage(){return shell('设备与调机调线','',taskRows(cmd('新增设备任务','newTask','','primary')))}
function catalogPage(){return shell('产品与物料主数据','',recordTable(['编码','名称','类别','规格','单位','操作'],S.products.map(p=>`<tr>${td(`<strong>${esc(p.id)}</strong>`)}${td(esc(p.name))}${td(esc(p.category))}${td(esc(p.spec))}${td(esc(p.unit))}${td(cmd('编辑', 'edit:product',p.id))}</tr>`),cmd('新增物料','new:product','','primary')),'产品与物料先建档，BOM 才能关联。修改已有编码时只编辑名称、规格、类别和单位，不覆盖历史订单.')}
function bomPage(){return shell('BOM 物料关联','',recordTable(['关联编号','父项','子项','单位用量','单位','操作'],S.bom.map(x=>`<tr>${td(esc(x.id))}${td(esc(x.parent))}${td(esc(x.child))}${td(esc(x.qty))}${td(esc(x.unit))}${td(cmd('编辑','edit:bom',x.id))}</tr>`),cmd('新增关联','new:bom','','primary')),'用量必须大于 0，父项不能等于子项。RM-001 / PK-001 用量直接参与 PMC 齐套计算.')}
function templatePage(){return shell('受控工艺模板','',recordTable(['模板编号','模板名称','版本','类型','状态','操作'],S.templates.map(x=>`<tr>${td(esc(x.id))}${td(esc(x.name))}${td(esc(x.version))}${td(esc(x.kind))}${td(badge(x.status))}${td(`<div class="op-row-actions">${cmd('复制新版本','copy:template',x.id)}${x.status==='草稿'?cmd('编辑','edit:template',x.id)+cmd('发布','publish:template',x.id):''}</div>`)}</tr>`),cmd('新建草稿','new:template','','primary')),'已发布的模板不可直接改写，只能复制形成新版本草稿，再审批发布.')}
function skillPage(){const persons=ctx.access.staff.filter(p=>p.dept==='生产车间');const skillNames=['配料','搅拌','灌装','包装','清洗','调机调线'];return shell('员工技能矩阵','',recordTable(['员工 / 岗位',...skillNames,'操作'],persons.map(p=>`<tr>${td(`<strong>${esc(p.name)}</strong><small class="op-inline-note">${esc(p.title)}</small>`)}${skillNames.map(s=>td(badge(S.skills[p.id]?.[s]||'L0'))).join('')}${td(cmd('调整技能','edit:skill',p.id))}</tr>`)),'L0 未培训，L1 训练中，L2 独立作业，L3 可带教。排班需至少 L2；修改技能等级会立即影响排班校验。')}
function employeePage(){return shell('员工基础档案','',recordTable(['工号','姓名','所属部门','岗位','联系电话','操作'],ctx.access.staff.map(p=>`<tr>${td(esc(p.id))}${td(`<strong>${esc(p.name)}</strong>`)}${td(esc(p.dept))}${td(esc(p.title))}${td(esc(S.staffEdits[p.id]?.phone||'—'))}${td(cmd('编辑档案','edit:staff',p.id))}</tr>`)),'员工与岗位权限分开：这里维护基础资料，权限由信息化部门的权限矩阵管理。')}
function rosterPage(){return shell('生产线排班','',recordTable(['班次号','工作岗位','员工','技能等级','状态','操作'],S.roster.map(s=>`<tr>${td(esc(s.id))}${td(esc(s.slot))}${td(esc(ctx.access.staff.find(x=>x.id===s.person)?.name||'未分配'))}${td(badge(s.level))}${td(badge(s.status))}${td(cmd('调整人员','edit:shift',s.id))}</tr>`),cmd('新增排班','new:shift','','primary')),'每个员工同一班次只允许一个工位，技能等级不足 L2 时不允许排班.')}
function payrollPage(feature){let rows=ctx.data.payroll;if(feature==='incentive')rows=rows.filter(r=>r.type==='生产激励');const toolbar=feature==='incentive'?cmd('提报生产激励','new:pay:生产激励','','primary'):ctx.data.dept==='finance'?'':cmd('申请加班','new:pay:加班','','primary')+cmd('提报生产激励','new:pay:生产激励');const action=p=>ctx.data.dept==='hr'&&p.status==='待人事复核'?cmd('人事审核','pay:hr',p.id):ctx.data.dept==='finance'&&p.status==='待财务核准'?cmd('财务核准','pay:finance',p.id):'<span class="op-muted">—</span>';return shell(feature==='incentive'?'生产激励提报':'加班费与激励工资','',recordTable(['单据编号','员工','类型','核算依据','状态','操作'],rows.map(p=>`<tr>${td(`<strong>${esc(p.id)}</strong>`)}${td(esc(p.name))}${td(esc(p.type))}${td(esc(p.basis))}${td(badge(p.status))}${td(`<div class="op-row-actions">${action(p)}</div>`)}</tr>`),toolbar),'加班与生产激励分开记录：员工提报 → 人事复核 → 财务核准；不同操作受岗位或个人权限控制.')}
function opsOverview(){const rows=ctx.data.orders.filter(o=>stageOf(o)!=='delivered').map(o=>`<tr>${td(`<strong>${esc(o.id)}</strong>`)}${td(esc(o.product))}${td(badge(stageForOrder(o)))}${td(cmd('查看订单','detailFlow',o.id))}</tr>`);return shell('订单到交付流程','',recordTable(['订单号','产品','进度','操作'],rows,cmd('前往销售订单','go:sales:orders')), '订单从评审到排产、生产、质检、入库，再到销售通知发货、仓库出库与客户确认收货；只有交付确认后才归档.')}
function render(feature){activeFeature=feature;switch(feature){case 'orders':case 'orderReview':case 'schedule':case 'kitting':case 'issue':case 'tasks':case 'batch':case 'inspection':case 'release':case 'inventory':return flowActionsFor(feature);case 'orderHistory':return historyOrderPage();case 'purchase':return purchasePage();case 'catalog':return catalogPage();case 'bom':return bomPage();case 'templates':return templatePage();case 'skills':return skillPage();case 'employees':return employeePage();case 'shift':return rosterPage();case 'engineering':return maintenancePage();case 'finance':case 'approvals':return genericPage(feature,S[feature]);case 'payroll':case 'incentive':return payrollPage(feature);case 'overview':return opsOverview();default:return shell(feature,'','<div class="op-empty">尚未配置业务表单</div>')}}
function modal(title,fields,submit,confirmLabel='保存'){const host=document.querySelector('#ops-modal-host');host.innerHTML=`<div class="op-modal-shade" data-op-action="close"></div><div class="op-modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="op-modal-head"><h2>${esc(title)}</h2>${cmd('关闭','close')}</div><form id="ops-form"><div class="op-form-grid">${fields}</div><div class="op-modal-actions">${cmd('取消','close')}<button type="submit" class="op-button primary">${esc(confirmLabel)}</button></div></form></div>`;openForm=submit;}
function field(name,label,type='text',value='',choices=[]){const id='of-'+name;const content=type==='select'?`<select name="${esc(name)}" id="${id}" required>${choices.map(v=>`<option value="${esc(v)}" ${String(v)===String(value)?'selected':''}>${esc(v)}</option>`).join('')}</select>`:`<input name="${esc(name)}" id="${id}" type="${esc(type)}" value="${esc(value)}" ${type==='number'?(name==='delta'?'step="any"':'min="0.000001" step="any"'):''} ${name==='phone'?'':'required'}>`;return `<label class="op-field"><span>${esc(label)}</span>${content}</label>`}
function close(){const host=document.querySelector('#ops-modal-host');host.innerHTML='';openForm=null;currentRecord=''}
function inspectFlow(id){
 const o=orderBy(id);if(!o)return;
 const stage=stageOf(o),type=['blend_clean','pack_clean'].includes(stage)?'清洗':stage==='semi_ok'?'调机调线':null;
 const task=type?taskForOrder(o,type,true,stage==='pack_clean'?'包装':'配制'):null;
 const record=window.FactoryModules?.state?.inspections?.find(r=>r.order===o.id&&r.status==='待判定'&&r.phase===(stage==='semi_qc'?'半成品':'成品'));
 const target=task&&task.status!=='已完成'?{dept:type==='清洗'?'production':'engineering',feature:type==='清洗'?'tasks':'engineering',record:task.id}:
  record&&['semi_qc','final_qc'].includes(stage)?{dept:'quality',feature:'qaQc',record:record.id}:nextWorkForStage[stage];
 window.FactoryFlowUI?.openDocument({kind:'order',ref:o.id,docType:'销售订单',
  summary:`${o.product} · ${o.spec} · ${o.qty} ${o.unit||'L'}`,
  stage,status:stageForOrder(o),history:S.flows[o.id]?.audit||[],nextOpen:target});
}
function applyFlow(key,id,button){const o=orderBy(id),step=orderActions[key];if(!o||!step)return;const [label,dept,feature,permission,expected,next]=step;
 if(!can(dept,feature,permission))return flash(button);
 if(stageOf(o)!==expected)return warn(`${id} 当前是「${stageForOrder(o)}」，不满足「${label}」的前置状态。`);
 if(['semiPass','finalPass'].includes(key)&&window.FactoryModules&&!window.FactoryModules.hasFlowInspection(id,key==='semiPass'?'半成品':'成品'))return warn('这一步必须先完成质量判定。请进入「质量部 QA / QC → 报检判定」，找到这张订单对应的半成品/成品报检单并判定；也可以从“查看订单 → 质量报检”直接进入。');
 if(key==='reserve'){const shortages=Object.entries(requirements(o)).filter(([m,qty])=>Math.max(0,availableStock(m)-(window.FactoryModules?.blockedFromFlow(m)||0))<qty);if(shortages.length)return showShortageDialog(o,shortages);S.reservations[id]=requirements(o)}
 if(key==='packStart'){
  const type='调机调线',task=taskForOrder(o,type,true);
  if(!task||task.status!=='已完成')return showTaskGate(o,type,task);
 }
 if(key==='issue'){
  const reserved=S.reservations[id]||requirements(o);
  if(Object.entries(reserved).some(([m,n])=>(S.stock[m]||0)<n))return warn('预留物料的现存库存不足，请先核查库存调整与出入库记录。');
  for(const [m,n] of Object.entries(reserved))S.stock[m]-=n;
  delete S.reservations[id];
 }
 if(key==='receipt'){const m=String(o.spec||'').match(/([\d.]+)\s*L\s*[×xX*]\s*(\d+)/),perCase=m?Number(m[1])*Number(m[2]):20,qty=Math.ceil(Number(o.qty||0)/Math.max(perCase,0.000001));if(window.FactoryModules?.receiveFinishedGoods)window.FactoryModules.receiveFinishedGoods(o,qty);else {const stockId=String(o.product||'').includes('500g/L')?'FG-002':'FG-001';S.stock[stockId]=(S.stock[stockId]||0)+qty}}
 if(key==='notifyDelivery'&&!window.FactoryModules?.state?.batches?.some(b=>b.order===id&&b.source==='生产入库'))return warn('尚未找到该订单的成品入库批次，不能发起发货通知。');
 if(key==='confirmDelivery'){const shipments=window.FactoryModules?.state?.outbound?.filter(x=>x.order===id&&x.status==='已出库')||[];if(!shipments.length)return warn('仓库尚未确认出库，不能确认客户收货。')}
 if(key==='formal'){
  S.flows[id].planLine=S.flows[id].planLine||'L01 配制一线';
  // 发布正式排程即确认计划开工日；不以物料齐套作为发布条件。
  S.flows[id].plannedStart=plannedStartFromGantt(id);
  S.flows[id].planPublishedAt=now();
}
 S.flows[id].stage=next;
 const prerequisite=next==='blend_clean'?taskForOrder(o,'清洗',true,'配制',true):next==='pack_clean'?taskForOrder(o,'清洗',true,'包装',true):next==='semi_ok'?taskForOrder(o,'调机调线',true):null;
 let generatedInspection=null;
 if(next==='semi_qc'||next==='final_qc')generatedInspection=window.FactoryModules?.ensureFlowInspection?.(id,next==='semi_qc'?'半成品':'成品')||null;
 o.status=({draft:'草稿',review:'待评审',approved:'待排产',trial:'试算完成',formal:'已排程',reserved:'已锁库',issued:'已发料'})[next]||stages[next];if(next==='delivered'&&!o.completedAt)o.completedAt=now();
 const route={draft:'sales',review:'sales',approved:'pmc',trial:'pmc',formal:'pmc',reserved:'warehouse',issued:'production',blending:'production',semi_qc:'quality',semi_ok:'production',packaging:'production',final_qc:'quality',released:'warehouse',stored:'sales',dispatch:'warehouse',shipping:'warehouse',shipped:'sales',delivered:'sales'};
 const from=route[expected]||dept,to=route[next]||dept;
 S.flows[id].audit.push({at:now(),person:current(),action:label,from,to,state:stages[next]});log(label,id,`${expected} → ${next}`);success(`${id}：${label}，当前状态 ${stages[next]}`);
 window.FactoryFlowUI?.show({ref:id,docType:'销售订单',summary:`${o.product} · ${o.spec} · ${o.qty} ${o.unit||'L'}`,action:label,from,to,status:stages[next],next:(generatedInspection?`质量部 QA/QC → 报检判定 · ${generatedInspection.id}`:({'approved':'排程试算','trial':'发布正式排程','formal':'物料齐套 / 锁库','reserved':'仓库发料','issued':'配制开工','blending':'配制任务完成','blend_clean':'配制线清洗执行与复核','semi_qc':'质量部 QA/QC → 报检判定','semi_ok':'调机调线复核及包装','packaging':'包装任务完成','pack_clean':'包装线清洗执行与复核','final_qc':'质量部 QA/QC → 报检判定','released':'成品入库','stored':'由销售部发起发货通知','dispatch':'仓库按订单批次出库','shipping':'仓库继续出库剩余数量','shipped':'销售确认客户实际收货','delivered':'客户交付完成，订单归档','review':'销售订单评审'})[next]||'查看单据当前状态'),operator:current(),at:now(),open:{dept:'sales',feature:'orders'},nextOpen:generatedInspection?{dept:'quality',feature:'qaQc',action:'qualityRecord',record:generatedInspection.id}:
   prerequisite?{dept:prerequisite.type==='清洗'?'production':'engineering',feature:prerequisite.type==='清洗'?'tasks':'engineering',record:prerequisite.id}:nextWorkForStage[next],history:S.flows[id].audit.map(h=>({...h,from:h.from||(h.action==='订单记录导入'?'sales':undefined)}))});
}
function applyTask(mode,id,button){let task=ctx.data.tasks.find(t=>t.id===id);if(!task)return;const dept=task.type==='调机调线'?'engineering':'production',feat=dept==='engineering'?'engineering':'tasks';if(!can(dept,feat,'execute'))return flash(button);const map={start:['待开始','执行中','任务开工'],finish:['执行中','待复核','提交完工复核'],verify:['待复核','已完成','复核完成']};const [from,to,label]=map[mode]||[];if(task.status!==from)return warn(`任务 ${id} 当前状态为${task.status}，不能${label}`);
 if(mode==='verify'&&task.type==='清洗'&&window.FactoryModules?.state?.rules?.cleanQC&&!window.FactoryModules.hasCleaningPass(id))return trackCleanQc(id);
 task.status=to;log(label,id,task.type);
 let progressed=false;
 if(mode==='verify'&&task.orderId&&S.flows[task.orderId]){
  const flow=S.flows[task.orderId],stage=flow.stage,phase=task.cleanPhase||(stage==='pack_clean'?'包装':'配制');
  const expected=phase==='包装'?'pack_clean':'blend_clean',next=phase==='包装'?'final_qc':'semi_qc';
  if(task.type==='清洗'&&stage===expected&&taskForOrder(task.orderId,'清洗',false,phase)?.id===task.id){
   flow.stage=next;
   const order=orderBy(task.orderId);
   if(order)order.status=stages[next];
   const inspection=window.FactoryModules?.ensureFlowInspection?.(task.orderId,phase==='包装'?'成品':'半成品');
   flow.audit??=[];
   flow.audit.push({at:now(),person:current(),action:phase+'线清洗执行与复核',from:'production',to:'quality',state:id+' · 已完成'});
   log(phase+'线清洗后转检验',task.orderId,inspection?.id||id);
   progressed=true;
  }else if(task.type==='调机调线'){
   flow.audit??=[];
   flow.audit.push({at:now(),person:current(),action:'调机调线任务复核完成',from:dept,to:'production',state:id+' · 已完成'});
  }
 }
 success(`任务 ${id} ${to}`);
 if(mode==='verify'&&task.orderId){inspectFlow(task.orderId);return}
 const sourceDept=dept,target=task.type==='清洗'&&mode==='finish'?'quality':dept;
 window.FactoryFlowUI?.show({ref:id,docType:`${task.type}任务单`,summary:`${task.line} · ${task.category||'任务'}`,action:`${task.type} · ${label}`,from:sourceDept,to:target,status:to,next:task.type==='清洗'&&mode==='finish'?'QA/QC 清洗报检':to==='待复核'?'任务复核确认':to==='已完成'?'继续后续生产任务':'按任务标准执行',operator:current(),at:now(),open:{dept:dept,feature:feat},nextOpen:task.type==='清洗'&&mode==='finish'?{dept:'quality',feature:'qaCleanInspection'}:to==='已完成'?{dept:'production',feature:'tasks'}:{dept,feature:feat},history:(S.logs||[]).filter(x=>x.ref===id).slice(0,5).reverse().map(x=>({at:x.at,from:x.dept||dept,action:x.action}))});
} 
function applyGeneric(type,next,id,button){if(type==='purchase')return warn('采购单必须按 PMC 需求、采购主管、财务及总经办的规则审批。');const cfg=catalogs[type],r=bucketFor(type)?.find(x=>x.id===id);if(!cfg||!r)return;const match=cfg.actions.find(a=>a[2]===next&&a[1]===r.status);if(!match)return warn('单据状态已变化，不能重复执行此操作');if(!can(cfg.dept,cfg.feature,match[3]))return flash(button);r.status=next;log(match[0],id);success(`${id} 已更新为 ${next}`);
 window.FactoryFlowUI?.show({ref:id,docType:type==='purchase'?'采购单':cfg.title||'业务单据',summary:type==='purchase'?`${r.material} · ${r.qty} · ${r.supplier||''}`:'',action:match[0],from:cfg.dept,to:type==='purchase'&&next==='待到货'?'warehouse':cfg.dept,status:next,next:type==='purchase'&&next==='待到货'?'采购到货登记、来料报检':'继续办理单据',operator:current(),at:now(),open:{dept:cfg.dept,feature:cfg.feature},nextOpen:type==='purchase'&&next==='待到货'?{dept:'warehouse',feature:'warehouseIncoming',action:'purchaseReceipt',record:id}:{dept:cfg.dept,feature:cfg.feature},history:(S.logs||[]).filter(x=>x.ref===id).slice(0,5).reverse().map(x=>({at:x.at,from:x.dept,action:x.action}))});
} 
function openEdit(type,id){currentRecord=id||'';let cfg=catalogs[type];if(type==='product')cfg={title:'物料',fields:[['name','物料名称','text'],['category','物料类别','select',['成品','半成品','原料','辅料','包材','耗材','备件','其他']],['spec','规格','text'],['unit','单位','text']]};
 if(type==='bom')cfg={title:'BOM 关联',fields:[['parent','父项编码','text'],['child','子项编码','text'],['qty','单位用量','number'],['unit','用量单位','text']]};
 if(type==='template')cfg={title:'工艺模板草稿',fields:[['name','模板名称','text'],['version','版本号','text'],['kind','任务类型','select',['配制','包装']]]};
 if(type==='shift')cfg={title:'工位排班',fields:[['slot','岗位工位','select',['配料','搅拌','灌装','包装','清洗','调机调线']],['person','员工','select',ctx.access.staff.filter(p=>p.dept==='生产车间').map(p=>p.id)]]};
 if(type==='staff')cfg={title:'员工档案',fields:[['title','岗位名称','text'],['dept','所在部门','select',[...new Set(ctx.access.staff.map(p=>p.dept))]],['phone','联系电话','tel']]};
 if(type==='skill')cfg={title:'技能等级',fields:[['skill','技能项目','select',['配料','搅拌','灌装','包装','清洗','调机调线']],['level','评定等级','select',['L0','L1','L2','L3']]]};
 if(type==='pay'){cfg={title:'工资申请',fields:[['name','员工姓名','text'],['basis','核算依据 / 数量','text']]};}
 if(!cfg)return;
 const bucket=type==='product'?S.products:type==='bom'?S.bom:type==='template'?S.templates:type==='shift'?S.roster:type==='staff'?ctx.access.staff:type==='skill'?ctx.access.staff:type==='pay'?ctx.data.payroll:bucketFor(type);
 const rec=bucket?.find(x=>x.id===id)||{};
 const inputs=cfg.fields.map(([k,label,kind,choices])=>field(k,label,kind||'text',rec[k]??(k==='qty'?1:k==='phone'?'':k==='level'?'L2':k==='person'?'E002':choices?.[0]||''),choices||[])).join('');
 modal(`${id?'编辑':'新建'}${cfg.title}${id?' · '+id:''}`,inputs,{type,id,kind:'save'},'保存记录');
}
function commitForm(values){const state=openForm;if(!state)return;let {type,id}=state, obj={...values};if(type==='purchase')return warn('采购单只能在采购业务页面按 PMC 需求创建。');
 if(type==='order'){
  const product=String(values.product||'').trim(),spec=String(values.spec||'').trim(),qty=Number(values.qty);
  if(!product||!spec||!(qty>0))return warn('订单产品、规格、数量必须填写，且数量要大于 0。');
  let record=id?orderBy(id):null;
  if(record&&['draft','review'].includes(stageOf(record))){
   Object.assign(record,{product,spec,qty});
   // 兼容旧版尚处草稿的订单：保存后也直接送审。
   if(stageOf(record)==='draft'){
    S.flows[record.id].stage='review';record.status='待评审';
    S.flows[record.id].audit??=[];
    S.flows[record.id].audit.push({at:now(),person:current(),action:'提交评审',from:'sales',to:'sales',state:'待评审'});
   }
  }else if(!id){
   const idNew=gen('SO');
   record={id:idNew,product,spec,qty,unit:'L',status:'待评审',owner:'销售部'};
   ctx.data.orders.unshift(record);
   S.flows[idNew]={stage:'review',audit:[
    {at:now(),person:current(),action:'接收订单并提交评审',from:'sales',to:'sales',state:'待评审'}
   ]};
  }else return warn('已进入生产流程的订单不能直接修改，可新建版本。');
  log(id?'修改销售订单':'创建销售订单并自动提交评审',record.id);
  close();return success(id?'订单已保存，状态为待评审。':'订单创建成功，已自动提交评审，等待销售部评审。');
 }
 if(type==='task'){
  const typ=values.type,line=String(values.line||'').trim();if(!line)return;let idNew=gen('TK');ctx.data.tasks.push({id:idNew,type:typ,line,status:'待开始',category:'非生产任务',audit:[]});log('新建非生产任务',idNew);close();return success(`任务 ${idNew} 已建立`);
 }
 if(type==='stock'){
  const material=values.material,delta=Number(values.delta);if(!Number.isFinite(delta)||delta===0)return warn('调整数量不能为 0');if((S.stock[material]||0)+delta<reservedTotal(material))return warn('调整后库存不能低于已经锁定给正式排程的数量。');S.stock[material]=(S.stock[material]||0)+delta;log('库存调整',material,`${delta>0?'+':''}${delta}；原因：${values.reason}`);close();return success(`库存 ${material} 已调整`);
 }
 if(type==='pay'){
  const paytype=state.paytype, name=String(values.name||'').trim(),basis=String(values.basis||'').trim();if(!name||!basis)return warn('请填写姓名和核算依据');let newId=gen(paytype==='加班'?'OT':'IN');ctx.data.payroll.unshift({id:newId,name,type:paytype,basis,status:'待人事复核',amount:'—'});log('申请'+paytype,newId);close();return success('已提交待人事复核');
 }
 if(type==='skill'){
  S.skills[id]??={};S.skills[id][values.skill]=values.level;log('技能等级评定',id,`${values.skill}=${values.level}`);close();return success('技能等级已更新');
 }
 if(type==='staff'){
  const person=ctx.access.staff.find(p=>p.id===id);if(!person)return;Object.assign(person,{title:values.title,dept:values.dept});S.staffEdits[id]={title:values.title,dept:values.dept,phone:values.phone};log('更新员工档案',id);close();return success('员工档案已更新');
 }
 if(type==='shift'){
  let selected=ctx.access.staff.find(p=>p.id===values.person);if(!selected)return warn('没有找到员工');let level=S.skills[selected.id]?.[values.slot]||'L0';if(Number(level.slice(1))<2)return warn(`${selected.name} 的「${values.slot}」技能只有 ${level}，不满足独立上岗的 L2 要求。`);
  if(S.roster.some(x=>x.person===selected.id&&x.id!==id))return warn(`${selected.name} 已在其他岗位排班，不能同一班次重复安排。`);
  let r=id?S.roster.find(x=>x.id===id):null;if(r)Object.assign(r,{slot:values.slot,person:values.person,level,status:'已排班'});else {id=gen('SHIFT');S.roster.push({id,slot:values.slot,person:values.person,level,status:'已排班'})}log('更新排班',id);close();return success('排班已保存');
 }
 if(type==='bom'){
  let qty=Number(values.qty);if(!(qty>0))return warn('BOM 单位用量必须大于 0');if(values.parent===values.child)return warn('父项与子项不能相同');obj.qty=qty;
 }
 if(type==='purchase'&&id&&S.purchases.some(p=>p.id===id&&p.status!=='草稿'))return warn('已提交的采购单不允许直接改写；需要另外建立新单。');
 if(type==='purchase'){let qty=Number(values.qty);if(!(qty>0))return warn('采购数量必须大于 0');obj.qty=qty;}
 if(type==='finance'){let amount=Number(values.amount);if(!(amount>0))return warn('金额必须大于 0');obj.amount=amount;}
 let bucket=type==='product'?S.products:type==='bom'?S.bom:type==='template'?S.templates:bucketFor(type);if(!bucket)return;
 let existing=id?bucket.find(x=>x.id===id):null;
 if(type==='template'&&existing&&existing.status==='已发布')return warn('已发布模板不允许直接修改，请先复制新版本。');
 if(existing)Object.assign(existing,obj);
 else{const prefix={product:'MAT',bom:'BOM',template:'TPL',purchase:'PO',approvals:'APR',finance:'FIN'}[type]||'REC';id=gen(prefix);bucket.unshift({id,...obj,status:type==='template'?'草稿':type==='purchase'?'草稿':type==='approvals'?'待复核':'待确认'});}
 log(id&&existing?'修改单据':'新建单据',id);close();success('保存成功');
}
function gen(prefix){newIdSeq+=1;return `${prefix}-${String(Date.now()).slice(-5)}-${String(newIdSeq).padStart(2,'0')}`}
function handleClick(button){const action=button.dataset.opAction||'',id=button.dataset.opId||'';
 if(action==='orderUi:fold'){
  const panel=button.closest('.biz-order-panel');if(!panel)return true;
  const folded=panel.classList.toggle('is-folded');orderPanelFolded[id]=folded;
  const stats=panel.querySelector('.biz-order-stats');if(stats)stats.hidden=folded;
  button.setAttribute('aria-expanded',String(!folded));
  const arrow=button.querySelector('.biz-fold-arrow');if(arrow)arrow.textContent=folded?'⌄':'⌃';
  const label=button.querySelector('.biz-fold-arrow + span');if(label)label.textContent=folded?'展开状态统计':'收起状态统计';
  return true;
 }
 if(action==='close'){close();return true}
 if(action==='detailFlow'){inspectFlow(id);return true}
 if(action==='qaRecord'){close();window.FactoryModules?.openQualityRecord?.(id);return true}
 if(action.startsWith('go:')){const [,d,f]=action.split(':');close();ctx.openFeature(f,d,button);return true}
 if(action.startsWith('flow:')){applyFlow(action.split(':')[1],id,button);return true}
 if(action==='receivePurchase'){window.FactoryModules?.startPurchaseReceipt?.(id);return true}
 if(action==='trackShortage'){window.FactoryProcurement?.trackShortage?.(id);return true}
 if(action==='createPurchaseFromShortage'){window.FactoryProcurement?.createFromShortage?.(id);return true}
 if(action==='viewShortagePurchase'){document.querySelector('#ops-modal-host')?.replaceChildren();window.FactoryProcurement?.openPurchase?.(id);return true}
 if(action==='task:qc'){trackCleanQc(id);return true}
 if(action.startsWith('task:')){applyTask(action.split(':')[1],id,button);return true}
 if(action.startsWith('next:')){const [,type,to]=action.split(':');applyGeneric(type,to,id,button);return true}
 if(action.startsWith('new:pay:')){
  const paytype=action.split(':')[2],feat=paytype==='生产激励'?'incentive':'payroll',department=paytype==='生产激励'?'production':'hr';if(!can(department,feat,'create'))return flash(button),true;
  modal(`新建${paytype}申请`,field('name','申请员工','text',ctx.access.current().name)+field('basis','核算依据','text',paytype==='加班'?'2 小时':'合格数量 100 单位'),{type:'pay',paytype},'提交申请');return true;
 }
 if(action.startsWith('new:')||action.startsWith('edit:')){
  const [verb,type]=action.split(':');const special={product:['it','catalog','edit'],bom:['it','bom','edit'],template:['it','templates','edit'],staff:['it','employees','edit'],skill:['hr','skills','edit'],shift:['pmc','shift','edit'],purchase:['purchase','purchase','create'],approvals:['leadership','approvals','approve'],finance:['finance','finance','approve']};
  const check=special[type];if(type==='skill'&&!can('hr','skills','edit')&&!can('production','skills','edit'))return flash(button),true;
  if(type==='product'&&!can('it','catalog','edit')&&!can('it','catalog','edit'))return flash(button),true;
  if(type==='shift'&&!can('pmc','shift','edit')&&!can('production','shift','edit'))return flash(button),true;
  if(check&&!['skill','product','shift'].includes(type)&&!can(...check))return flash(button),true;
  openEdit(type,verb==='edit'?id:'');return true;
 }
 if(action==='newOrder'||action==='editOrder'){
  if(!can('sales','orders',action==='newOrder'?'create':'edit'))return flash(button),true;
  const o=orderBy(id);if(o&&!['draft','review'].includes(stageOf(o)))return warn('订单已进入生产流程，不能直接修改，可另建订单。'),true;
  modal(o?'编辑销售订单':'新建销售订单',field('product','产品名称','text',o?.product||'720g/L 百菌清悬浮剂')+field('spec','规格','text',o?.spec||'5L × 4桶')+field('qty','计划数量（L）','number',o?.qty||1000),{type:'order',id},o?'保存修改':'创建并提交评审');return true;
 }
 if(action==='newTask'){
  if(!can('production','tasks','execute')&&!can('engineering','engineering','execute'))return flash(button),true;
  modal('新建非生产任务',field('type','任务类型','select','清洗',['清洗','调机调线','设备点检'])+field('line','执行产线','text','L01 配制一线'),{type:'task'},'创建工单');return true;
 }
 if(action==='adjustStock'){
  if(!can('warehouse','inventory','edit'))return flash(button),true;
  modal('库存调整',field('material','物料编码','select',id||'RM-001',Object.keys(S.stock))+field('delta','增减数量（正数入库，负数出库）','number',1)+field('reason','调整原因','text','盘点差异'),{type:'stock'},'确认调整');return true;
 }
 if(action.startsWith('pay:')){
  const step=action.split(':')[1],p=ctx.data.payroll.find(x=>x.id===id);if(!p)return true;
  const dept=step==='hr'?'hr':'finance',feat=step==='hr'?'payroll':'finance';if(!can(dept,feat,'approve'))return flash(button),true;
  if(step==='hr'&&p.status==='待人事复核')p.status='待财务核准';else if(step==='finance'&&p.status==='待财务核准')p.status='已核准';else return warn('此单据当前状态不能执行该审批操作'),true;
  log(step==='hr'?'人事复核':'财务核准',id);success('工资审批状态已更新');return true;
 }
 if(action.startsWith('copy:template')){if(!can('it','templates','edit'))return flash(button),true;const t=S.templates.find(x=>x.id===id);if(!t)return true;let nu=gen('TPL');S.templates.unshift({...t,id:nu,version:t.version+'-新',status:'草稿'});log('复制模板新版本',nu);success('新版本已生成草稿');return true;}
 if(action==='publish:template'){if(!can('it','templates','approve'))return flash(button),true;const t=S.templates.find(x=>x.id===id);if(t?.status!=='草稿')return warn('只有草稿可以发布'),true;t.status='已发布';log('发布工艺模板',id);success('模板已发布');return true;}
 return false;
}
function submitForm(ev){if(ev.target.id!=='ops-form')return false;ev.preventDefault();const values=Object.fromEntries(new FormData(ev.target).entries());commitForm(values);return true;}
function pendingForDept(dept){const out=[];const push=(o,feature,title,desc)=>out.push({kind:'ops',feature,id:o.id,title,detail:desc,status:stageForOrder(o)});
 const match={sales:['review','orderReview','待评审订单'],pmc:['approved','schedule','等待排程'],warehouse:['reserved','issue','待发料'],quality:['semi_qc','qaQc','半成品报检待判定'],production:['issued','tasks','待生产']};
 for(const o of ctx.data.orders){const stage=stageOf(o);if(dept==='pmc'&&stage==='formal')push(o,'kitting','待齐套锁库',o.product);else if(dept==='quality'&&stage==='final_qc')push(o,'qaQc','成品报检待判定',o.product);else if(dept==='warehouse'&&stage==='released')push(o,'inventory','待成品入库',o.product);else if(dept==='warehouse'&&['dispatch','shipping'].includes(stage))push(o,'warehouseOutbound','待成品出库',o.product);else if(dept==='sales'&&stage==='stored')push(o,'orders','待发货通知',o.product);else if(dept==='sales'&&stage==='shipped')push(o,'orders','待客户收货确认',o.product);else if(dept==='production'&&['blending','blend_clean','semi_ok','packaging','pack_clean'].includes(stage))push(o,'tasks','生产任务待执行',o.product);else if(match[dept]?.[0]===stage)push(o,match[dept][1],match[dept][2],o.product);}
 if(dept==='purchase'){for(const p of S.purchases.filter(p=>!['已入库'].includes(p.status)))out.push({kind:'ops',feature:'purchase',id:p.id,title:'采购单待处理',detail:p.material,status:p.status});for(const p of S.purchases.filter(p=>p.status==='待采购填写'))out.push({kind:'ops',feature:'purchase',id:p.id,title:'采购员待完善采购单',detail:p.material,status:p.status})}
 if(dept==='production'||dept==='engineering')for(const t of ctx.data.tasks.filter(t=>t.status!=='已完成'&&(dept==='production'?t.type==='清洗':t.type==='调机调线')))
  out.push({kind:'ops',feature:dept==='production'?'tasks':'engineering',id:t.id,title:t.type+'工单 · '+t.id,detail:(t.orderId||t.line)+' · 待办',status:t.status});
 if(dept==='pmc')for(const p of S.purchases.filter(p=>p.status==='待PMC确认'))out.push({kind:'ops',feature:'kitting',id:p.id,title:'采购单待 PMC 主管确认',detail:p.material,status:p.status});
 if(dept==='finance')for(const p of S.purchases.filter(p=>p.status==='待财务审核'))out.push({kind:'ops',feature:'finance',id:p.id,title:'采购预算待审核',detail:p.supplier,status:p.status});
 if(dept==='leadership')for(const p of S.purchases.filter(p=>p.status==='待总经办审批'))out.push({kind:'ops',feature:'approvals',id:p.id,title:'采购单待总经办审批',detail:p.supplier,status:p.status});
 if(dept==='leadership')for(const p of S.approvals.filter(p=>p.status==='待复核'))out.push({kind:'ops',feature:'approvals',id:p.id,title:'审批事项待处理',detail:p.subject,status:p.status});
 return out;
}
function openTodo(item){ctx.openFeature(item.feature,item.dept);setTimeout(()=>{const row=document.querySelector(`[data-op-id="${CSS.escape(item.id)}"]`);if(row){row.closest('tr')?.scrollIntoView({block:'center',behavior:'smooth'});row.closest('tr')?.classList.add('op-focus');setTimeout(()=>row.closest('tr')?.classList.remove('op-focus'),2000)}},0)}
window.FactoryOperations={init,render,handleClick,submitForm,pendingForDept,openTodo,taskGateForOrder:(id,type)=>taskForOrder(id,type,false),checkPrestartMaterials,plannedStartFromGantt,materialShortages,getOrder:id=>ctx?.data?.orders?.find(o=>o.id===id)||null,get state(){return S},getStages:()=>({...stages})};
})();