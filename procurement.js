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
// 采购审批只读取权限矩阵，并检查申请人与审批人不得相同。
const canApprove=p=>p?.status==='待审批'&&Boolean(p.createdBy)&&p.createdBy!==user().id&&authorized(['purchase','purchase','approve']);
const canEdit=p=>Boolean(p)&&['草稿','已驳回'].includes(p.status)&&p.createdBy===user().id&&authorized(['purchase','purchase','edit']);
function syncStatus(p){
 if(!p||['草稿','待审批'].includes(p.status))return;
 const n=numbers(p);
 p.status=n.stored>=n.ordered&&n.ordered>0?'已入库':n.stored>0?'部分到货':n.registered>0?'到货处理中':'待到货';
}
function migrate(){
 // 新版本不读取或迁移旧到货流程数据；当前工作区只按新状态机计算。
 for(const p of orders()){p.qty=Number(p.qty)||0;if(['待到货','部分到货','到货处理中','已入库'].includes(p.status))syncStatus(p)}
 ctx.save();
}
function renderPurchases(){
 const pending=orders().filter(p=>p.status==='待审批');
 const mine=pending.filter(canApprove);
 const rows=orders().map(p=>{
  const n=numbers(p),isAwaiting=p.status==='待审批';
  let actions=button('查看采购单','viewPurchase',p.id);
  if(canEdit(p))actions+=button('编辑并重新送审','editPurchase',p.id);
  if(isAwaiting&&canApprove(p))actions+=button('审批通过','approve',p.id,'primary')+button('驳回','reject',p.id);
  const actor=p.createdName||'历史单据';
  const progress=p.status==='待审批'?(p.createdBy?'等待其他有审批权限的员工办理':'缺少创建人记录，需先核实单据来源'): `已入库 ${money(n.stored)} / 已登记 ${money(n.registered)} / 采购 ${money(n.ordered)}`;
  return `<tr class="biz-order-row" data-order-status="${esc(p.status)}"><td><strong>${esc(p.id)}</strong><small class="proc-sub">创建人：${esc(actor)}</small></td><td>${esc(p.material)}</td><td>${money(p.qty)}</td><td>${esc(p.supplier||'—')}</td><td>${tag(p.status)}<small class="proc-sub">${progress}</small></td><td><div class="proc-actions">${actions}</div></td></tr>`;
 }).join('');
 const states=['待审批','待到货','到货处理中','部分到货','已入库','已驳回'];
 const stats=states.map(name=>[name,orders().filter(p=>p.status===name).length]);
 const table=`<div class="op-table-wrap proc-purchase-list"><table class="op-table"><thead><tr><th>采购单</th><th>物料</th><th>采购数量</th><th>供应商</th><th>到货进度 / 状态</th><th>操作</th></tr></thead><tbody>${rows||'<tr><td colspan="6">暂无采购单</td></tr>'}</tbody></table></div>`;
 const toolbar=authorized(['purchase','purchase','create'])?button('新建采购单','newPurchase','','primary'):'';
 return `<div class="ops-workbench proc-page proc-purchase-page">${window.FactoryOrderListUI.panel({key:'purchase',item:'采购单',table,toolbar,stats,statuses:orders().map(p=>p.status),placeholder:'搜索采购单号 / 物料 / 供应商'})}</div>`;
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
 content:`<div class="proc-page"><section class="mw-data-section"><div class="mw-data-section-head"><div><strong>可登记到货的采购单</strong><span>剩余数量实时扣除已登记的在途 / 待检数量</span></div><div class="mw-actions">${available().length&&canReceive?button('登记到货','newReceipt','','primary'):''}</div></div><div class="mw-table-scroll"><table class="mw-table"><thead><tr><th>采购单</th><th>物料</th><th>采购数量</th><th>已登记</th><th>可登记</th><th>操作</th></tr></thead><tbody>${poRows||'<tr><td colspan="6" class="mw-empty">暂无可登记的采购单。等待采购主管审批，或已有到货正在处理。</td></tr>'}</tbody></table></div></section><section class="mw-data-section"><div class="mw-data-section-head"><div><strong>到货记录</strong><span>每次到货都是独立单据，可以查看和追踪</span></div></div><div class="mw-table-scroll"><table class="mw-table"><thead><tr><th>到货单</th><th>采购单</th><th>物料 / 实收</th><th>供应商批次</th><th>状态 / 质检</th><th>操作</th></tr></thead><tbody>${received||'<tr><td colspan="6" class="mw-empty">暂无到货记录</td></tr>'}</tbody></table></div></section></div>`};
}
function host(){let h=document.getElementById('proc-modal-host');if(!h){h=document.createElement('div');h.id='proc-modal-host';document.body.append(h)}return h;}
const close=()=>{host().innerHTML='';focusPurchase=''};
function modal(title,contents,actions='',formType='',record=''){
 host().innerHTML=`<div class="proc-overlay" data-proc-action="close"></div><section class="proc-modal" role="dialog" aria-modal="true" aria-labelledby="proc-title"><header><h2 id="proc-title">${esc(title)}</h2>${button('关闭','close')}</header>${formType?`<form id="proc-form" data-kind="${esc(formType)}" data-record="${esc(record)}"><div class="proc-fields">${contents}</div><p class="proc-error" role="alert"></p><footer>${button('取消','close')}<button type="submit" class="proc-btn primary">${formType==='receipt'?'确认到货并送检':'创建并提交审批'}</button></footer></form>`:`<div class="proc-details">${contents}</div><footer>${button('关闭','close')}${actions}</footer>`}</section>`;
}
const field=(label,name,value,type='text')=>`<label class="proc-field"><span>${esc(label)}</span><input name="${esc(name)}" type="${type}" value="${esc(value)}" required ${type==='number'?'min="0.01" step="any"':''}></label>`;
function error(message){const x=host().querySelector('.proc-error');if(x)x.textContent=message;else if(ctx)ctx.toast(message,'purchase');}
function newPurchase(p){
 const content=`<label class="proc-field"><span>物料编码</span><select name="material" required>${['RM-001','RM-002','AD-001','PK-001','PK-002'].map(k=>`<option value="${k}" ${p?.material===k?'selected':''}>${k}</option>`).join('')}</select></label>${field('采购数量','qty',p?.qty||200,'number')}${field('供应商','supplier',p?.supplier||'')}`;
 modal(p?'编辑采购单':'新建采购单',content,'','purchase',p?.id||'');
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
 window.FactoryFlowUI?.openDocument({kind:'purchase',ref:p.id,docType:'采购单',status:p.status,summary:`${p.material} · 采购 ${money(p.qty)} · ${p.supplier}`,history:p.history||[],nextOpen:{dept:p.status==='待审批'?'purchase':'warehouse',feature:p.status==='待审批'?'purchase':'warehouseIncoming',record:p.id},detailHtml:`<div class="journey-section-head"><strong>采购数量及到货记录</strong><small>创建人：${esc(p.createdName||'历史单据')}　审批人：${esc(p.approvedBy||'未审批')}</small></div><div class="journey-extra-line">采购 ${money(n.ordered)} · 已登记 ${money(n.registered)} · 已入库 ${money(n.stored)} · 剩余可登记 ${money(n.remaining)}</div>${related||'<div class="journey-extra-line">暂无到货记录</div>'}`});
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
 if(kind==='purchase'){
  const qty=Number(values.qty),material=values.material,supplier=String(values.supplier||'').trim();
  if(!material||!Number.isFinite(qty)||qty<=0||!supplier)return error('请填写采购物料、供应商和大于 0 的数量。');
  if(idValue? !canEdit(orders().find(p=>p.id===idValue)) : !authorized(['purchase','purchase','create']))return error('当前员工没有创建或修改这张采购单的权限。');
  const old=orders().find(x=>x.id===idValue);
  if(old){Object.assign(old,{material,qty,supplier,status:'待审批',submittedAt:new Date().toISOString()});(old.history??=[]).push({action:'原创建人编辑并重新送审',from:'purchase',person:user().name,at:new Date().toLocaleString('zh-CN')})}
  else orders().unshift({id:id('PO'),material,qty,supplier,status:'待审批',createdBy:user().id,createdName:user().name,submittedAt:new Date().toISOString(),history:[{action:'采购员创建并送审',from:'purchase',person:user().name,at:new Date().toLocaleString('zh-CN')}]});
  close();renderNow();ctx.toast('采购单已创建并提交，等待采购主管审批。','purchase');return;
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
 if(action==='newPurchase'){if(!authorized(['purchase','purchase','create']))return;newPurchase();return}
 if(action==='editPurchase'){const p=orders().find(x=>x.id===ref);if(!canEdit(p))return error('只有原创建人且具有采购修改权限，才能修改草稿或被驳回的采购单。');newPurchase(p);return}
 if(action==='newReceipt'){if(!authorized(['warehouse','warehouseOps','create']))return error('到货登记需要仓库收货权限，应由有权限的仓库员工办理。');newReceipt(ref);return}
 if(action==='viewPurchase'){detailsPurchase(ref);return}
 if(action==='viewReceipt'){detailsReceipt(ref);return}
 if(action==='showInspection'){const rec=arrivals().find(r=>r.id===ref),qc=M.state.inspections.find(x=>x.incoming===rec?.id);if(qc){close();M.openQualityRecord(qc.id)}return}
 if(action==='submitLegacy'){const p=orders().find(x=>x.id===ref);if(!canEdit(p))return error('只有原创建人且具有采购修改权限，才能重新提交。');p.status='待审批';(p.history??=[]).push({action:'原创建人重新送审',from:'purchase',person:user().name,at:new Date().toLocaleString('zh-CN')});renderNow();return}
 if(action==='approve'||action==='reject'){
  const p=orders().find(x=>x.id===ref);if(!p||p.status!=='待审批')return;
  if(!canApprove(p))return error('当前员工没有这张单据的审批权限，或属于创建人。请由另一位获得采购审批权限的员工办理。');
  if(action==='approve'){p.status='待到货';p.approvedBy=user().name;p.approvedAt=new Date().toISOString()}else p.status='已驳回';(p.history??=[]).push({action:action==='approve'?'采购主管审批通过':'采购主管驳回',from:'purchase',person:user().name,at:new Date().toLocaleString('zh-CN')});
  renderNow();noticeFlow({ref:p.id,docType:'采购单',action:action==='approve'?'采购主管审批通过':'采购主管驳回',from:'purchase',to:action==='approve'?'warehouse':'purchase',status:p.status,next:action==='approve'?'等待仓库按实际到货登记':'采购员核对后重新提交',nextOpen:action==='approve'?{dept:'warehouse',feature:'warehouseIncoming',record:p.id}:{dept:'purchase',feature:'purchase'}});return;
 }
 if(action==='storeReceipt'){if(!authorized(['warehouse','warehouseOps','execute']))return error('需要仓库入库确认权限。');store(ref);return}
}
const nativeInit=M.init,nativeRender=O.render;
M.init=function(context){const result=nativeInit(context);ctx=context;migrate();return result};
O.render=function(feature){return feature==='purchase'?renderPurchases():nativeRender(feature)};
M.startPurchaseReceipt=function(po){ctx.openFeature('warehouseIncoming','warehouse');setTimeout(()=>openReceipt(po),40)};
document.addEventListener('click',e=>{const el=e.target.closest('[data-proc-action]');if(el){e.preventDefault();onAction(el)}});
document.addEventListener('submit',e=>{if(e.target.id==='proc-form'){e.preventDefault();saveForm(e.target)} });
document.addEventListener('change',e=>{if(e.target.matches('#proc-form [name="purchase"]')){const p=orders().find(x=>x.id===e.target.value);if(p){const n=numbers(p);e.target.form.querySelector('[name="qty"]').value=n.remaining;e.target.form.querySelector('#proc-remaining').textContent=`采购物料 ${p.material}，最多可登记 ${money(n.remaining)}`}}});
document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
window.FactoryProcurement={renderPurchases,renderIncoming,trackShortage,numbers,shipments,available,store,openReceipt,get context(){return ctx}};
})();