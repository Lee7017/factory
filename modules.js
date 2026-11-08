/* 制造运营工作台：质量、车间、仓储、排班、工时、标准卡、设置。
   与 FactoryOperations 共用订单、生产任务、采购与库存数据，前端操作记录保存在当前浏览器。 */
(()=>{'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=s=>document.querySelector(s);
const labels={overview:'工厂运行总览',qaQc:'QA/QC 审批',workshop:'车间管理',warehouseOps:'仓库管理',shift:'排班',hours:'我的工时',sop:'操作标准卡',settings:'系统设置'};
const tabs={qaQc:[['decision','报检判定'],['sampling','抽检'],['clean','清洗报检'],['ncr','不合格品处置'],['qualityStock','质量库存']],workshop:[['request','领料 / 退库'],['doubleSign','到料接收双签'],['dispute','工时申诉审批'],['rework','返洗 / 返工']],warehouseOps:[['batches','库存批次'],['incoming','来料比对 · 报检入库'],['pick','备料执行 · FIFO'],['outbound','成品出库'],['returns','退库接收'],['ledger','月末收发存']],shift:[['plan','排班编排'],['people','员工排班'],['stats','排班统计'],['products','订单产品统计'],['report','订单日报表']],hours:[['mine','我的工时'],['appeals','工时申诉']],sop:[['cards','受控操作标准卡'],['executions','执行记录']],settings:[['org','权限与组织'],['process','流程与工艺'],['product','产品与物料'],['dictionary','基础字典']]};
const snapshot=[['原辅料','756','7559999829.5428'],['品牌包材','387','3869994301.6000'],['非品牌包材','468','4679999184.0000'],['半成品','225','2.4960'],['成品','2077','16.0000']];
const stagesOrder=['draft','review','approved','trial','formal','reserved','issued','blending','semi_qc','semi_ok','packaging','final_qc','inspected','released','stored'];
const stamp=()=>new Date().toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
let ctx, S, currentTab={}, form=null, message='',modDialogOpen=false;
function init(context){ctx=context;ctx.data.modules??={version:18,inspections:[],samples:[],cleanReports:[],ncr:[],batches:[],incoming:[],outbound:[],materialRequests:[],returns:[],disputes:[],roster:[],hours:[],standards:[],executions:[],dictionary:[{id:'DICT-01',group:'班次',name:'日班',value:'08:00–16:00',active:true},{id:'DICT-02',group:'班次',name:'夜班',value:'16:00–00:00',active:true}],ledger:[],rules:{cleanQC:true,requireDoubleSign:true,fifo:true,requireSkill:true,requireLeave:true}};
 S=ctx.data.modules; for(const [key,value] of Object.entries({inspections:[],samples:[],cleanReports:[],ncr:[],batches:[],incoming:[],outbound:[],materialRequests:[],returns:[],disputes:[],roster:[],hours:[],standards:[],executions:[],dictionary:[],ledger:[],rules:{}}))S[key]??=value;
 S.rules={cleanQC:true,requireDoubleSign:true,fifo:true,requireSkill:true,requireLeave:true,...S.rules};ensureStoredOrderBatches();ctx.save();}
const me=()=>ctx.access.current();
const ops=()=>ctx.ops.state;
const permitted=(dept,feature,action='view')=>ctx.access.has(dept,feature,action);
function check(dept,feature,action='view'){if(permitted(dept,feature,action))return true;message='当前员工没有执行该操作的权限。';ctx.render();return false;}
const money=n=>Number(n).toLocaleString('zh-CN',{maximumFractionDigits:4});
const status=s=>`<span class="mw-status ${/已|合格|通过|放行|正常|可用|完结/.test(s)?'mw-ok':/冻结|不合格|驳回|超期|冲突|拒绝/.test(s)?'mw-alert':''}">${esc(s)}</span>`;
function btn(label,action,id='',variant=''){return `<button type="button" class="mw-btn ${variant}" data-module-action="${esc(action)}" data-mid="${esc(id)}">${esc(label)}</button>`}
function navButton(label,dept,feat){return btn(label,'navigate',`${dept}:${feat}`)}
function td(value){return `<td>${value}</td>`}
function grid(columns,rows,empty='暂无记录，请通过上方操作按钮新增'){return `<div class="mw-table-scroll"><table class="mw-table"><thead><tr>${columns.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.join(''):`<tr><td colspan="${columns.length}" class="mw-empty">${esc(empty)}</td></tr>`}</tbody></table></div>`}
function row(values){return `<tr>${values.map(td).join('')}</tr>`}
function wrap(page,title,intro,toolbar,content,stats=''){
 const active=currentTab[page]||tabs[page]?.[0]?.[0]||'';
 const tabset=tabs[page]?`<nav class="mw-tabs" aria-label="${esc(title)}功能分组">${tabs[page].map(([id,label])=>btn(label,'tab',`${page}:${id}`,active===id?'active':'')).join('')}</nav>`:'';
 const commandbar=(tabset||toolbar)?`<div class="mw-commandbar">${tabset}<div class="mw-actions">${toolbar||''}</div></div>`:'';
 return `<div class="mw-page" data-module-page="${esc(page)}">${commandbar}${stats}<section class="mw-content">${content}</section><div class="mw-feedback" role="status">${message?esc(message):'操作记录保存在当前浏览器；审批与库存变更会关联相应单据。'}</div></div>`;
}
function cards(rows){return `<div class="mw-metrics">${rows.map(([label,value,sub])=>`<div class="mw-metric"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(sub||'')}</small></div>`).join('')}</div>`}
function head(label,extra=''){return `<div class="mw-section-head"><h3>${esc(label)}</h3><span>${esc(extra)}</span></div>`}
function note(extra=''){return extra?`<p class="mw-tab-note">${esc(extra)}</p>`:''}
function field(key,label,kind='text',val='',options=[]){const control=kind==='select'?`<select name="${esc(key)}" id="m-${esc(key)}" required>${options.map(x=>{let [v,t]=Array.isArray(x)?x:[x,x];return `<option value="${esc(v)}" ${String(v)===String(val)?'selected':''}>${esc(t)}</option>`}).join('')}</select>`:kind==='textarea'?`<textarea name="${esc(key)}" id="m-${esc(key)}" rows="3" required>${esc(val)}</textarea>`:`<input name="${esc(key)}" id="m-${esc(key)}" type="${esc(kind)}" value="${esc(val)}" ${kind==='number'?'min="0.01" step="any"':''} required>`;return `<label class="mw-field"><span>${esc(label)}</span>${control}</label>`}
function modal(title,fields,context){form=context;modDialogOpen=true;$('#modules-modal-host').innerHTML=`<div class="mw-overlay" data-module-action="closeModal"></div><section class="mw-modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header><h2>${esc(title)}</h2>${btn('关闭','closeModal')}</header><form id="module-form"><div class="mw-modal-fields">${fields}</div><p class="mw-modal-error" aria-live="polite"></p><footer>${btn('取消','closeModal')}<button class="mw-btn primary" type="submit">保存并提交</button></footer></form></section>`}
function close(){modDialogOpen=false;form=null;$('#modules-modal-host').innerHTML=''}
function fail(str){const el=$('.mw-modal-error');if(el)el.textContent=str;else {message=str;ctx.render()};return false}
function completeWithFlow(){if(!pendingAudit)return;const row=pendingAudit;pendingAudit=null;const recent=S.ledger.filter(x=>x.ref===row.ref).slice(0,5).reverse().map(x=>({at:x.time,from:x.dept||row.dept,action:x.type}));window.FactoryFlowUI?.fromAudit(row,recent,row.dept);}
function done(str){message=str;close();ctx.save();ctx.render();completeWithFlow();}
function save(str){message=str;ctx.save();ctx.render();completeWithFlow()}
const id=prefix=>`${prefix}-${Date.now().toString().slice(-7)}-${Math.floor(Math.random()*900+100)}`;
const orderOptions=()=>ctx.data.orders.filter(o=>ops().flows[o.id]?.stage!=='stored').map(o=>[o.id,`${o.id} · ${o.product}`]);
const completedOrderOptions=()=>ctx.data.orders.filter(o=>ops().flows[o.id]?.stage==='stored').map(o=>[o.id,`${o.id} · ${o.product}`]);
function pendingOutboundQty(batchId){return S.outbound.filter(x=>x.status==='待出库').flatMap(x=>x.allocations||[]).filter(x=>x.id===batchId).reduce((n,x)=>n+Number(x.qty),0)}
function allocateFinished(orderId,qty){
 const sorted=S.batches.filter(b=>b.group==='成品'&&b.order===orderId&&b.quality==='合格'&&Number(b.qty)>0).sort((a,b)=>a.received.localeCompare(b.received)||a.id.localeCompare(b.id));
 let left=Number(qty),out=[];for(const b of sorted){const available=Math.max(0,Number(b.qty)-pendingOutboundQty(b.id)),used=Math.min(left,available);if(used>0){out.push({id:b.id,qty:used});left-=used}if(left<=0)break}return left>0?null:out;
}
const taskOptions=type=>ctx.data.tasks.filter(t=>!type||t.type===type).map(t=>[t.id,`${t.id} · ${t.type} · ${t.line}`]);
const staffOptions=()=>ctx.access.staff.map(x=>[x.id,`${x.name} · ${x.title}`]);
const materialOptions=()=>[...new Set(['RM-001','RM-002','AD-001','PK-001','PK-002','CO-001',...ops().products.map(p=>p.id),...S.batches.map(b=>b.material)])];
let pendingAudit=null;
function audit(type,ref,detail){const row={id:id('LOG'),time:stamp(),ts:Date.now(),dept:ctx.data.dept,type,ref,detail,by:me().name};pendingAudit=row;S.ledger.unshift(row);S.ledger=S.ledger.slice(0,300);}
function getBatch(id){return S.batches.find(b=>b.id===id)}
function getRequest(id){return S.materialRequests.find(r=>r.id===id)}
function getReceipt(id){return S.incoming.find(r=>r.id===id)}
function productCodeForOrder(order){const p=ops().products?.find(x=>x.category==='成品'&&x.name===order?.product);return p?.id||(String(order?.product||'').includes('500g/L')?'FG-002':'FG-001')}
function finishedUnitsForOrder(order){const m=String(order?.spec||'').match(/([\d.]+)\s*L\s*[×xX*]\s*(\d+)/);const perCase=m?Number(m[1])*Number(m[2]):20;return Math.ceil(Number(order?.qty||0)/Math.max(perCase,0.000001))}
function ensureStoredOrderBatches(){
 for(const o of ctx.data.orders||[]){if(ops().flows?.[o.id]?.stage!=='stored')continue;if(S.batches.some(b=>b.order===o.id&&b.source==='生产入库'))continue;
  S.batches.unshift({id:id('LOT'),material:productCodeForOrder(o),group:'成品',qty:finishedUnitsForOrder(o),unit:'箱',received:today(),expiry:'',quality:'合格',order:o.id,source:'生产入库',counted:true});
 }
}
function receiveFinishedGoods(order,qty=finishedUnitsForOrder(order)){
 let existing=S.batches.find(b=>b.order===order.id&&b.source==='生产入库');if(existing)return existing;
 const material=productCodeForOrder(order),b={id:id('LOT'),material,group:'成品',qty:Number(qty),unit:'箱',received:today(),expiry:'',quality:'合格',order:order.id,source:'生产入库',counted:true};
 S.batches.unshift(b);ops().stock[material]=(ops().stock[material]||0)+Number(qty);
 S.ledger.unshift({id:id('LOG'),time:stamp(),ts:Date.now(),dept:'warehouse',type:'生产成品入库',ref:order.id,detail:`${material} +${qty} / ${b.id}`,by:me().name});S.ledger=S.ledger.slice(0,300);ctx.save();return b;
}
function qualityFlag(code,kind,record){let lot=getBatch(code);if(lot){lot.quality=kind;lot.note=record||'';}}
function nonconform(source,ref,material,reason,qty=0){if(S.ncr.some(n=>n.source===source&&n.ref===ref))return;S.ncr.unshift({id:id('NCR'),source,ref,material,reason,qty,status:'待处置',disposal:'',createdAt:stamp()});if(material)qualityFlag(material,'冻结','检验不合格')}
function syncFlowInspections(){for(const o of ctx.data.orders){const stage=ops().flows[o.id]?.stage;if(!['semi_qc','final_qc'].includes(stage))continue;let phase=stage==='semi_qc'?'半成品':'成品';if(S.inspections.some(x=>x.order===o.id&&x.phase===phase&&x.status==='待判定'))continue;
 // 原有流程判定可能已经完成；只有到达报检阶段且没有同阶段记录才生成。
 if(S.inspections.some(x=>x.order===o.id&&x.phase===phase&&x.status==='合格'))continue;
 S.inspections.unshift({id:id('QC'),order:o.id,phase,material:o.product,batch:'',status:'待判定',source:'生产报检',date:today()});}}
function supports(feature){return Object.prototype.hasOwnProperty.call(labels,feature)}
function render(feature){syncFlowInspections(); const f={overview:overviewPage,qaQc:qualityPage,workshop:workshopPage,warehouseOps:warehousePage,shift:shiftPage,hours:hoursPage,sop:standardsPage,settings:settingsPage}[feature];return f?f():''}
function pendingForDept(dept){const out=[];const push=(arr,feature,k,filter,title)=>{for(const r of arr.filter(filter))out.push({kind:'mod',feature,id:r.id,title,detail:r.reason||r.material||r.order||r.title||r.type||'',status:r.status})};
 if(dept==='quality'){push(S.inspections,'qaQc','inspection',r=>r.status==='待判定','报检待判定');push(S.cleanReports,'qaQc','clean',r=>r.status==='待判定','清洗待报检');push(S.ncr,'qaQc','ncr',r=>r.status==='待处置','不合格品待处置')}
 if(dept==='warehouse'){push(S.incoming,'warehouseOps','incoming',r=>!['已入库','已驳回'].includes(r.status),'到货待处理');push(S.materialRequests,'warehouseOps','request',r=>['待备料','待仓库签发','待仓库接收'].includes(r.status),'领退料待办理');push(S.outbound,'warehouseOps','outbound',r=>r.status==='待出库','成品待出库')}
 if(dept==='production')push(S.materialRequests,'workshop','request',r=>r.status==='待车间签收','车间到料待签收');
 if(dept==='pmc')push(S.roster,'shift','roster',r=>r.gate!=='已通过','开工前检查待完成');
 if(dept==='hr')push(S.disputes,'hours','dispute',r=>r.status==='待审批','工时申诉待审批');
 return out;}
function qualityPage(){const t=currentTab.qaQc||'decision';let content='',toolbar='';
 if(t==='decision'){
 toolbar=btn('新建报检单','form:inspection','','primary');
 content=note('含来料、半成品与成品')+grid(['报检单','来源','对象 / 订单','批次','状态','处理'],S.inspections.map(r=>row([`<b>${esc(r.id)}</b>`,esc(r.source),esc(r.material||r.order),esc(r.batch||'—'),status(r.status),r.status==='待判定'?btn('合格','qc:pass',r.id,'primary')+btn('不合格','qc:fail',r.id):esc(r.result||'已记录')])));
 }else if(t==='sampling'){
 toolbar=btn('发起抽检','form:sample','','primary');
 content=note('抽检异常自动生成不合格品处置单')+grid(['抽检单','抽检对象','项目','数量','结论','操作'],S.samples.map(r=>row([esc(r.id),esc(r.batch||r.material),esc(r.item),esc(r.qty),status(r.status),r.status==='待判定'?btn('合格','sample:pass',r.id,'primary')+btn('不合格','sample:fail',r.id):'—'])));
 }else if(t==='clean'){
 toolbar=btn('新建清洗报检','form:clean','','primary');
 content=note('清洗为独立非生产任务；检验通过后才能复核完工')+grid(['报检单','清洗工单','产线','结论','操作'],S.cleanReports.map(r=>row([`<b>${esc(r.id)}</b>`,esc(r.task),esc(r.line),status(r.status),r.status==='待判定'?btn('合格','clean:pass',r.id,'primary')+btn('不合格','clean:fail',r.id):'—'])));
 }else if(t==='ncr'){
 toolbar=btn('登记不合格品','form:ncr','','primary');
 content=note('隔离、返洗、返工、报废有独立处置记录')+grid(['处置单','来源','关联对象','问题','状态','操作'],S.ncr.map(r=>row([esc(r.id),esc(r.source),esc(r.ref),esc(r.reason),status(r.status),r.status==='待处置'?btn('处置','dispose',r.id,'primary'):esc(r.disposal||'—')])));
 }else{
 content=note('未经放行或冻结的批次不能参与正常发料')+grid(['批次号','物料','数量','有效期','质量状态','操作'],S.batches.map(r=>row([`<b>${esc(r.id)}</b>`,esc(r.material),money(r.qty)+' '+esc(r.unit||''),esc(r.expiry||'—'),status(r.quality),btn(r.quality==='冻结'?'解除冻结':'冻结批次','toggleFreeze',r.id)])));
 }
 const count=cards([['报检判定',S.inspections.filter(r=>r.status==='待判定').length,'待处理'],['抽检',S.samples.filter(r=>r.status==='待判定').length,'待处理'],['清洗报检',S.cleanReports.filter(r=>r.status==='待判定').length,'待处理'],['不合格品处置',S.ncr.filter(r=>r.status==='待处置').length,'待处理'],['质量库存',S.batches.filter(b=>b.quality==='冻结').length,'冻结批次']]);
 return wrap('qaQc','质量检验及审批','报检判定、抽检、清洗报检、不合格处置与质量库存',toolbar,content,count);
}
function workshopPage(){const t=currentTab.workshop||'request';let content='',tools='';
 if(t==='request'){
 tools=btn('车间发起领料','form:issue','','primary')+btn('结余退库','form:return');
 content=note('仓库签发和车间接收必须是不同人员的签名记录')+grid(['单号','分类','物料及批次','数量','关联订单','状态','动作'],S.materialRequests.map(r=>row([esc(r.id),esc(r.type),esc(r.material)+(r.batch?' / '+esc(r.batch):''),money(r.qty),esc(r.order||'—'),status(r.status),r.type==='领料'&&r.status==='待车间签收'?btn('车间签收','receiveShop',r.id,'primary'):'—'])));
 }else if(t==='doubleSign'){
 content=note('两个操作人、时间与数量写入同一领料单')+grid(['单号','仓库签发人','车间接收人','签发 / 接收时间','状态','操作'],S.materialRequests.filter(r=>r.type==='领料').map(r=>row([esc(r.id),esc(r.warehouseBy||'未签发'),esc(r.shopBy||'未签收'),esc([r.warehouseTime,r.shopTime].filter(Boolean).join(' / ')||'—'),status(r.status),r.status==='待车间签收'?btn('确认接收','receiveShop',r.id,'primary'):'—'])));
 }else if(t==='dispute'){
 content=note('审批后生成工时更正记录，原记录保留')+grid(['申诉单','员工','关联工时','说明','状态','操作'],S.disputes.map(r=>row([esc(r.id),esc(ctx.access.staff.find(p=>p.id===r.person)?.name||r.person),esc(r.hourId),esc(r.reason),status(r.status),r.status==='待审批'?btn('通过','appeal:approve',r.id,'primary')+btn('驳回','appeal:reject',r.id):'—'])));
 }else{
 tools=btn('发起返洗 / 返工','form:rework','','primary');
 content=note('返洗形成独立清洗工单；返工保留原批次和问题来源')+grid(['工单号','分类','关联对象','产线','执行状态','处理'],ctx.data.tasks.filter(x=>x.sourceNcr||x.rework).map(r=>row([esc(r.id),esc(r.type),esc(r.sourceNcr||r.rework),esc(r.line),status(r.status),btn('查看任务','goto:production:tasks')])));
 }
 return wrap('workshop','车间领料、接收与工时','领料单、双签、结余退库、工时申诉以及返洗返工',tools,content);
}
function warehousePage(){const t=currentTab.warehouseOps||'batches';let content='',tools='';
 if(t==='batches'){
 tools=btn('登记批次','form:batch','','primary');
 const summary=`<div class="mw-stock-snapshot">${snapshot.map(([name,batches,sum])=>`<div class="mw-snapshot"><span>${esc(name)}</span><strong>${esc(batches)}<small>批</small></strong><div>合计 ${esc(sum)}</div><small>近效期 0 · 冻结 0</small></div>`).join('')}</div><div class="mw-data-note">以上为提供的汇总快照，未包含明细、计量单位及流水，不参与下面的可发库存计算。</div>`;
 content=head('库存分组汇总','原辅料、品牌包材、非品牌包材、半成品、成品')+summary+head('实际批次台账','支持质量状态、效期预警和冻结')+grid(['批次号','物料','分类','数量','入库日期','有效期','质量状态','操作'],S.batches.map(b=>row([esc(b.id),esc(b.material),esc(b.group),money(b.qty)+' '+esc(b.unit),esc(b.received),esc(b.expiry||'—'),status(isExpired(b)?'已过期':isNear(b)?'近效期 · '+b.quality:b.quality),btn(b.quality==='冻结'?'解冻':'冻结','toggleFreeze',b.id)])));
 }else if(t==='incoming'){
 tools=btn('采购到货登记','form:incoming','','primary')+navButton('生产入库确认','warehouse','inventory');
 content=note('流程：来料比对 → 报检 → 合格入库；未经质检判定合格的来料不能确认入库')+grid(['到货单','采购单','物料 / 数量','供应商','状态','下一步'],S.incoming.map(r=>row([esc(r.id),esc(r.purchase),esc(r.material)+' / '+money(r.qty),esc(r.supplier),status(r.status),['待比对','比对差异'].includes(r.status)?btn('核对采购与实收','inbound:compare',r.id,'primary')+btn('修改实收','inbound:correct',r.id):r.status==='待报检'?btn('提交报检','inbound:inspect',r.id,'primary'):r.status==='待QC'?navButton('前往 QC','quality','qaQc'):r.status==='合格待入库'?btn('入库确认','inbound:store',r.id,'primary'):'—'])));
 }else if(t==='pick'){
 content=note('按同物料最早入库批次优先；冻结、待检或过期批次排除')+grid(['领料单','物料 / 数量','推荐批次','状态','操作'],S.materialRequests.filter(x=>x.type==='领料').map(r=>{const allocations=allocateFIFO(r.material,r.qty);return row([esc(r.id),esc(r.material)+' / '+money(r.qty),esc(r.allocations?.map(x=>x.id+' × '+x.qty).join('、')||allocations?.map(x=>x.id+' × '+x.qty).join('、')||'暂无合格批次'),status(r.status),r.status==='待备料'?btn('按 FIFO 备料','prepare',r.id,'primary'):r.status==='待仓库签发'?btn('仓库签发','issueStock',r.id,'primary'):'—'])}));
 }else if(t==='outbound'){
 tools=btn('新建成品出库单','form:outbound','','primary');
 content=note('成品出库只允许选择已完成并已入库的订单；确认出库时按该订单的成品批次扣减库存并写入收发流水。')+grid(['出库单','订单','客户 / 去向','数量','批次','状态','操作'],S.outbound.map(r=>row([esc(r.id),esc(r.order),esc(r.destination),money(r.qty)+' 箱',esc((r.allocations||[]).map(x=>x.id+' × '+x.qty).join('、')||'待分配'),status(r.status),r.status==='待出库'?btn('确认出库','shipOutbound',r.id,'primary'):'—'])));
 }else if(t==='returns'){
 content=note('退库确认后增加原批次结余并记录入库流水')+grid(['退库单','原批次','物料 / 数量','状态','操作'],S.materialRequests.filter(r=>r.type==='退库').map(r=>row([esc(r.id),esc(r.batch||'—'),esc(r.material)+' / '+money(r.qty),status(r.status),r.status==='待仓库接收'?btn('验收并退库','acceptReturn',r.id,'primary'):'—'])));
 }else{
 const month=today().slice(5,7),monthly=S.ledger.filter(x=>x.time.startsWith(month+'/'));
 const totals={};for(const l of monthly){if(!/质检入库|质量放行入账|双签并扣库|退库接收|成品销售出库/.test(l.type))continue;const m=l.detail.match(/^([A-Z]+-[0-9]+) ([+-][0-9.]+)/);if(!m)continue;totals[m[1]]??={incoming:0,outgoing:0};const val=Number(m[2]);if(val>0)totals[m[1]].incoming+=val;else totals[m[1]].outgoing-=val}
 const summary=Object.entries(totals).map(([code,x])=>{const end=ops().stock[code]||0,start=Math.max(0,end-x.incoming+x.outgoing);return row([esc(code),money(start),money(x.incoming),money(x.outgoing),money(end)])});
 content=head(today().slice(0,7)+' 收发存','按本月已确认出入库业务汇总，单位按物料主数据定义')+grid(['物料编码','期初','本月收入','本月发出','当前结存'],summary)+head('批次收发流水')+grid(['时间','业务','单据号','物料 / 数量','操作人'],monthly.filter(r=>/批次|入库|出库|发料|退库|到货|冻结|领料/.test(r.type)).map(r=>row([esc(r.time),esc(r.type),esc(r.ref),esc(r.detail),esc(r.by)])));
 }
 return wrap('warehouseOps','仓库批次、效期与收发存','来料比对、质量入库、FIFO 发料、退库和月末流水',tools,content);
}
function isExpired(b){return !!b.expiry&&b.expiry<today()}
function isNear(b){const lim=new Date(today()+'T00:00:00');lim.setDate(lim.getDate()+30);return !!b.expiry&&!isExpired(b)&&b.expiry<=lim.toISOString().slice(0,10)}
function allocateFIFO(material,qty){
 const sorted=[...S.batches].filter(b=>b.material===material&&b.quality==='合格'&&!isExpired(b)&&Number(b.qty)>0).sort((a,b)=>a.received.localeCompare(b.received)||a.id.localeCompare(b.id));
 let left=Number(qty),allocation=[];
 for(const b of sorted){const used=Math.min(left,Number(b.qty));if(used>0){allocation.push({id:b.id,qty:used});left-=used}if(left<=0)break}
 return left>0?null:allocation;
}
function nextBatch(material,qty){const allocated=allocateFIFO(material,qty);return allocated?.length?getBatch(allocated[0].id):null}
function validAllocations(request){return (request.allocations||[{id:request.batch,qty:request.qty}]).every(x=>{const b=getBatch(x.id);return b&&b.quality==='合格'&&!isExpired(b)&&b.qty>=Number(x.qty)})}

function shiftPage(){const t=currentTab.shift||'plan';let content='',tools='';
 if(t==='plan'){
 tools=btn('安排岗位班次','form:roster','','primary');
 content=note('按产线 × 岗位编排；检查技能、请假、工位撞班与开工前 Gate')+grid(['班次','日期','产线','岗位','员工','订单','开工前 Gate','操作'],S.roster.map(r=>row([`<b>${esc(r.id)}</b>`,esc(r.day+' '+r.start+'–'+r.end),esc(r.line),esc(r.position),esc(ctx.access.staff.find(x=>x.id===r.person)?.name||r.person),esc(r.order),status(r.gate||'待检查'),btn('检查开工条件','gate',r.id,'primary')])));
 }else if(t==='people'){
 content=note('按员工查看班次安排与工种')+grid(['员工','日期','工位','产线','班次','状态'],S.roster.map(r=>row([esc(ctx.access.staff.find(x=>x.id===r.person)?.name||r.person),esc(r.day),esc(r.position),esc(r.line),esc(r.start+'–'+r.end),status(r.gate||'待检查')])));
 }else if(t==='stats'){
 const passed=S.roster.filter(r=>r.gate==='已通过').length;
 content=cards([['排班记录',S.roster.length,'产线 × 岗位'],['开工前 Gate 通过',passed,'人员、资质、请假、清洗'],['确认工时',S.hours.filter(h=>h.status==='已确认').length,'计入统计'],['未确认工时',S.hours.filter(h=>h.status==='待确认').length,'暂不计入']])+head('班次统计明细')+grid(['产线','排班数','通过数','员工数'],[...new Set(S.roster.map(r=>r.line))].map(l=>{let a=S.roster.filter(r=>r.line===l);return row([esc(l),a.length,a.filter(x=>x.gate==='已通过').length,new Set(a.map(x=>x.person)).size])}));
 }else if(t==='products'){
 const confirms=S.hours.filter(h=>h.status==='已确认'&&h.order);
 const orders=[...new Set(confirms.map(h=>h.order))];
 content=note('只累计员工已确认的订单工时')+grid(['订单号','产品','确认工时（小时）','参与员工','状态'],orders.map(o=>{let a=confirms.filter(h=>h.order===o),obj=ctx.data.orders.find(x=>x.id===o);return row([esc(o),esc(obj?.product||'—'),money(a.reduce((sum,x)=>sum+Number(x.hours),0)),new Set(a.map(x=>x.person)).size,status(ops().flows[o]?.stage||'待处理')])}));
 }else{
 const list=S.hours.filter(h=>h.status==='已确认'&&h.order);
 content=note('按日期 / 订单汇总已确认工时')+grid(['日期','订单','已确认工时（小时）','工时类型'],[...new Set(list.map(h=>h.day+'|'+h.order))].map(k=>{let [day,order]=k.split('|'),xs=list.filter(h=>h.day===day&&h.order===order);return row([esc(day),esc(order),money(xs.reduce((a,b)=>a+Number(b.hours),0)),esc([...new Set(xs.map(x=>x.type))].join(' / '))])}));
 }
 return wrap('shift','排班与订单工时统计','产线 × 岗位、技能校验、请假影响、开工前 Gate',tools,content);
}
function hoursPage(){const t=currentTab.hours||'mine';let content='',tools='';const own=S.hours.filter(h=>h.person===me().id);
 if(t==='mine'){
 tools=btn('新增工时','form:hours','','primary')+btn('从排班生成工时','generateHours');
 content=note('本人确认后才会进入排班统计与订单产品统计')+cards([['待确认',own.filter(x=>x.status==='待确认').length,'按本人班次计算'],['已确认',money(own.filter(x=>x.status==='已确认').reduce((a,x)=>a+Number(x.hours),0)),'小时'],['管理岗工时',money(own.filter(x=>x.status==='已确认'&&x.type==='管理岗工时').reduce((a,x)=>a+Number(x.hours),0)),'小时'],['辅助工时',money(own.filter(x=>x.status==='已确认'&&x.type==='辅助工时').reduce((a,x)=>a+Number(x.hours),0)),'小时']])+grid(['工时单','日期 / 班制','类型','小时数','订单','状态','操作'],own.map(r=>row([esc(r.id),esc(r.day+' / '+(r.shift||'自报')),esc(r.type),money(r.hours),esc(r.order||'未关联'),status(r.status),r.status==='待确认'?btn('本人确认','confirmHours',r.id,'primary')+btn('提出申诉','appeal',r.id):btn('提出申诉','appeal',r.id)])));
 }else{
 tools=btn('提出申诉','appealLatest','','primary');
 content=note('保留原工时，审批记录可追溯')+grid(['申诉单','工时单','原因','状态','处理时间'],S.disputes.filter(r=>r.person===me().id).map(r=>row([esc(r.id),esc(r.hourId),esc(r.reason),status(r.status),esc(r.processedAt||'—')])));
 }
 return wrap('hours','我的工时','管理岗工时、辅助工时及按本人班制生成的工时',tools,content);
}
function standardsPage(){const t=currentTab.sop||'cards';let content='',tools='';
 if(t==='cards'){
 tools=btn('新建标准卡','form:sop','','primary');
 content=note('受控版本、岗位、工序、步骤和执行记录')+grid(['标准卡','工序','岗位 / 产线','版本','状态','操作'],S.standards.map(r=>row([`<b>${esc(r.id)}</b> · ${esc(r.title)}`,esc(r.process),esc(r.position+' / '+r.line),esc(r.version),status(r.status),r.status==='草稿'?btn('提交审核','sop:submit',r.id)+btn('复制编辑','sop:copy',r.id):r.status==='待审核'?btn('审核发布','sop:publish',r.id,'primary'):r.status==='已发布'?btn('执行确认','sop:execute',r.id,'primary')+btn('复制新版本','sop:copy',r.id):'—'])));
 }else{
 content=note('执行人、工序、签名和记录时间')+grid(['记录号','标准卡','员工','操作结果','执行时间'],S.executions.map(r=>row([esc(r.id),esc(r.card),esc(r.person),status(r.result),esc(r.at)])));
 }
 return wrap('sop','操作标准卡','标准作业指导书（SOP）的版本、审核、执行确认',tools,content);
}
function settingsPage(){const t=currentTab.settings||'org';let content='',tools='';
 if(t==='org'){
 content=note('岗位权限与个人追加权限取并集，一个员工可兼任多个岗位')+`<div class="mw-tiles">${navButton('员工权限矩阵','it','permissions')}${navButton('员工档案','it','employees')}${navButton('我的工时','hr','hours')}</div>`;
 }else if(t==='process'){
 const rows=[['cleanQC','清洗必须报检合格才能复核完成'],['requireDoubleSign','车间领料必须仓库签发与车间签收'],['fifo','仓库发料按最早合格批次先出'],['requireSkill','排班须核对岗位技能等级'],['requireLeave','排班须核对已批准请假']];
 content=note('修改需系统设置权限；流程规则影响对应业务校验')+`<div class="mw-rule-list">${rows.map(([k,label])=>`<div class="mw-rule"><span>${esc(label)}</span>${btn(S.rules[k]?'已启用':'已停用','rule',k,S.rules[k]?'primary':'')}</div>`).join('')}</div>`+`<div class="mw-tiles">${navButton('工艺模板','tech','templates')}${navButton('操作标准卡','tech','sop')}${navButton('生产排程','pmc','schedule')}</div>`;
 }else if(t==='product'){
 content=note('产品、物料主数据，成品与半成品 BOM、产线关系')+`<div class="mw-tiles">${navButton('产品与产线','tech','catalog')}${navButton('BOM 关系','tech','bom')}${navButton('批次台账','warehouse','warehouseOps')}</div>`;
 }else{
 tools=btn('新增字典项','form:dictionary','','primary');
 content=note('按类型管理启用与停用，保留历史记录')+grid(['编号','分类','字典项','取值','状态','操作'],S.dictionary.map(r=>row([esc(r.id),esc(r.group),esc(r.name),esc(r.value),status(r.active?'已启用':'已停用'),btn(r.active?'停用':'启用','dictionary:toggle',r.id)])));
 }
 return wrap('settings','系统设置','权限与组织、流程与工艺、产品与物料、基础字典',tools,content);
}
function globalAuditTable(){
 const opLogs=(ctx.data.ops?.logs||[]).map(x=>({when:x.at,ts:x.ts||0,dept:x.dept||'',action:x.action,ref:x.ref,person:x.person,source:'操作'}));
 const moduleLogs=S.ledger.map(x=>({when:x.time,ts:x.ts||0,dept:x.dept||'',action:x.type,ref:x.ref,person:x.by,source:'单据'}));
 const all=[...opLogs,...moduleLogs].sort((a,b)=>b.ts-a.ts).slice(0,30);
 const deptName=dept=>ctx.access?.departments?.find?.(d=>d.id===dept)?.name||({sales:'销售部',pmc:'生产计划与物料控制部（PMC）',production:'生产车间',quality:'质量部 QA / QC',warehouse:'仓库 / 物流部',purchase:'采购 / 供应链部',hr:'人事行政办公室',finance:'财务部',it:'信息化 / 主数据管理',tech:'工艺技术部',leadership:'总经办',engineering:'设备工程部',ehs:'EHS 安全环保部'}[dept]||'—');
 return grid(['时间','处理部门','操作','单据编号','操作人'],all.map(x=>row([esc(x.when||'—'),esc(deptName(x.dept)),`<strong>${esc(x.action)}</strong>`,esc(x.ref||'—'),esc(x.person||'—')])));
}
function overviewPage(){const stages=ops().flows||{},activeOrders=ctx.data.orders.filter(o=>stages[o.id]?.stage!=='stored'),historyOrders=ctx.data.orders.filter(o=>stages[o.id]?.stage==='stored');const totals=activeOrders.length,started=activeOrders.filter(o=>stagesOrder.indexOf(stages[o.id]?.stage)>=stagesOrder.indexOf('issued')).length;
 const pending=S.inspections.filter(r=>r.status==='待判定').length+S.cleanReports.filter(r=>r.status==='待判定').length;
 const ready=S.materialRequests.filter(r=>r.status==='待备料').length, gates=S.roster.filter(r=>r.gate==='已通过').length;
 const current=activeOrders.map(o=>{const f=stages[o.id];return row([esc(o.id),esc(o.product),status(f?.stage||o.status),btn('查看流程','goto:sales:orders')])});
 const content=cards([['进行中订单',totals,'首页只显示未完结订单'],['已开始生产',started,'含执行及后续阶段'],['待检与清洗报检',pending,'质量任务'],['待备料',ready,'车间领料单'],['开工前 Gate 通过',gates,'产线 × 岗位']])+
 `<div class="mw-tiles mw-quick">${navButton('生产排程甘特图','pmc','schedule')}${navButton('QA/QC 审批','quality','qaQc')}${navButton('车间管理','production','workshop')}${navButton('仓库管理','warehouse','warehouseOps')}${navButton('历史订单','sales','orderHistory')}${navButton('排班','pmc','shift')}${navButton('系统设置','it','settings')}</div>`+
 head('进行中订单',`${historyOrders.length} 张已完结订单已自动归档到销售部 → 历史订单`)+grid(['订单号','产品','当前阶段','入口'],current)+
 head('全厂最近操作记录','全厂统一查看；每张订单的完整历史在订单流程详情')+globalAuditTable();
 return wrap('overview','工厂运行总览','订单、产线、质量、仓储、排班与已确认工时的共同视图','',content);
}
function showForm(kind,record=''){
 const fields={
 inspection:()=>field('phase','检验阶段','select','来料',['来料','半成品','成品'])+field('order','关联订单','select',ctx.data.orders[0]?.id||'',orderOptions())+field('material','报检物料 / 对象','text','RM-001')+field('batch','关联批次 / 备注','text','待分配'),
 sample:()=>field('batch','抽检批次','select',S.batches[0]?.id||'无批次',S.batches.length?S.batches.map(b=>[b.id,b.id+' / '+b.material]):[['无批次','尚无批次']])+field('item','抽检项目','select','外观',['外观','包装完整性','理化指标','重量偏差'])+field('qty','抽检数量','number',1),
 clean:()=>field('task','清洗工单','select',taskOptions('清洗')[0]?.[0]||'',taskOptions('清洗'))+field('remark','检查项目与记录','text','清场、设备表面和残留检查'),
 ncr:()=>field('source','来源','select','现场发现',['现场发现','抽检','报检','清洗报检'])+field('ref','关联单号','text','现场记录')+field('material','物料 / 批次','text','待确认')+field('reason','不合格原因','textarea','现场异常待核实'),
 batch:()=>field('material','物料编码','select','RM-001',materialOptions())+field('group','批次分类','select','原辅料',['原辅料','品牌包材','非品牌包材','半成品','成品'])+field('qty','入库数量','number',100)+field('unit','单位','select','kg',['kg','L','桶','箱','个'])+field('received','实际入库日期','date',today())+field('expiry','有效期截止日期','date',new Date(Date.now()+365*864e5).toISOString().slice(0,10))+field('quality','质量状态','select','待检',['待检','合格','冻结']),
 incoming:()=>field('purchase','采购单','select',ops().purchases.find(x=>x.status==='待到货')?.id||'',ops().purchases.filter(x=>x.status==='待到货').map(x=>[x.id,`${x.id} · ${x.material} · ${x.qty}`]))+field('actualMaterial','实际物料编码','select',ops().purchases.find(x=>x.status==='待到货')?.material||'RM-001',materialOptions())+field('actualQty','实收数量','number',ops().purchases.find(x=>x.status==='待到货')?.qty||1)+field('supplierLot','供应商批次','text','待填写')+field('received','到货日期','date',today())+field('expiry','有效期','date',new Date(Date.now()+365*864e5).toISOString().slice(0,10)),
 outbound:()=>field('order','已完结订单','select',completedOrderOptions()[0]?.[0]||'',completedOrderOptions())+field('qty','出库数量（箱）','number',1)+field('destination','客户 / 去向','text','客户收货'),
 issue:()=>field('material','领料物料','select','RM-001',materialOptions())+field('qty','领料数量','number',10)+field('order','对应订单','select',ctx.data.orders[0]?.id||'',orderOptions())+field('line','领用产线','select','L01 配制一线',['L01 配制一线','L02 配制二线','S03-4# 瓶装线','S04 包装二线']),
 return:()=>field('source','关联已接收领料单','select',S.materialRequests.find(r=>r.status==='已双签')?.id||'',S.materialRequests.filter(r=>r.status==='已双签').map(r=>[r.id,`${r.id} · ${r.material}`]))+field('batch','结余所在批次','select',S.batches[0]?.id||'',S.batches.map(b=>[b.id,b.id+' · '+b.material]))+field('qty','结余数量','number',1)+field('reason','退库原因','text','生产结余'),
 reconcile:()=>field('actualMaterial','实物编码','select',getReceipt(record)?.actualMaterial||'RM-001',materialOptions())+field('actualQty','实收数量','number',getReceipt(record)?.actualQty||1),
 rework:()=>field('type','工单类型','select','返洗',['返洗','返工'])+field('source','关联异常单号','select',S.ncr[0]?.id||'现场异常',S.ncr.length?S.ncr.map(x=>[x.id,x.id+' · '+x.reason]):[['现场异常','现场异常']])+field('line','执行产线','select','L01 配制一线',['L01 配制一线','L02 配制二线','S03-4# 瓶装线','S04 包装二线']),
 roster:()=>field('day','排班日期','date',today())+field('line','生产线','select','L01 配制一线',['L01 配制一线','L02 配制二线','S03-4# 瓶装线','S04 包装二线'])+field('position','岗位','select','配料',['配料','搅拌','灌装','包装','清洗','调机调线'])+field('person','员工','select','E002',staffOptions())+field('order','订单产品','select',ctx.data.orders[0]?.id||'',orderOptions())+field('shift','班制','select','日班',['日班','夜班'])+field('start','开始时间','time','08:00')+field('end','结束时间','time','16:00'),
 hours:()=>field('day','工时日期','date',today())+field('type','工时类型','select','辅助工时',['辅助工时','管理岗工时','生产工时'])+field('hours','工时小时数','number',2)+field('order','关联订单','select','无', [['无','不关联订单'],...orderOptions()])+field('reason','工作内容','text','协助生产现场'),
 appeal:()=>field('reason','申诉原因','textarea','工时核算有差异，请复核。')+field('proposed','申请更正小时数','number',1),
 sop:()=>field('title','标准卡名称','text','清洗操作标准卡')+field('process','生产工序','select','清洗',['清洗','调机调线','配制','包装','检验'])+field('line','适用产线','select','L01 配制一线',['L01 配制一线','L02 配制二线','S03-4# 瓶装线','S04 包装二线'])+field('position','适用岗位','select','清洗',['配料','搅拌','灌装','包装','清洗','调机调线','检验员'])+field('steps','操作步骤（以分号分隔）','textarea','核对设备状态；核对清洗记录；执行清洗；填写结果；复核签名')+field('version','版本','text','v1.0'),
 dictionary:()=>field('group','字典类别','select','班次',['班次','工种','物料分类','检验项目','退库原因','设备状态'])+field('name','名称','text','新增项目')+field('value','取值 / 说明','text','填写配置值')
 };
 if(!fields[kind])return false;
 if(['clean','incoming','outbound','return'].includes(kind)){
  if(kind==='clean'&&!taskOptions('清洗').length)return fail('暂无清洗工单，请先在生产任务中创建。');
  if(kind==='incoming'&&!ops().purchases.some(x=>x.status==='待到货'))return fail('没有已审批待到货的采购单，请先完成采购审批。');
  if(kind==='outbound'&&!completedOrderOptions().length)return fail('当前没有已完结并已入库的订单可建立成品出库单。');
  if(kind==='return'&&!S.materialRequests.some(r=>r.status==='已双签'))return fail('暂无已完成双签的领料单，无法登记结余退库。');
 }
 if(kind==='inspection'&&!ctx.data.orders.length)return fail('尚无关联订单');
 modal(({inspection:'新建报检单',sample:'发起抽检',clean:'清洗报检',ncr:'登记不合格品',batch:'登记仓库批次',incoming:'采购到货与供应商批次',outbound:'新建成品出库单',reconcile:'修改实收数量与物料',issue:'车间发起领料',return:'结余退库申请',rework:'发起返洗 / 返工',roster:'产线岗位排班',hours:'新增本人工时',appeal:'工时申诉',sop:'创建受控操作标准卡',dictionary:'新增基础字典项'})[kind],fields[kind](),{kind,record});return true;
}
function handleClick(node){const a=node.dataset.moduleAction||'',key=node.dataset.mid||'';
 if(a==='closeModal'){close();return true}
 if(a==='tab'){let [page,t]=key.split(':');currentTab[page]=t;message='';ctx.render();return true}
 if(a==='navigate'||a.startsWith('goto:')){let [,dept,feature]=a.startsWith('goto:')?a.split(':'):['',...key.split(':')];ctx.openFeature(feature,dept,node);return true}
 if(a.startsWith('form:')){const kind=a.slice(5),perm={inspection:['quality','qaQc','create'],sample:['quality','qaQc','create'],clean:['quality','qaQc','create'],ncr:['quality','qaQc','create'],batch:['warehouse','warehouseOps','create'],incoming:['warehouse','warehouseOps','create'],outbound:['warehouse','warehouseOps','create'],issue:['production','workshop','create'],return:['production','workshop','create'],rework:['production','workshop','create'],roster:['pmc','shift','edit'],hours:['hr','hours','create'],sop:['tech','sop','create'],dictionary:['it','settings','config']}[kind];if(perm&&!check(...perm))return true;showForm(kind,key);return true}
 const actionPermissions={qc:['quality','qaQc','approve'],sample:['quality','qaQc','approve'],clean:['quality','qaQc','approve'],dispose:['quality','qaQc','approve'],toggleFreeze:['quality','qaQc','approve'],inbound:['warehouse','warehouseOps','execute'],prepare:['warehouse','warehouseOps','execute'],issueStock:['warehouse','warehouseOps','execute'],shipOutbound:['warehouse','warehouseOps','execute'],receiveShop:['production','workshop','execute'],acceptReturn:['warehouse','warehouseOps','execute'],appeal:['production','workshop','approve'],gate:['pmc','shift','approve'],sop:['tech','sop','approve'],dictionary:['it','settings','config'],rule:['it','settings','config']};
 const tag=a.split(':')[0],perm=actionPermissions[tag];if(perm&&!check(...perm))return true;
 if(a==='generateHours'){if(!check('hr','hours','create'))return true;const mine=S.roster.filter(x=>x.person===me().id);let n=0;for(const r of mine){if(S.hours.some(h=>h.roster===r.id))continue;const ms=new Date('2026-01-01T'+r.end)-new Date('2026-01-01T'+r.start);let h=ms>0?ms/36e5:ms/36e5+24;S.hours.unshift({id:id('WH'),day:r.day,person:me().id,type:'生产工时',hours:h,order:r.order,shift:r.shift,roster:r.id,status:'待确认',note:r.line+' / '+r.position});n++}audit('生成排班工时',me().id,`${n} 条`);save(n?`已生成 ${n} 条待确认工时。`:'没有新增班次工时，请先在排班页面安排本人岗位。');return true}
 if(a==='confirmHours'){const h=S.hours.find(x=>x.id===key);if(!h||h.person!==me().id||h.status!=='待确认')return fail('仅能确认本人的待确认工时。');h.status='已确认';h.confirmedAt=stamp();audit('本人确认工时',h.id,`${h.hours} 小时`);save('工时已确认，现可进入订单产品统计。');return true}
 if(a==='appeal'||a==='appealLatest'){const h=S.hours.find(x=>x.id===key&&x.person===me().id)||S.hours.find(x=>x.person===me().id);if(!h)return fail('请先生成或新增本人工时。');showForm('appeal',h.id);return true}
 if(a.startsWith('qc:')){const r=S.inspections.find(x=>x.id===key);if(!r||r.status!=='待判定')return false;r.status=a.endsWith(':pass')?'合格':'不合格';r.result=me().name+' · '+stamp();const checkedLot=getBatch(r.batch);if(checkedLot&&r.status==='合格'){checkedLot.quality='合格';if(!checkedLot.counted){ops().stock[checkedLot.material]=(ops().stock[checkedLot.material]||0)+Number(checkedLot.qty);checkedLot.counted=true;audit('批次质量放行入账',checkedLot.id,`${checkedLot.material} +${checkedLot.qty}`)}}if(r.incoming){const rec=getReceipt(r.incoming);if(rec)rec.status=r.status==='合格'?'合格待入库':'不合格'}if(r.status==='不合格')nonconform('报检',r.id,r.batch,r.material);audit('报检判定',r.id,r.status);
  // 保持此前订单流程同步：QC 合格进入后续质量放行环节。
  const st=ops().flows[r.order]?.stage;const flow=r.status==='合格'?(st==='semi_qc'?'semiPass':st==='final_qc'?'finalPass':''):(st==='semi_qc'?'semiFail':st==='final_qc'?'finalFail':'');
  if(flow&&r.phase!=='来料'){ctx.ops.handleClick({dataset:{opAction:'flow:'+flow,opId:r.order}})}else save('报检判定已保存。');return true;
 }
 if(a.startsWith('sample:')){const r=S.samples.find(x=>x.id===key);if(!r||r.status!=='待判定')return false;r.status=a.endsWith(':pass')?'合格':'不合格';const lot=getBatch(r.batch);if(lot&&r.status==='合格'){lot.quality='合格';if(!lot.counted){ops().stock[lot.material]=(ops().stock[lot.material]||0)+Number(lot.qty);lot.counted=true;audit('批次质量放行入账',lot.id,`${lot.material} +${lot.qty}`)}}if(r.status==='不合格')nonconform('抽检',r.id,r.batch,`${r.item}不合格`,r.qty);audit('抽检判定',r.id,r.status);save('抽检判定已保存。');return true}
 if(a.startsWith('clean:')){const r=S.cleanReports.find(x=>x.id===key);if(!r||r.status!=='待判定')return false;r.status=a.endsWith(':pass')?'合格':'不合格';if(r.status==='不合格')nonconform('清洗报检',r.task,'',`${r.task} 清洗不合格`);audit('清洗报检判定',r.task,r.status);save('清洗检验结果已保存。');return true}
 if(a==='dispose'){const r=S.ncr.find(x=>x.id===key);if(!r)return false;modal('不合格品处置 · '+key,field('disposal','处置方式','select','隔离',['隔离','返洗','返工','报废'])+field('reason','处置依据','textarea',r.reason),{kind:'dispose',record:key});return true}
 if(a==='toggleFreeze'){const b=getBatch(key);if(!b)return false;b.quality=b.quality==='冻结'?'待检':'冻结';audit('质量库存状态调整',b.id,b.quality);save('批次质量状态已更新；解冻后仍需检验放行。');return true}
 if(a.startsWith('inbound:')){const rec=getReceipt(key);if(!rec)return false;const op=a.split(':')[1];if(op==='compare'&&['待比对','比对差异'].includes(rec.status)){if(rec.actualMaterial!==rec.material||Number(rec.actualQty)!==Number(rec.qty)){rec.status='比对差异';audit('来料比对发现差异',rec.id,`采购 ${rec.material} × ${rec.qty}，实到 ${rec.actualMaterial} × ${rec.actualQty}`);return save('来料与采购单不一致，请核查差异并修改实收信息。'),true}rec.status='待报检';audit('来料比对一致',rec.id,rec.material);return save('已核对来料，等待 QC 报检。'),true}
  if(op==='correct'&&['待比对','比对差异'].includes(rec.status)){showForm('reconcile',rec.id);return true}
  if(op==='inspect'&&rec.status==='待报检'){rec.status='待QC';S.inspections.unshift({id:id('IQC'),phase:'来料',source:'采购到货',material:rec.material,batch:rec.supplierLot,order:'',incoming:rec.id,status:'待判定',date:today()});audit('来料申请报检',rec.id,rec.material);return save('已创建来料 QC 报检单。'),true}
  if(op==='store'&&rec.status==='合格待入库'){const purchase=ops().purchases.find(p=>p.id===rec.purchase);if(purchase?.status==='已入库')return fail('该采购单已入库，不能重复收货。');const bid=id('LOT');S.batches.unshift({id:bid,material:rec.material,group:rec.material.startsWith('PK-')?'非品牌包材':'原辅料',qty:Number(rec.qty),unit:rec.material.startsWith('PK-')?'个':'kg',received:rec.received,expiry:rec.expiry,quality:'合格',supplierLot:rec.supplierLot});ops().stock[rec.material]=(ops().stock[rec.material]||0)+Number(rec.qty);rec.status='已入库';rec.batch=bid;if(purchase)purchase.status='已入库';audit('采购到货质检入库',rec.id,`${rec.material} +${rec.qty}，批次 ${bid}`);return save(`已确认入库，生成批次 ${bid}。`),true}
  return fail('到货状态不允许此操作。');}
 if(a==='prepare'){const r=getRequest(key);if(!r||r.status!=='待备料')return false;const allocations=allocateFIFO(r.material,r.qty);if(!allocations)return fail('合格、未冻结、未过期批次合计数量不足，请先报检入库。');r.allocations=allocations;r.batch=allocations[0].id;r.status='待仓库签发';audit('按 FIFO 完成备料',r.id,allocations.map(x=>x.id+' × '+x.qty).join('、'));save(`已依入库先后分配 ${allocations.length} 个批次，等待仓库签发。`);return true}
 if(a==='issueStock'){const r=getRequest(key);if(!r||r.status!=='待仓库签发')return false;if(!validAllocations(r))return fail('至少一个备料批次不再可用，请重新核查库存。');r.status='待车间签收';r.warehouseBy=me().id;r.warehouseName=me().name;r.warehouseTime=stamp();audit('仓库签发',r.id,`${r.material} ${r.qty} / ${r.allocations.map(x=>x.id).join('、')}`);save('仓库签发完成，等待车间人员双签接收。');return true}
 if(a==='shipOutbound'){const r=S.outbound.find(x=>x.id===key);if(!r||r.status!=='待出库')return false;if(!(r.allocations||[]).length)return fail('出库单没有分配批次。');for(const x of r.allocations){const b=getBatch(x.id);if(!b||b.quality!=='合格'||Number(b.qty)<Number(x.qty))return fail('成品批次库存或质量状态已变化，请重新创建出库单。')}for(const x of r.allocations)getBatch(x.id).qty-=Number(x.qty);ops().stock[r.material]=Math.max(0,(ops().stock[r.material]||0)-Number(r.qty));r.status='已出库';r.shippedBy=me().name;r.shippedAt=stamp();audit('成品销售出库',r.id,`${r.material} -${r.qty} / 订单 ${r.order} / ${r.allocations.map(x=>x.id+' × '+x.qty).join('、')}`);save('成品已按批次确认出库，库存与收发流水已更新。');return true}
 if(a==='receiveShop'){const r=getRequest(key);if(!r||r.status!=='待车间签收')return false;if(S.rules.requireDoubleSign&&r.warehouseBy===me().id)return fail('仓库签发人不能替代车间接收人，请切换到另一名员工签收。');if(!validAllocations(r))return fail('签收前发现批次库存或质量状态异常，不能完成交接。');r.status='已双签';r.shopBy=me().id;r.shopName=me().name;r.shopTime=stamp();for(const x of r.allocations){getBatch(x.id).qty-=Number(x.qty)}ops().stock[r.material]=Math.max(0,(ops().stock[r.material]||0)-Number(r.qty));audit('车间接收双签并扣库',r.id,`${r.material} -${r.qty} / ${r.allocations.map(x=>x.id+' × '+x.qty).join('、')}`);save('双签完成，材料按批次扣减并留存流水。');return true}
 if(a==='acceptReturn'){const r=getRequest(key);if(!r||r.status!=='待仓库接收')return false;const b=getBatch(r.batch);if(!b)return fail('原批次不存在，不能直接增加库存。');b.qty+=Number(r.qty);ops().stock[r.material]=(ops().stock[r.material]||0)+Number(r.qty);r.status='已退库';r.receivedBy=me().name;r.receivedAt=stamp();audit('结余退库接收',r.id,`${r.material} +${r.qty} / ${b.id}`);save('结余已退回原批次，库存更新。');return true}
 if(a.startsWith('appeal:')){const r=S.disputes.find(x=>x.id===key);if(!r||r.status!=='待审批')return false;r.status=a.endsWith('approve')?'已通过':'已驳回';r.processedAt=stamp();r.approver=me().name;if(r.status==='已通过'){const h=S.hours.find(x=>x.id===r.hourId);if(h){h.hours=Number(r.proposed);h.status='待确认';h.note='申诉复核后待本人再次确认'}}audit('工时申诉审批',r.id,r.status);save('申诉结果已保存。');return true}
 if(a==='gate'){gate(key);return true}
 if(a.startsWith('sop:')){const r=S.standards.find(x=>x.id===key);if(!r)return false;const verb=a.split(':')[1];if(verb==='copy'){showForm('sop');return true}if(verb==='execute'){modal('操作标准卡执行 · '+r.title,`<div class="mw-steps"><strong>受控版本 ${esc(r.version)}</strong>${r.steps.split('；').map((x,i)=>`<label><input type="checkbox" name="step-${i}" required> ${esc(x)}</label>`).join('')}</div>`,{kind:'executeSop',record:r.id});return true}if(verb==='submit'&&r.status==='草稿')r.status='待审核';if(verb==='publish'&&r.status==='待审核')r.status='已发布';r.lastBy=me().name;audit('操作标准卡'+verb,r.id,r.status);save('操作标准卡状态已更新。');return true}
 if(a==='rule'){S.rules[key]=!S.rules[key];audit('修改流程设置',key,S.rules[key]?'启用':'停用');save('流程配置已保存。');return true}
 if(a==='dictionary:toggle'){const r=S.dictionary.find(x=>x.id===key);if(!r)return false;r.active=!r.active;audit('字典项'+(r.active?'启用':'停用'),key,r.name);save('字典项已更新。');return true}
 return false;
}
const shiftPeriod=r=>{const start=new Date(r.day+'T'+r.start+':00').getTime();let end=new Date(r.day+'T'+r.end+':00').getTime();if(end<=start)end+=86400000;return {start,end}};
const shiftsOverlap=(a,b)=>{const x=shiftPeriod(a),y=shiftPeriod(b);return x.start<y.end&&y.start<x.end};
function gate(idValue){const r=S.roster.find(x=>x.id===idValue);if(!r)return;const problems=[];
 const skill=ops().skills?.[r.person]?.[r.position];if(S.rules.requireSkill&&(!skill||Number(skill.slice(1))<2))problems.push(`${r.position} 技能未达到 L2`);
 const employee=ctx.access.staff.find(p=>p.id===r.person);
 if(S.rules.requireLeave&&ctx.data.leaves.some(l=>l.person===employee?.name&&l.status==='审核通过'&&l.range?.split(' ~ ')[0]<=r.day&&l.range?.split(' ~ ')[1]>=r.day))problems.push('员工当日存在已批准请假');
 const stage=ops().flows?.[r.order]?.stage;
 if(stage&&stagesOrder.indexOf(stage)<stagesOrder.indexOf('formal'))problems.push('订单尚未发布正式排程');
 if(S.rules.cleanQC&&['配料','搅拌'].includes(r.position)&&!S.cleanReports.some(x=>x.status==='合格'&&ctx.data.tasks.some(t=>t.id===x.task&&t.line===r.line)))problems.push('产线清洗报检尚未合格');
 const conflict=S.roster.find(x=>x.id!==r.id&&x.day===r.day&&(x.line===r.line&&x.position===r.position||x.person===r.person)&&shiftsOverlap(r,x));if(conflict)problems.push('岗位或员工存在时间撞班 '+conflict.id);
 r.gate=problems.length?'未通过':'已通过';r.gateNote=problems.join('；')||'技能、请假、排程、清洗均已通过';r.checkedAt=stamp();audit('开工前 Gate 检查',r.id,r.gate+' · '+r.gateNote);save(problems.length?'未通过：'+r.gateNote:'开工前 Gate 检查通过。');}
function submitForm(ev){if(ev.target.id!=='module-form')return false;ev.preventDefault();const values=Object.fromEntries(new FormData(ev.target).entries());const kind=form?.kind,ref=form?.record;
 try{
 if(kind==='inspection'){S.inspections.unshift({id:id('QC'),source:'人工报检',phase:values.phase,order:values.order,material:values.material,batch:values.batch,status:'待判定',date:today()});audit('创建报检单',values.order,values.phase);return done('报检单已提交，等待质量判定。'),true}
 if(kind==='sample'){if(values.batch==='无批次')return fail('请先登记实际批次，才能对批次进行抽检。');S.samples.unshift({id:id('SP'),batch:values.batch,item:values.item,qty:Number(values.qty),status:'待判定'});return done('抽检单已提交。'),true}
 if(kind==='clean'){if(S.cleanReports.some(r=>r.task===values.task&&r.status==='待判定'))return fail('该清洗工单已有未判定报检单。');const task=ctx.data.tasks.find(t=>t.id===values.task);if(!task)return fail('清洗工单不存在');S.cleanReports.unshift({id:id('CLQC'),task:task.id,line:task.line,remark:values.remark,status:'待判定'});audit('清洗报检提交',task.id,task.line);return done('清洗报检单已创建，等待 QC 判定。'),true}
 if(kind==='ncr'){nonconform(values.source,values.ref,values.material,values.reason);return done('不合格品处置单已登记。'),true}
 if(kind==='batch'){if(values.quality==='合格')return fail('不能手动跳过报检将批次设为合格，请选择待检并完成 QC 判定。');let q=Number(values.qty);if(q<=0)return fail('批次数量必须大于 0');const b={id:id('LOT'),material:values.material,group:values.group,qty:q,unit:values.unit,received:values.received,expiry:values.expiry,quality:values.quality};S.batches.unshift(b);audit('手工批次登记',b.id,`${b.material} +${q}，质量待检`);return done('批次已登记但尚不能发料；需要 QC 放行。'),true}
 if(kind==='incoming'){const p=ops().purchases.find(p=>p.id===values.purchase);if(!p||p.status!=='待到货')return fail('采购单没有达到待到货状态。');if(S.incoming.some(x=>x.purchase===p.id&&!['已驳回'].includes(x.status)))return fail('这张采购单已有对应到货记录，不能重复建单。');const rec={id:id('IN'),purchase:p.id,material:p.material,qty:Number(p.qty),supplier:p.supplier,supplierLot:values.supplierLot,actualMaterial:values.actualMaterial,actualQty:Number(values.actualQty),received:values.received,expiry:values.expiry,status:'待比对'};S.incoming.unshift(rec);audit('采购到货登记',rec.id,rec.material);return done('已登记供应商到货，待核对采购单和实际来料。'),true}
 if(kind==='outbound'){const order=ctx.data.orders.find(o=>o.id===values.order);if(!order||ops().flows?.[order.id]?.stage!=='stored')return fail('只能为已完成并已入库的订单建立成品出库单。');const qty=Number(values.qty);if(qty<=0)return fail('出库数量必须大于 0。');const allocations=allocateFinished(order.id,qty);if(!allocations)return fail('该订单的可用成品批次数量不足，不能创建出库单。');const r={id:id('OB'),order:order.id,material:productCodeForOrder(order),qty,destination:values.destination,allocations,status:'待出库',createdBy:me().name,createdAt:stamp()};S.outbound.unshift(r);audit('成品出库单创建',r.id,`${r.material} ${qty} / 订单 ${order.id}`);return done('成品出库单已创建，等待仓库确认出库。'),true}
 if(kind==='reconcile'){const rec=getReceipt(ref);if(!rec||!['待比对','比对差异'].includes(rec.status))return fail('到货单已进入下一阶段，不能改实收信息。');rec.actualMaterial=values.actualMaterial;rec.actualQty=Number(values.actualQty);rec.status='待比对';audit('更正来料实收',rec.id,`${rec.actualMaterial} × ${rec.actualQty}`);return done('实收已更新，请重新执行来料比对。'),true}
 if(kind==='issue'){const n=Number(values.qty);if(n<=0)return fail('数量必须大于零。');const r={id:id('MR'),type:'领料',material:values.material,qty:n,order:values.order,line:values.line,status:'待备料',requestBy:me().name,requestedAt:stamp()};S.materialRequests.unshift(r);audit('车间领料申请',r.id,`${r.material} ${n}`);return done('领料单已创建，等待仓库 FIFO 备料。'),true}
 if(kind==='return'){const orig=getRequest(values.source);if(!orig||orig.status!=='已双签')return fail('只能对已完成双签的领料单退库。');const amount=Number(values.qty),alloc=(orig.allocations||[{id:orig.batch,qty:orig.qty}]).find(x=>x.id===values.batch);if(!alloc)return fail('退库批次必须来自此领料单已经签收的实际批次。');const used=S.materialRequests.filter(r=>r.type==='退库'&&r.source===orig.id&&r.batch===values.batch&&!['已取消','已拒绝'].includes(r.status)).reduce((a,x)=>a+Number(x.qty),0);if(amount<=0||amount+used>alloc.qty)return fail('退库数量超过该物料批次的可退结余。');const r={id:id('RT'),type:'退库',source:orig.id,batch:values.batch,material:orig.material,qty:amount,order:orig.order,reason:values.reason,status:'待仓库接收'};S.materialRequests.unshift(r);audit('结余退库申请',r.id,`${r.material} ${r.qty}`);return done('退库申请已提交，等待仓库接收。'),true}
 if(kind==='rework'){const type=values.type==='返洗'?'清洗':'配制',r={id:id(values.type==='返洗'?'RC':'RW'),type,line:values.line,category:values.type==='返洗'?'非生产任务':'生产任务',sourceNcr:values.source,status:'待开始'};ctx.data.tasks.unshift(r);audit('返洗 / 返工任务创建',r.id,values.source);return done('已生成独立'+values.type+'任务单。'),true}
 if(kind==='roster'){if(values.start===values.end)return fail('开始与结束时间不能相同。');const r={id:id('SH'),day:values.day,line:values.line,position:values.position,person:values.person,order:values.order,shift:values.shift,start:values.start,end:values.end,gate:'待检查'};if(S.roster.some(x=>x.day===r.day&&x.line===r.line&&x.position===r.position&&shiftsOverlap(r,x)))return fail('同一产线、岗位、时间已安排其他员工。');if(S.roster.some(x=>x.day===r.day&&x.person===r.person&&shiftsOverlap(r,x)))return fail('该员工在同一时间已有其他排班。');S.roster.unshift(r);audit('岗位排班',r.id,`${r.line} / ${r.position} / ${r.person}`);return done('已加入排班草案，请执行开工前 Gate 校验。'),true}
 if(kind==='hours'){const h={id:id('WH'),person:me().id,day:values.day,type:values.type,hours:Number(values.hours),order:values.order==='无'?'':values.order,shift:'自报',status:'待确认',note:values.reason};S.hours.unshift(h);audit('填报工时',h.id,`${h.hours} 小时`);return done('本人工时已填报，须本人确认后才能进入统计。'),true}
 if(kind==='appeal'){const h=S.hours.find(x=>x.id===ref&&x.person===me().id);if(!h)return fail('只能对本人工时申诉。');if(S.disputes.some(x=>x.hourId===h.id&&x.status==='待审批'))return fail('已有待审批的申诉，请不要重复提交。');S.disputes.unshift({id:id('AD'),person:me().id,hourId:h.id,reason:values.reason,proposed:Number(values.proposed),status:'待审批'});audit('工时申诉提交',h.id,values.reason);return done('申诉已提交，等待车间管理审批。'),true}
 if(kind==='sop'){S.standards.unshift({id:id('SOP'),title:values.title,process:values.process,line:values.line,position:values.position,steps:values.steps,version:values.version,status:'草稿',createdBy:me().name});audit('新建标准卡草稿',values.title,values.version);return done('已建立操作标准卡草稿，可提交审核。'),true}
 if(kind==='executeSop'){const r=S.standards.find(x=>x.id===ref);if(!r||r.status!=='已发布')return fail('只有已发布的操作标准卡才能执行。');if(!permitted('tech','sop','execute'))return fail('无标准卡执行权限');if(r.steps.split('；').some((x,i)=>!values['step-'+i]))return fail('必须逐项确认操作步骤。');S.executions.unshift({id:id('EXE'),card:r.id,person:me().name,result:'已确认',at:stamp()});audit('标准卡执行签名',r.id,r.version);return done('所有步骤已确认，执行签名和版本已记录。'),true}
 if(kind==='dictionary'){S.dictionary.unshift({id:id('DICT'),group:values.group,name:values.name,value:values.value,active:true});audit('新建字典项',values.name,values.group);return done('字典项已保存。'),true}
 if(kind==='dispose'){const r=S.ncr.find(x=>x.id===ref);if(!r||r.status!=='待处置')return fail('该不合格品单已处理。');r.disposal=values.disposal;r.reason=values.reason;r.status=values.disposal==='隔离'?'已隔离':values.disposal==='报废'?'已报废':'已下达'+values.disposal;r.disposedBy=me().name;r.disposedAt=stamp();if(values.disposal==='返洗'||values.disposal==='返工'){const newTask={id:id(values.disposal==='返洗'?'RC':'RW'),type:values.disposal==='返洗'?'清洗':'配制',line:'L01 配制一线',category:values.disposal==='返洗'?'非生产任务':'生产任务',status:'待开始',sourceNcr:r.id};ctx.data.tasks.unshift(newTask);r.task=newTask.id}audit('不合格品处置',r.id,r.status);return done('已保存处置决定，并保留关联工单。'),true}
 return fail('无法识别表单类型。')
 }catch(error){return fail('保存失败：'+(error?.message||'未知错误'))}
}
function hasCleaningPass(task){return S.cleanReports.some(r=>r.task===task&&r.status==='合格')}
function hasFlowInspection(orderId,phase){return S.inspections.some(r=>r.order===orderId&&r.phase===phase&&r.status==='合格')}
function blockedFromFlow(material){return S.batches.filter(x=>x.material===material&&x.counted&&x.quality!=='合格').reduce((a,x)=>a+Number(x.qty),0)}
function onPurchaseReceipt(idValue){return S.incoming.some(r=>r.purchase===idValue&&r.status==='已入库')}
function openTodo(item){const map={inspection:'decision',clean:'clean',ncr:'ncr',incoming:'incoming',request:'pick',outbound:'outbound',roster:'plan',dispute:'dispute'};const page=item.feature;currentTab[page]=map[item.kind]||tabs[page]?.[0]?.[0];ctx.openFeature(page,item.dept);setTimeout(()=>{const row=[...document.querySelectorAll('.mw-table tbody tr')].find(x=>x.textContent.includes(item.id));row?.scrollIntoView({block:'center',behavior:'smooth'});row?.classList.add('mw-highlight');},30)}
window.FactoryModules={init,render,supports,handleClick,submitForm,pendingForDept,openTodo,hasCleaningPass,hasFlowInspection,blockedFromFlow,onPurchaseReceipt,receiveFinishedGoods,get state(){return S}};
})();
