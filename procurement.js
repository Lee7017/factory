/* 采购与仓库到货共用单据：采购提交/主管审批、仓库按批次收货、质量判定、入库。 */
(()=>{'use strict';
const O=window.FactoryOperations,M=window.FactoryModules;
if(!O||!M)return;
let ctx=null, focusPurchase='';
const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
const money=n=>Number(n||0).toLocaleString('zh-CN',{maximumFractionDigits:3});
const id=prefix=>`${prefix}-${Date.now().toString().slice(-7)}-${Math.floor(Math.random()*900+100)}`;
const day=()=>new Date().toISOString().slice(0,10);
const user=()=>ctx.access.current();
const orders=()=>O.state.purchases;
const arrivals=()=>M.state.incoming;
const activeReceipt=r=>!['已驳回','不合格'].includes(r.status);
const shipments=po=>arrivals().filter(r=>r.purchase===po);
const numbers=po=>{
 const rows=shipments(po.id).filter(activeReceipt),ordered=Number(po.qty)||0;
 const registered=rows.reduce((t,r)=>t+(Number(r.actualQty??r.qty)||0),0);
 const stored=rows.filter(r=>r.status==='已入库').reduce((t,r)=>t+(Number(r.actualQty??r.qty)||0),0);
 return {ordered,registered,stored,remaining:Math.max(0,ordered-registered),receipts:shipments(po.id)};
};
const available=()=>orders().filter(p=>['待到货','部分到货','到货处理中'].includes(p.status)&&numbers(p).remaining>0.00001);
const button=(text,action,record='',style='')=>`<button type="button" class="proc-btn ${style}" data-proc-action="${esc(action)}" data-proc-id="${esc(record)}">${esc(text)}</button>`;
const tag=s=>`<span class="proc-status ${['已入库','已通过','合格待入库'].includes(s)?'is-done':''}">${esc(s)}</span>`;
const authorized=cap=>ctx.access.has(...cap);
const isDeveloper=()=>ctx.access.isDeveloper?.()===true;

const requests=()=>O.state.purchaseRequests??(O.state.purchaseRequests=[]);
const rules=()=>O.state.procurementPolicy??(O.state.procurementPolicy={
 financeLimit:10000,leadershipLimit:100000,budgetLimit:null,approvedSuppliers:[]
});
const fmt=()=>new Date().toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
const audit=(record,action,from,person=user().name)=>{(record.history??=[]).push({action,from,person,at:fmt()})};
const validNumber=n=>Number.isFinite(Number(n))&&Number(n)>0;
const approvedSpend=(exclude='')=>orders().filter(p=>p.id!==exclude&&['待到货','到货处理中','部分到货','已入库'].includes(p.status)&&Number.isFinite(Number(p.totalAmount))&&String(p.approvedAt||p.submittedAt||'').startsWith(String(new Date().getFullYear()))).reduce((n,p)=>n+Number(p.totalAmount),0);
function approvalPlan(p){
 const rule=rules(),total=Number(p.totalAmount),budget=rule.budgetLimit===null?null:Number(rule.budgetLimit);
 const overBudget=budget!==null&&approvedSpend(p.id)+total>budget+0.000001;
 const newSupplier=!rule.approvedSuppliers.includes(String(p.supplier||'').trim());
 const finance=budget===null||overBudget||total>=rule.financeLimit;
 const leadership=overBudget||newSupplier||Boolean(p.urgent)||total>=rule.leadershipLimit;
 return {finance,leadership,overBudget,newSupplier,budgetUnset:budget===null,financeLimit:rule.financeLimit,leadershipLimit:rule.leadershipLimit};
}
const canPmcReview=r=>r?.status==='待PMC确认'&&authorized(['pmc','kitting','approve'])&&(isDeveloper()||(r.createdBy&&r.createdBy!==user().id));
const canPurchaseApprove=p=>p?.status==='待采购主管审批'&&p.purchaseId&&p.pmcConfirmedAt&&validNumber(p.totalAmount)&&authorized(['purchase','purchase','approve'])&&(isDeveloper()||p.purchaseId!==user().id);
const canDepartmentApprove=(p,dept)=>p?.status===(dept==='finance'?'待财务审核':'待总经办审批')&&authorized(dept==='finance'?['finance','finance','approve']:['leadership','approvals','approve'])&&(isDeveloper()||(p.createdBy&&p.createdBy!==user().id&&p.approvedId!==user().id&&p.financeId!==user().id));
function pmcQueue(){
 const items=orders().filter(p=>p.status==='待PMC确认');if(!items.length)return '';
 const rows=items.map(p=>`<tr class="biz-order-row"><td><strong>${esc(p.id)}</strong></td><td>${esc(p.material)}</td><td>${money(p.qty)}</td><td>${tag(p.status)}</td><td><div class="proc-actions">${button('查看采购单','viewPurchase',p.id)}${canPmcReview(p)?button('确认采购单','approvePmcPurchase',p.id,'primary')+button('退回','rejectPmcPurchase',p.id):''}</div></td></tr>`).join('');
 return `<section class="proc-page proc-pmc-inbox"><div class="mw-data-section"><div class="mw-data-section-head"><div><strong>待 PMC 确认的采购单</strong><span>仅人工补货需要主管确认；系统已校验的订单缺料无需重复审核</span></div></div><div class="op-table-wrap"><table class="op-table"><thead><tr><th>采购单号</th><th>物料</th><th>数量</th><th>状态</th><th>办理</th></tr></thead><tbody>${rows}</tbody></table></div></div></section>`;
}
function newDirectPurchase(){
 if(!authorized(['pmc','kitting','execute']))return error('当前员工没有 PMC 创建权限');
 const items=[...new Set([...(O.state.bom||[]).map(r=>r.child),...Object.keys(O.state.stock||{})])];
 modal('直接新建补货采购单',`<label class="proc-field"><span>采购物料</span><select name="material" required>${items.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('')}</select></label>${field('数量','qty',10,'number')}${field('需用日期','neededBy',day(),'date')}${field('采购原因','reason','安全库存补货')}`,'','directPo');
}
function renderApprovals(dept){
 const finance=dept==='finance',stage=finance?'待财务审核':'待总经办审批',canReview=authorized(finance?['finance','finance','approve']:['leadership','approvals','approve']);
 const items=orders().filter(p=>p.status===stage);
 const rows=items.map(p=>{
  const can=canDepartmentApprove(p,dept),plan=p.approvalPlan||approvalPlan(p);
  const actions=button('查看采购单','viewPurchase',p.id)+(can?button('审批通过',finance?'approveFinance':'approveLeadership',p.id,'primary')+button('驳回',finance?'rejectFinance':'rejectLeadership',p.id):'');
  return `<tr class="biz-order-row"><td><strong>${esc(p.id)}</strong></td><td>${esc(p.sourceOrder||'日常补货')}</td><td>${esc(p.supplier)}</td><td>¥${money(p.totalAmount)}</td><td>${esc([plan.overBudget?'超预算':'',plan.budgetUnset?'未配置预算':'',plan.newSupplier?'未列入合格供应商':'',p.urgent?'紧急采购':''].filter(Boolean).join('；')||'金额触发')}</td><td><div class="proc-actions">${actions}</div></td></tr>`;
 }).join('');
 const rule=rules(),budget=rule.budgetLimit===null?'未配置':'¥'+money(rule.budgetLimit);
 const settings=finance?'':`<div class="proc-policy-line"><span>财务审核门槛：¥${money(rule.financeLimit)}　·　总经办审批门槛：¥${money(rule.leadershipLimit)}　·　采购预算：${budget}　·　合格供应商：${esc(rule.approvedSuppliers.join('、')||'未配置')}</span>${canReview?button('维护审批规则','editPolicy'):''}</div>`;
 return `<section class="proc-page proc-linked-panel" aria-label="${finance?'财务采购审核':'总经办采购审批'}"><div class="mw-data-section"><div class="mw-data-section-head"><div><strong>${finance?'采购预算审核':'采购总经办审批'}</strong><span>${finance?'核对金额、预算、供应商与异常原因；不得由采购单创建人办理':'高金额、超预算、新供应商或紧急采购才需此级审核'}</span></div></div>${settings}<div class="op-table-wrap"><table class="op-table"><thead><tr><th>采购单号</th><th>采购来源</th><th>供应商</th><th>采购总额</th><th>审核原因</th><th>办理</th></tr></thead><tbody>${rows||'<tr><td colspan="6">当前没有需要本部门审核的采购单</td></tr>'}</tbody></table></div></div></section>`;
}
function newPolicy(){
 if(!authorized(['leadership','approvals','approve']))return error('采购审批规则仅总经办可维护');
 const p=rules();
 modal('采购审批规则',`${field('财务审批金额门槛（元）','financeLimit',p.financeLimit,'number')}${field('总经办审批金额门槛（元）','leadershipLimit',p.leadershipLimit,'number')}<label class="proc-field"><span>本年度采购预算（元；留空表示未配置）</span><input type="number" min="0" step="0.01" name="budgetLimit" value="${p.budgetLimit===null?'':esc(p.budgetLimit)}"></label><label class="proc-field"><span>合格供应商名单（每行一个）</span><textarea name="approvedSuppliers" rows="4">${esc(p.approvedSuppliers.join('\n'))}</textarea></label><p class="proc-form-info">下列金额为演示默认值，须由企业管理层按授权制度设置。未配置预算时全部采购单进入财务审核；新供应商、超预算、高金额及紧急采购进入总经办审批。</p>`,'','policy');
}
// 按部门权限和每张单据的创建人、审批人做分离校验。
const canApprove=canPurchaseApprove;
const canEdit=p=>Boolean(p)&&['待采购填写','草稿','已驳回'].includes(p.status)&&authorized(['purchase','purchase','edit']);
function syncStatus(p){
 if(!p||!['待到货','部分到货','到货处理中','已入库'].includes(p.status))return;
 const n=numbers(p);
 p.status=n.stored>=n.ordered&&n.ordered>0?'已入库':n.stored>0?'部分到货':n.registered>0?'到货处理中':'待到货';
}
function migrate(){
 // 新版本不读取或迁移旧到货流程数据；当前工作区只按新状态机计算。
 rules();requests();
 for(const p of orders()){p.qty=Number(p.qty)||0;
  if(p.status==='待审批')p.status=p.requestId?'待采购主管审批':'待补采购需求';
  const old=requests().find(r=>r.id===p.requestId);
  if(old?.status==='已确认'&&!p.pmcConfirmedAt){p.pmcConfirmedAt=p.submittedAt||new Date().toISOString();p.pmcConfirmedBy=old.reviewedBy||'原 PMC 主管'}
  if(p.status==='待采购主管审批'&&!p.purchaseId)p.purchaseId=p.createdBy||'历史采购员';
  if(old){p.sourceOrder??=old.sourceOrder;p.reason??=old.reason;p.neededBy??=old.neededBy}
  if(['待到货','部分到货','到货处理中','已入库'].includes(p.status))syncStatus(p);
 }
 // Convert historical PR-only records to POs, retaining original audit; each old PR converts at most once.
 for(const r of requests()){
  if(orders().some(p=>p.requestId===r.id||p.legacyRequestId===r.id))continue;
  orders().unshift({id:id('PO'),legacyRequestId:r.id,material:r.material,qty:Number(r.qty)||0,
   sourceOrder:r.sourceOrder||'',reason:r.reason||'',neededBy:r.neededBy||day(),
   status:r.status==='已确认'?'待采购填写':r.status==='已驳回'?'已驳回':'待PMC确认',
   createdBy:r.createdBy,createdName:r.createdName,
   pmcConfirmedAt:r.status==='已确认'?new Date().toISOString():'',
   pmcConfirmedBy:r.reviewedBy||'',history:[...(r.history||[])]});
 }
 ctx.save();
}
// 采购单是独立于销售订单的主单，收货作为同一采购单下的执行明细。
function renderPurchases(){
 const all=orders(), statuses=[
  ['待采购完善',all.filter(p=>['待采购填写','待补采购需求'].includes(p.status)).length],
  ['审批中',all.filter(p=>['待PMC确认','待采购主管审批','待财务审核','待总经办审批'].includes(p.status)).length],
  ['待到货',all.filter(p=>p.status==='待到货').length],
  ['到货处理中',all.filter(p=>['到货处理中','部分到货'].includes(p.status)).length],
  ['已入库',all.filter(p=>p.status==='已入库').length]
 ];
 const rows=all.map(p=>{
  const n=numbers(p),plan=p.approvalPlan;
  let actions=button('查看采购单','viewPurchase',p.id);
  if(canEdit(p))actions+=button('完善采购单','editPurchase',p.id);
  if(canApprove(p))actions+=button('审批通过','approve',p.id,'primary')+button('驳回','reject',p.id);
  const reason=plan?[plan.budgetUnset?'预算未配置':'',plan.overBudget?'超预算':'',plan.newSupplier?'新供应商':''].filter(Boolean).join(' · '):'';
  const receiptNote=n.receipts.length?`${n.receipts.length} 次到货记录`:'尚未到货';
  return `<tr class="biz-order-row proc-order-row" data-order-status="${esc(p.status)}">
   <td><strong>${esc(p.id)}</strong><small class="proc-sub">来源 ${esc(p.sourceOrder||'日常补货')}</small></td>
   <td><strong>${esc(p.material)}</strong></td>
   <td>${money(p.qty)}</td>
   <td>${esc(p.supplier||'—')}</td>
   <td>¥${money(p.unitPrice)}<small class="proc-sub">采购总额 ¥${money(p.totalAmount)}</small></td>
   <td>${tag(p.status)}${reason?`<small class="proc-sub">${esc(reason)}</small>`:''}</td>
   <td><strong>${money(n.stored)} / ${money(n.ordered)}</strong><small class="proc-sub">${esc(receiptNote)}</small></td>
   <td><div class="proc-actions">${actions}</div></td>
  </tr>`;
 }).join('');
 const options=[...new Set(all.map(p=>p.status).filter(Boolean))].map(status=>`<option value="${esc(status)}">${esc(status)}</option>`).join('');
 const create='';
 const guidance='';
 return `<section class="proc-page proc-purchase-board" aria-label="采购单独立工作台" data-proc-purchase-board>
   <header class="proc-board-heading">
    <div><small>采购 / 供应链部</small><h2>采购单</h2><p>PMC 缺料即生成采购单；采购员完善原单，审批、到货、质检和入库记录全部归在同一单号下。</p></div>
    ${create}
   </header>
   <div class="proc-board-metrics" aria-label="采购业务状态统计">${statuses.map(([label,value])=>`<div class="proc-board-metric"><span>${esc(label)}</span><strong>${value}</strong></div>`).join('')}</div>
   <div class="proc-board-content">
    <div class="proc-board-title"><h3>采购单列表</h3><span>PMC 缺料直接生成采购单；采购员在原单上补供应商、价格和交期</span></div>
    <div class="proc-board-filters">
      <input type="search" class="proc-order-search" placeholder="搜索采购单号 / 需求单 / 物料 / 供应商" aria-label="搜索采购单">
      <select class="proc-order-status" aria-label="采购单状态筛选"><option value="">全部状态</option>${options}</select>
    </div>
    <div class="proc-order-grid"><table class="proc-order-table">
     <thead><tr><th>采购单号 / 需求</th><th>采购物料</th><th>数量</th><th>供应商</th><th>单价 / 总额</th><th>审批状态</th><th>已入库 / 采购量</th><th>操作</th></tr></thead>
     <tbody>${rows||'<tr><td colspan="8" class="proc-board-empty">暂无采购单，请先完成 PMC 采购需求确认。</td></tr>'}</tbody>
    </table></div>
    <footer class="proc-board-footer">共 <strong class="proc-order-count">${all.length}</strong> 条采购单</footer>
   </div>${guidance}
  </section>`;
}
function filterPurchases(){
 const board=document.querySelector('.proc-purchase-board');if(!board)return;
 const q=(board.querySelector('.proc-order-search')?.value||'').trim().toLocaleLowerCase(),
 status=board.querySelector('.proc-order-status')?.value||'';
 let count=0;
 for(const row of board.querySelectorAll('.proc-order-row')){
  const show=(!q||row.textContent.toLocaleLowerCase().includes(q))&&(!status||row.dataset.orderStatus===status);
  row.hidden=!show;if(show)count++;
 }
 const tally=board.querySelector('.proc-order-count');if(tally)tally.textContent=String(count);
}

function renderIncoming(){
 const canReceive=authorized(['warehouse','warehouseOps','create']);
 const canStore=authorized(['warehouse','warehouseOps','execute']);
 const poRows=available().map(p=>{
  const n=numbers(p);
  return `<tr><td><strong>${esc(p.id)}</strong></td><td>${esc(p.material)}</td><td>${money(p.qty)}</td><td>${money(n.registered)}</td><td><strong>${money(n.remaining)}</strong></td><td>${canReceive?button('登记本次到货','newReceipt',p.id,'primary'):'<span class="proc-muted">等待仓库收货</span>'}</td></tr>`;
 }).join('');
 const received=arrivals().map(r=>{
  const qc=M.state.inspections.find(i=>i.incoming===r.id);
  const action=button('查看到货单','viewReceipt',r.id);
  let next='';
  if(r.status==='待QC')next=button('查看检验单','showInspection',r.id);
  if(canStore&&r.status==='合格待入库')next=button('确认入库','storeReceipt',r.id,'primary');
  return `<tr><td><strong>${esc(r.id)}</strong></td><td>${esc(r.purchase)}</td><td>${esc(r.material)} · ${money(r.actualQty??r.qty)}</td><td>${esc(r.supplierLot||'—')}</td><td>${tag(r.status)}${qc?`<small class="proc-sub">${esc(qc.id)} · ${esc(qc.status)}</small>`:''}</td><td><div class="proc-actions">${action}${next}</div></td></tr>`;
 }).join('');
 return {tools:'',
 content:`<div class="proc-page"><section class="mw-data-section"><div class="mw-data-section-head"><div><strong>可登记到货的采购单</strong><span>剩余数量实时扣除已登记的在途 / 待检数量</span></div><div class="mw-actions">${available().length&&canReceive?button('登记到货','newReceipt','','primary'):''}</div></div><div class="mw-table-scroll"><table class="mw-table"><thead><tr><th>采购单</th><th>物料</th><th>采购数量</th><th>已登记</th><th>可登记</th><th>操作</th></tr></thead><tbody>${poRows||'<tr><td colspan="6" class="mw-empty">暂无可登记的采购单。等待采购主管、财务或总经办完成必要审批。</td></tr>'}</tbody></table></div></section><section class="mw-data-section"><div class="mw-data-section-head"><div><strong>到货记录</strong><span>每次到货都是独立单据，可以查看和追踪</span></div></div><div class="mw-table-scroll"><table class="mw-table"><thead><tr><th>到货单</th><th>采购单</th><th>物料 / 实收</th><th>供应商批次</th><th>状态 / 质检</th><th>操作</th></tr></thead><tbody>${received||'<tr><td colspan="6" class="mw-empty">暂无到货记录</td></tr>'}</tbody></table></div></section></div>`};
}
function host(){let h=document.getElementById('proc-modal-host');if(!h){h=document.createElement('div');h.id='proc-modal-host';document.body.append(h)}return h;}
const close=()=>{host().innerHTML='';focusPurchase=''};
function modal(title,contents,actions='',formType='',record=''){
 host().innerHTML=`<div class="proc-overlay" data-proc-action="close"></div><section class="proc-modal" role="dialog" aria-modal="true" aria-labelledby="proc-title"><header><h2 id="proc-title">${esc(title)}</h2>${button('关闭','close')}</header>${formType?`<form id="proc-form" data-kind="${esc(formType)}" data-record="${esc(record)}"><div class="proc-fields">${contents}</div><p class="proc-error" role="alert"></p><footer>${button('取消','close')}<button type="submit" class="proc-btn primary">${formType==='receipt'?'确认到货并送检':formType==='directPo'?'生成采购单':formType==='policy'?'保存审批规则':'创建并提交采购主管审批'}</button></footer></form>`:`<div class="proc-details">${contents}</div><footer>${button('关闭','close')}${actions}</footer>`}</section>`;
}
const field=(label,name,value,type='text')=>`<label class="proc-field"><span>${esc(label)}</span><input name="${esc(name)}" type="${type}" value="${esc(value)}" required ${type==='number'?'min="0.01" step="any"':''}></label>`;
function error(message){const x=host().querySelector('.proc-error');if(x)x.textContent=message;else if(ctx)ctx.toast(message,'purchase');}
function newPurchase(p){
 if(!p||!canEdit(p))return error('请由 PMC 在缺料提示中生成采购单，采购员完善同一张单');
 if(!p.pmcConfirmedAt)return error('PMC 尚未确认该采购单');
 const body=`<div class="proc-po-source"><strong>采购单 ${esc(p.id)}</strong><span>${esc(p.material)} · ${money(p.qty)} · ${esc(p.sourceOrder||'补货')}</span></div>
 ${field('供应商','supplier',p.supplier||'')}${field('采购单价（元）','unitPrice',p.unitPrice||1,'number')}${field('供应商交期','deliveryDate',p.deliveryDate||day(),'date')}
 <label class="proc-field"><span>备注（可选）</span><textarea name="riskNote" rows="2">${esc(p.riskNote||'')}</textarea></label>
 <label class="proc-field"><span>紧急采购</span><input type="checkbox" name="urgent" value="yes" ${p.urgent?'checked':''}></label>
 <p class="proc-form-info">物料与数量已由 PMC 确认，只需填写供应商、单价和交期即可送审。</p>`;
 modal('完善采购单 · '+p.id,body,'','purchase',p.id);
}

function newReceipt(po){
 const list=available(),p=list.find(x=>x.id===po)||list[0];
 if(!p){error('当前没有可以登记到货的采购单。');return}
 focusPurchase=p.id;
 const opts=list.map(x=>`<option value="${esc(x.id)}" ${x.id===p.id?'selected':''}>${esc(x.id)} · ${esc(x.material)} · 剩余 ${money(numbers(x).remaining)}</option>`).join('');
 modal('登记本次采购到货',`<label class="proc-field"><span>对应采购单</span><select name="purchase" required>${opts}</select></label><p class="proc-form-info" id="proc-remaining">采购物料 ${esc(p.material)}，最多可登记 ${money(numbers(p).remaining)}</p>${field('本次实收数量','qty',numbers(p).remaining,'number')}${field('供应商批次','supplierLot','')}${field('到货日期','received',day(),'date')}${field('有效期','expiry',new Date(Date.now()+365*864e5).toISOString().slice(0,10),'date')}`,'','receipt');
}
function detailsPurchase(idValue){const p=orders().find(x=>x.id===idValue);if(!p)return;
 const n=numbers(p);const related=shipments(p.id).map(x=>`<div class="journey-extra-line"><b>${esc(x.id)}</b><span>${money(x.actualQty??x.qty)} · ${esc(x.status)}</span></div>`).join('');
 window.FactoryFlowUI?.openDocument({kind:'purchase',ref:p.id,docType:'采购单',status:p.status,summary:`${p.material} · 采购 ${money(p.qty)} · ${p.supplier}`,history:[],nextOpen:{dept:p.status==='待PMC确认'?'pmc':['待补采购需求','待采购填写','待采购主管审批','已驳回'].includes(p.status)?'purchase':p.status==='待财务审核'?'finance':p.status==='待总经办审批'?'leadership':'warehouse',feature:p.status==='待PMC确认'?'kitting':['待补采购需求','待采购填写','待采购主管审批','已驳回'].includes(p.status)?'purchase':p.status==='待财务审核'?'finance':p.status==='待总经办审批'?'approvals':'warehouseIncoming',record:p.id},approvalPlan:p.approvalPlan,detailHtml:`<div class="journey-section-head"><strong>采购数量及到货记录</strong><small>销售订单：${esc(p.sourceOrder||'补货')}　PMC：${esc(p.pmcConfirmedBy||'待确认')}　采购审核：${esc(p.approvedBy||'未审批')}　财务：${esc(p.financeBy||'按规则免审')}　总经办：${esc(p.leadershipBy||'按规则免审')}</small></div><div class="journey-extra-line">采购 ${money(n.ordered)} · 单价 ¥${money(p.unitPrice)} · 合计 ¥${money(p.totalAmount)} · 交期 ${esc(p.deliveryDate||'—')}</div><div class="journey-extra-line">已登记 ${money(n.registered)} · 已入库 ${money(n.stored)} · 剩余可登记 ${money(n.remaining)}</div>${related||'<div class="journey-extra-line">暂无到货记录</div>'}`});
}
// 兼容 Modules.startPurchaseReceipt 的采购到货入口，必须复用收货权限校验。
function openReceipt(po){
 if(!authorized(['warehouse','warehouseOps','create']))return error('到货登记需要仓库收货权限，应由有权限的仓库员工办理。');
 return newReceipt(po);
}
function detailsReceipt(idValue){const r=arrivals().find(x=>x.id===idValue);if(!r)return;
 const qc=M.state.inspections.find(x=>x.incoming===r.id);
 window.FactoryFlowUI?.openDocument({kind:'receipt',ref:r.id,docType:'采购到货单',status:r.status,summary:`采购单 ${r.purchase} · ${r.material} · 本次实收 ${money(r.actualQty??r.qty)}`,history:r.history||[],nextOpen:{dept:r.status==='待QC'?'quality':'warehouse',feature:r.status==='待QC'?'qaQc':'warehouseIncoming',record:r.id},detailHtml:`<div class="journey-section-head"><strong>供应商批次与质检</strong><small>相关采购单 ${esc(r.purchase)}</small></div><div class="journey-extra-line"><b>供应商批次</b><span>${esc(r.supplierLot||'—')}</span><b>到货日期</b><span>${esc(r.received||'—')}</span></div><div class="journey-extra-line"><b>QC 检验</b><span>${qc?`${esc(qc.id)} · ${esc(qc.status)}`:'待检'}</span><b>入库批次</b><span>${esc(r.batch||'尚未入库')}</span></div>`});
}
function renderNow(){ctx.save();ctx.render()}
function noticeFlow({ref,docType,action,from,to,status,next,nextOpen}){window.FactoryFlowUI?.show({ref,docType,action,from,to,status,next,operator:user().name,at:new Date().toLocaleString('zh-CN'),nextOpen,history:[]})}
function saveForm(form){
 const kind=form.dataset.kind,idValue=form.dataset.record,values=Object.fromEntries(new FormData(form).entries());
 if(kind==='directPo'){
  if(!authorized(['pmc','kitting','execute']))return error('当前员工没有 PMC 创建权限');
  const material=String(values.material||''),qty=Number(values.qty),reason=String(values.reason||'').trim(),neededBy=String(values.neededBy||'');
  if(!material||!validNumber(qty)||!reason||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(neededBy))return error('请填有效物料、数量、需用日期和原因');
  const p={id:id('PO'),material,qty,reason,neededBy,status:'待PMC确认',sourceOrder:'',
   createdBy:user().id,createdName:user().name,history:[]};
  audit(p,'PMC 创建采购单','pmc');orders().unshift(p);close();renderNow();detailsPurchase(p.id);return;
 }
 if(kind==='policy'){
  if(!authorized(['leadership','approvals','approve']))return error('只有总经办能维护审批规则');
  const financeLimit=Number(values.financeLimit),leadershipLimit=Number(values.leadershipLimit),rawBudget=String(values.budgetLimit||'').trim(),budgetLimit=rawBudget===''?null:Number(rawBudget);
  if(!validNumber(financeLimit)||!validNumber(leadershipLimit)||leadershipLimit<financeLimit||budgetLimit!==null&&(!Number.isFinite(budgetLimit)||budgetLimit<0))return error('请填写有效金额，且总经办审批门槛不得低于财务门槛。');
  const supplierList=[...new Set(String(values.approvedSuppliers||'').split(/[\r\n,，]+/).map(x=>x.trim()).filter(Boolean))];
  Object.assign(rules(),{financeLimit,leadershipLimit,budgetLimit,approvedSuppliers:supplierList,updatedAt:fmt(),updatedBy:user().name});
  (O.state.procurementPolicyHistory??=[]).push({at:fmt(),person:user().name,action:'修改采购预算、门槛与合格供应商'});
  close();renderNow();ctx.toast('采购审批规则已更新，影响此后采购主管核准的订单。');return;
 }
 if(kind==='purchase'){
  const p=orders().find(x=>x.id===idValue);
  if(!p||!canEdit(p)||!p.pmcConfirmedAt)return error('只能由采购员完善已确认的采购单');
  const supplier=String(values.supplier||'').trim(),unitPrice=Number(values.unitPrice),deliveryDate=String(values.deliveryDate||'');
  if(!supplier||!validNumber(unitPrice)||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(deliveryDate))return error('请填写供应商、有效单价和交期');
  Object.assign(p,{supplier,unitPrice,totalAmount:Math.round(Number(p.qty)*unitPrice*100)/100,deliveryDate,
   urgent:values.urgent==='yes',riskNote:String(values.riskNote||'').trim(),status:'待采购主管审批',
   purchaseId:user().id,purchaseBy:user().name,submittedAt:new Date().toISOString()});
  if(!validNumber(p.totalAmount))return error('采购总金额无效');
  delete p.approvedBy;delete p.approvedId;delete p.financeBy;delete p.financeId;delete p.leadershipBy;delete p.leadershipId;
  p.approvalPlan=approvalPlan(p);audit(p,'采购员完善采购单并送审','purchase');
  close();renderNow();detailsPurchase(p.id);return;
 }
 if(kind==='receipt'){
  if(!authorized(['warehouse','warehouseOps','create']))return error('需要仓库收货权限。');
  const p=available().find(x=>x.id===values.purchase),qty=Number(values.qty);
  if(!p)return error('采购单状态已变化，请关闭窗口后重新选择。');
  if(!Number.isFinite(qty)||qty<=0||qty>numbers(p).remaining+0.000001)return error(`本次实收必须大于 0，且不能超过剩余 ${money(numbers(p).remaining)}。`);
  if(!String(values.supplierLot||'').trim())return error('请填写供应商批次。');
  const r={id:id('IN'),purchase:p.id,material:p.material,qty,actualQty:qty,actualMaterial:p.material,supplier:p.supplier,supplierLot:values.supplierLot,received:values.received,expiry:values.expiry,status:'待QC',registeredBy:user().id,history:[{action:'仓库到货登记',from:'warehouse',person:user().name,at:new Date().toLocaleString('zh-CN')}]};
  arrivals().unshift(r);
  M.state.inspections.unshift({id:id('IQC'),phase:'来料',source:'仓库到货登记',material:p.material,batch:values.supplierLot,order:'',incoming:r.id,status:'待判定',date:day()});
  syncStatus(p);
  M.state.ledger.unshift({id:id('LOG'),time:new Date().toLocaleString('zh-CN'),ts:Date.now(),dept:'warehouse',type:'仓库到货登记',ref:r.id,detail:`${p.material} ${qty} / ${p.id}`,by:user().name});
  close();renderNow();noticeFlow({ref:r.id,docType:'到货单',action:'仓库到货登记',from:'warehouse',to:'quality',status:'待QC',next:'质量部检验到货物料',nextOpen:{dept:'quality',feature:'qaQc',action:'qualityRecord',record:M.state.inspections.find(i=>i.incoming===r.id)?.id}});return;
 }
}
function store(idValue){const r=arrivals().find(x=>x.id===idValue);if(!r||r.status!=='合格待入库')return error('只有 QC 合格且尚未入库的到货单才能入库。');
 const p=orders().find(x=>x.id===r.purchase),qty=Number(r.actualQty??r.qty);
 if(!p||!(qty>0))return error('缺少采购单或有效实收数量，无法入库。');
 if(M.state.batches.some(x=>x.incoming===r.id))return error('这张到货单已经产生入库批次，不能重复入库。');
 const bid=id('LOT');M.state.batches.unshift({id:bid,incoming:r.id,source:'采购入库',material:r.material,group:r.material.startsWith('PK-')?'非品牌包材':'原辅料',qty,unit:r.material.startsWith('PK-')?'个':'kg',received:r.received,expiry:r.expiry,quality:'合格',supplierLot:r.supplierLot,counted:true});
 O.state.stock[r.material]=(O.state.stock[r.material]||0)+qty;r.status='已入库';r.batch=bid;(r.history??=[]).push({action:'仓库确认入库',from:'warehouse',person:user().name,at:new Date().toLocaleString('zh-CN')});syncStatus(p);
 M.state.ledger.unshift({id:id('LOG'),time:new Date().toLocaleString('zh-CN'),ts:Date.now(),dept:'warehouse',type:'采购到货质检入库',ref:r.id,detail:`${r.material} +${qty} / ${bid}`,by:user().name});
 renderNow();noticeFlow({ref:r.id,docType:'到货单',action:'仓库确认入库',from:'warehouse',to:'warehouse',status:'已入库',next:'可用库存已更新',nextOpen:{dept:'warehouse',feature:'warehouseIncoming'}});
}
function createFromShortage(orderId){
 if(!authorized(['pmc','kitting','execute']))return error('当前员工没有 PMC 物料齐套操作权限');
 const order=ctx.data.orders.find(o=>o.id===orderId);if(!order)return error('销售订单不存在');
 const rows=O.materialShortages(order);if(!rows.length)return error('已经没有缺料，不需要重复采购');
 let first=null,created=0;
 for(const r of rows){
  let p=orders().find(x=>x.sourceOrder===orderId&&x.material===r.material&&!['已入库','已驳回'].includes(x.status));
  if(!p){
   p=orders().find(x=>x.material===r.material&&x.status==='待补采购需求'&&!x.sourceOrder);
   const fresh=!p;if(!p)p={id:id('PO'),history:[]};
   Object.assign(p,{material:r.material,qty:r.missing,sourceOrder:orderId,reason:'销售订单 '+orderId+' · BOM/库存缺口',neededBy:day(),
    status:'待采购填写',createdBy:user().id,createdName:user().name,pmcAutoConfirmed:true,
    pmcConfirmedAt:new Date().toISOString(),pmcConfirmedBy:'BOM 与库存校验'});
   audit(p,'PMC 依据销售订单缺料生成采购单','pmc');
   if(fresh)orders().unshift(p);
   created++;
  }
  if(!first)first=p;
 }
 document.querySelector('#ops-modal-host')?.replaceChildren();close();renderNow();
 if(first)detailsPurchase(first.id);
 ctx.toast(created?'已直接生成 '+created+' 张采购单，采购员在原单补齐价格即可。':'采购单已存在，已打开原单。');
 return first?.id;
}
function trackShortage(orderId){
 const all=ctx?.data||JSON.parse(localStorage.getItem('factory-workspace-v4')||'{}');
 const order=all.orders?.find(x=>x.id===orderId);
 const stock=O.state.stock,reservations=O.state.reservations||{};
 const committed=Object.values(reservations).reduce((t,x)=>t+Number(x['PK-001']||0),0);
 const need=order?Math.ceil(Number(order.qty||0)*(O.state.bom.find(x=>x.child==='PK-001')?.qty??.25)):0;
 const shortageMaterial=need>Math.max(0,(stock['PK-001']||0)-committed)?'PK-001':'RM-001';
 const relevant=orders().filter(p=>p.material===shortageMaterial);
 const p=relevant.find(x=>x.status==='待审批')||relevant.find(x=>['待到货','部分到货','到货处理中'].includes(x.status))||null;
 const receipts=p?shipments(p.id):[];
 const qc=receipts.find(x=>x.status==='待QC');
 const target=qc?{dept:'quality',feature:'qaQc',record:qc.id}:p?.status==='待审批'?{dept:'purchase',feature:'purchase',record:p.id}:p?{dept:'warehouse',feature:'warehouseIncoming',record:p.id}:{dept:'purchase',feature:'purchase'};
 document.querySelector('#ops-modal-host').innerHTML='';window.FactoryNavigation?.trackBottleneck?.(target,target.record||'');
}
function onAction(el){const action=el.dataset.procAction,ref=el.dataset.procId;
 if(action==='close'){close();return}
 if(action==='newPurchase'){return error('采购单由 PMC 直接生成，采购员完善同一张单据即可')}
 if(action==='newDirectPurchase'){newDirectPurchase();return}
 if(action==='approvePmcPurchase'||action==='rejectPmcPurchase'){
  const p=orders().find(x=>x.id===ref);
  if(!canPmcReview(p))return error('请由另一位具备权限的 PMC 主管确认采购单');
  const yes=action==='approvePmcPurchase';p.status=yes?'待采购填写':'已驳回';
  if(yes){p.pmcConfirmedAt=new Date().toISOString();p.pmcConfirmedBy=user().name}
  audit(p,yes?'PMC主管确认采购单':'PMC主管退回采购单','pmc');renderNow();detailsPurchase(p.id);return;
 }
 if(action==='createPurchaseFromShortage'){createFromShortage(ref);return}
 if(action==='viewShortagePurchase'){document.querySelector('#ops-modal-host')?.replaceChildren();detailsPurchase(ref);return}
 if(action==='editPurchase'){const p=orders().find(x=>x.id===ref);if(!canEdit(p))return error('只能由采购员完善待处理的原采购单');newPurchase(p);return}
 if(action==='newReceipt'){if(!authorized(['warehouse','warehouseOps','create']))return error('到货登记需要仓库收货权限，应由有权限的仓库员工办理。');newReceipt(ref);return}
 if(action==='viewPurchase'){detailsPurchase(ref);return}
 if(action==='viewReceipt'){detailsReceipt(ref);return}
 if(action==='showInspection'){const rec=arrivals().find(r=>r.id===ref),qc=M.state.inspections.find(x=>x.incoming===rec?.id);if(qc){close();M.openQualityRecord(qc.id)}return}
 if(action==='editPolicy'){newPolicy();return}
 if(action==='approve'||action==='reject'){
  const p=orders().find(x=>x.id===ref);
  if(!canPurchaseApprove(p))return error('采购主管须为另一位有权员工，且采购单必须关联已确认的 PMC 需求、有效金额。');
  if(action==='reject'){p.status='已驳回';audit(p,'采购主管驳回','purchase');renderNow();ctx.toast('采购单已退回原采购员');return}
  p.approvedBy=user().name;p.approvedId=user().id;p.approvedAt=new Date().toISOString();
  p.approvalPlan=approvalPlan(p);
  p.status=p.approvalPlan.finance?'待财务审核':p.approvalPlan.leadership?'待总经办审批':'待到货';
  audit(p,'采购主管审批通过','purchase');renderNow();
  noticeFlow({ref:p.id,docType:'采购单',action:'采购主管审批通过',from:'purchase',to:p.status==='待财务审核'?'finance':p.status==='待总经办审批'?'leadership':'warehouse',status:p.status,next:'按采购规则流转',nextOpen:p.status==='待财务审核'?{dept:'finance',feature:'finance',record:p.id}:p.status==='待总经办审批'?{dept:'leadership',feature:'approvals',record:p.id}:{dept:'warehouse',feature:'warehouseIncoming',record:p.id}});return;
 }
 if(['approveFinance','rejectFinance','approveLeadership','rejectLeadership'].includes(action)){
  const dept=action.endsWith('Finance')?'finance':'leadership',p=orders().find(x=>x.id===ref);
  if(!canDepartmentApprove(p,dept))return error('当前没有对应审批权限，或者该员工已参与此采购单的前序审批。');
  const yes=action.startsWith('approve');
  if(dept==='finance'){p.financeBy=user().name;p.financeId=user().id}
  else{p.leadershipBy=user().name;p.leadershipId=user().id}
  p.status=!yes?'已驳回':dept==='finance'&&p.approvalPlan?.leadership?'待总经办审批':'待到货';
  audit(p,dept==='finance'?(yes?'财务审核通过':'财务驳回'):(yes?'总经办审批通过':'总经办驳回'),dept);
  renderNow();
  if(yes)noticeFlow({ref:p.id,docType:'采购单',action:(dept==='finance'?'财务审核通过':'总经办审批通过'),from:dept,to:p.status==='待到货'?'warehouse':'leadership',status:p.status,next:p.status==='待到货'?'等待仓库到货登记':'等待总经办审批',nextOpen:p.status==='待到货'?{dept:'warehouse',feature:'warehouseIncoming',record:p.id}:{dept:'leadership',feature:'approvals',record:p.id}});
  else ctx.toast('采购单已驳回，退回原采购员修改。');return;
 }
 if(action==='storeReceipt'){if(!authorized(['warehouse','warehouseOps','execute']))return error('需要仓库入库确认权限。');store(ref);return}
}
const nativeInit=M.init,nativeRender=O.render;
M.init=function(context){const result=nativeInit(context);ctx=context;migrate();return result};
O.render=function(feature){
 const base=feature==='purchase'?renderPurchases():nativeRender(feature);
 if(feature==='kitting'){
  const b=authorized(['pmc','kitting','execute'])?button('手动补货采购','newDirectPurchase'):'';
  return base.replace('<div class="biz-order-toolbar">','<div class="biz-order-toolbar">'+b)+pmcQueue();
 }
 return feature==='finance'?base+renderApprovals('finance'):feature==='approvals'?base+renderApprovals('leadership'):base;
};
M.startPurchaseReceipt=function(po){ctx.openFeature('warehouseIncoming','warehouse');setTimeout(()=>openReceipt(po),40)};
document.addEventListener('input',e=>{if(e.target.matches?.('.proc-order-search'))filterPurchases()});
document.addEventListener('change',e=>{if(e.target.matches?.('.proc-order-status'))filterPurchases()});
document.addEventListener('click',e=>{const el=e.target.closest('[data-proc-action]');if(el){e.preventDefault();onAction(el)}});
document.addEventListener('submit',e=>{if(e.target.id==='proc-form'){e.preventDefault();saveForm(e.target)} });
document.addEventListener('change',e=>{if(e.target.matches('#proc-form [name="purchase"]')){const p=orders().find(x=>x.id===e.target.value);if(p){const n=numbers(p);e.target.form.querySelector('[name="qty"]').value=n.remaining;e.target.form.querySelector('#proc-remaining').textContent=`采购物料 ${p.material}，最多可登记 ${money(n.remaining)}`}}});
document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
window.FactoryProcurement={renderPurchases,renderIncoming,createFromShortage,openPurchase:detailsPurchase,renderApprovals,trackShortage,numbers,shipments,available,store,openReceipt,get context(){return ctx}};
})();