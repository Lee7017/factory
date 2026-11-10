/* 统一流转反馈：跨部门动作与本单历史，页面中央出现后自动淡出，不阻止下一个操作。 */
(()=>{'use strict';
const deptNames={sales:'销售部',pmc:'生产计划与物料控制部（PMC）',purchase:'采购 / 供应链部',warehouse:'仓库 / 物流部',quality:'质量部 QA / QC',production:'生产车间',engineering:'设备工程部',hr:'人事行政办公室',finance:'财务部',it:'信息化 / 主数据管理',tech:'工艺技术部',ehs:'EHS 安全环保部',leadership:'总经办'};
const clean=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&quot;'}[c]));
const label=x=>deptNames[x]||x||'当前部门';
const routes={
 '车间领料申请':['production','warehouse','仓库 FIFO 备料'],
 '仓库 FIFO 备料':['warehouse','warehouse','等待仓库签发'],
 '仓库签发':['warehouse','production','待车间到料接收双签'],
 '车间签收':['production','production','开始生产任务'],
 '结余退库申请':['production','warehouse','仓库确认退库'],
 '仓库退库接收':['warehouse','warehouse','更新库存批次'],
 '创建报检单':['production','quality','QC 检验判定'],
 '清洗报检提交':['production','quality','QC 清洗报检判定'],
 '清洗报检合格':['quality','production','清洗任务完工复核'],
 '清洗报检不合格':['quality','production','返洗及整改'],
 '报检合格':['quality','production','下一工序'],
 '报检不合格':['quality','production','不合格品处置'],
 '采购到货登记':['warehouse','quality','来料检验'],
 '来料 QC 合格':['quality','warehouse','批次入库确认'],
 '来料 QC 不合格':['quality','warehouse','复核或安排补货'],
 '来料入库确认':['warehouse','warehouse','可用批次参与 FIFO 备料'],
 '采购单审批':['purchase','warehouse','采购到货与收货'],
 '仓库到货登记':['warehouse','quality','QC 来料检验'],
 '仓库确认入库':['warehouse','warehouse','库存可用'],
 '成品出库单创建':['warehouse','warehouse','确认成品批次出库'],
 '成品销售出库':['warehouse','sales','成品已发出，销售可查看交付结果'],
 '填报工时':['production','production','本人确认工时'],
 '工时申诉提交':['production','hr','工时申诉审批'],
 '工时申诉审批':['hr','production','员工再次确认'],
 '开工前 Gate 检查':['pmc','production','执行车间工单'],
 '岗位排班':['pmc','production','开工前 Gate 校验'],
 '不合格品处置':['quality','production','返洗、返工或报废执行']
};
const nextTargets={
 '车间领料申请':{dept:'warehouse',feature:'warehousePick'},
 '仓库 FIFO 备料':{dept:'warehouse',feature:'warehousePick'},
 '仓库签发':{dept:'production',feature:'workshopReceive'},
 '车间签收':{dept:'production',feature:'tasks'},
 '结余退库申请':{dept:'warehouse',feature:'warehouseReturns'},
 '仓库退库接收':{dept:'warehouse',feature:'warehouseOps'},
 '创建报检单':{dept:'quality',feature:'qaQc'},
 '清洗报检提交':{dept:'quality',feature:'qaCleanInspection'},
 '清洗报检合格':{dept:'production',feature:'tasks'},
 '清洗报检不合格':{dept:'production',feature:'workshopRework'},
 '报检合格':{dept:'production',feature:'tasks'},
 '报检不合格':{dept:'quality',feature:'qaNcr'},
 '采购到货登记':{dept:'quality',feature:'qaQc'},
 '来料 QC 合格':{dept:'warehouse',feature:'warehouseIncoming'},
 '来料 QC 不合格':{dept:'warehouse',feature:'warehouseIncoming'},
 '来料入库确认':{dept:'warehouse',feature:'warehousePick'},
 '采购单审批':{dept:'warehouse',feature:'warehouseIncoming'},
 '仓库到货登记':{dept:'quality',feature:'qaQc'},
 '仓库确认入库':{dept:'warehouse',feature:'warehouseIncoming'},
 '成品出库单创建':{dept:'warehouse',feature:'warehouseOutbound'},
 '成品销售出库':{dept:'sales',feature:'orders'},
 '填报工时':{dept:'hr',feature:'hours'},
 '工时申诉提交':{dept:'production',feature:'workshopDispute'},
 '工时申诉审批':{dept:'hr',feature:'hoursAppeal'},
 '开工前 Gate 检查':{dept:'production',feature:'tasks'},
 '岗位排班':{dept:'pmc',feature:'shift'},
 '不合格品处置':{dept:'production',feature:'workshopRework'}
};
const docRules=[
 [/^SO-/,'销售订单','sales','orders'],
 [/^PO-/,'采购单','purchase','purchase'],
 [/^LV-/,'请假单','hr','leave'],
 [/^(QC|INS)-/,'质量报检单','quality','qaQc'],
 [/^(CLN|CLEAN|CLQC)-/,'清洗报检单','quality','qaQc'],
 [/^NCR-/,'不合格品处置单','quality','qaQc'],
 [/^(MR|ISSUE)-/,'领料单','production','workshop'],
 [/^(RT|RETURN)-/,'退库单','warehouse','warehouseOps'],
 [/^IN-/,'采购到货单','warehouse','warehouseIncoming'],
 [/^OB-/,'成品出库单','warehouse','warehouseOps'],
 [/^IQC-/,'来料检验单','quality','qaQc'],
 [/^LOT-/,'库存批次','warehouse','warehouseOps'],
 [/^SH-/,'排班单','pmc','shift'],
 [/^SP-/,'抽检单','quality','qaQc'],
 [/^(WH|HOUR)-/,'工时单','hr','hours'],
 [/^AD-/,'工时申诉单','hr','hours'],
 [/^TK-/,'任务工单','production','tasks'],
 [/^SOP-/,'操作标准卡','tech','sop'],
 [/^EHS-/,'EHS 检查单','ehs','safety'],
 [/^APR-/,'审批单','leadership','approvals'],
 [/^FIN-/,'财务单','finance','finance']
];
function docMeta(entry){
 const ref=String(entry.ref||'业务记录');
 const hit=docRules.find(([re])=>re.test(ref));
 return {
  type:entry.docType||hit?.[1]||'业务单据',
  ref,
  summary:entry.summary||entry.detail||'',
  dept:entry.open?.dept||hit?.[2]||entry.from||entry.to||'',
  feature:entry.open?.feature||hit?.[3]||''
 };
}
function currentTime(){return new Date().toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}
let dismissTimer=null,activeContinue=null,activeTrackRef='';
const arrowRight='<svg class="journey-arrow" viewBox="0 0 48 26" aria-hidden="true"><path d="M2 13 H42 M33 4 L42 13 L33 22"/></svg>';
const arrowReturn='<svg class="journey-return-arrow" viewBox="0 0 80 39" aria-hidden="true"><path d="M73 5 H27 Q9 5 9 20 V32 M2 24 L9 32 L16 24"/></svg>';
const flowConfig={
 order:{title:'销售订单',steps:[
  ['sales','接收订单并提交评审',/订单记录导入|保存销售订单|接收订单并提交评审|提交评审/],
  ['sales','订单评审通过',/评审通过/],
  ['pmc','排程试算',/排程试算/],
  ['pmc','发布正式排程',/发布正式排程/],
  ['pmc','确认物料齐套并锁库',/确认齐套并锁库/],
  ['warehouse','确认领料发料',/确认领料发料/],
  ['production','配制开工',/配制开工/],
  ['production','配制报检',/配制报检/],
  ['quality','半成品检验判定',/半成品检验合格|半成品不合格/],
  ['production','包装开工',/包装开工/],
  ['production','包装报检',/包装报检/],
  ['quality','成品检验判定并放行',/成品检验合格并放行|成品检验合格|质量放行|成品不合格/],
  ['warehouse','成品入库',/成品入库/],
  ['sales','发起发货通知',/发起发货通知/],
  ['warehouse','按销售订单成品出库',/仓库按订单出库|仓库成品出库|成品销售出库/],
  ['sales','确认客户收货',/确认客户收货|交付确认/]
 ],loops:[['销售订单评审','退回修改后重新送审','sales'],['QC 判定','不合格 → 生产返工并重新报检','production']],progress:{draft:-1,review:0,approved:1,trial:2,formal:3,reserved:4,issued:5,blending:6,semi_qc:7,semi_ok:8,packaging:9,final_qc:10,inspected:11,released:11,stored:12,dispatch:13,shipping:13,shipped:14,delivered:15}},
 purchase:{title:'采购单',steps:[
  ['purchase','创建采购单',/采购员创建并送审|创建.*采购/],
  ['purchase','提交采购审批',/采购员创建并送审|提交.*采购|重新送审/],
  ['purchase','采购主管审批',/采购主管审批|审批通过|审批驳回/],
  ['warehouse','登记采购到货',/仓库到货登记|采购到货登记/],
  ['quality','QC 来料检验',/QC|来料检验/],
  ['warehouse','确认合格批次入库',/仓库确认入库|来料入库/]
 ],loops:[['采购主管','审批驳回 → 采购员修改后重新送审','purchase'],['QC 来料检验','不合格 → 隔离 / 供应商补货','warehouse']],progress:{草稿:0,待审批:1,已驳回:1,待到货:2,部分到货:3,到货处理中:3,已入库:5}},
 receipt:{title:'到货单',steps:[['warehouse','仓库登记实收与供应商批次',/仓库到货登记|采购到货登记/],['quality','QC 检验并判定',/QC|检验/],['warehouse','确认合格批次入库',/仓库确认入库|入库确认/]],progress:{待QC:0,合格待入库:1,不合格:0,已入库:2}},
 outbound:{title:'成品出库单',steps:[['sales','销售发货通知',/发货通知/],['warehouse','仓库按成品批次拣货',/成品出库单创建/],['warehouse','核对并确认出库',/成品销售出库/],['sales','跟踪客户收货',/客户收货|交付确认/]],loops:[['仓库复核','批次或数量不符 → 返回重新拣货','warehouse']],progress:{待出库:1,已出库:2}}
};
function inferKind(entry){if(entry.kind)return entry.kind;const s=String(entry.ref||'');return /^SO-/.test(s)?'order':/^PO-/.test(s)?'purchase':/^IN-/.test(s)?'receipt':/^OB-/.test(s)?'outbound':'handoff'}
function getStage(entry,kind){if(entry.stage!==undefined)return entry.stage;const ops=window.FactoryOperations?.state,modules=window.FactoryModules?.state,ref=entry.ref;
 if(kind==='order')return ops?.flows?.[ref]?.stage||'draft';
 if(kind==='purchase')return ops?.purchases?.find(x=>x.id===ref)?.status||'待审批';
 if(kind==='receipt')return modules?.incoming?.find(x=>x.id===ref)?.status||'待QC';
 if(kind==='outbound')return modules?.outbound?.find(x=>x.id===ref)?.status||'待出库';return ''}
function getHistory(entry,kind){if(entry.history?.length)return entry.history;
 const ops=window.FactoryOperations?.state,modules=window.FactoryModules?.state,ref=entry.ref;
 if(kind==='order')return ops?.flows?.[ref]?.audit||[];
 if(kind==='receipt')return (modules?.ledger||[]).filter(x=>x.ref===ref).map(x=>({action:x.type,person:x.by,at:x.time,from:x.dept}));
 if(kind==='outbound')return (modules?.ledger||[]).filter(x=>x.ref===ref).map(x=>({action:x.type,person:x.by,at:x.time,from:x.dept}));
 return entry.action?[{action:entry.action,at:entry.at||'',person:entry.operator||'',from:entry.from}]:[];
}
function lastStepRecord(step,history){return [...history].reverse().find(row=>step[2]?.test(String(row.action||'')))}
function buildSteps(entry,kind){const config=flowConfig[kind];if(config)return config.steps;
 const source=entry.from||'sales',target=entry.to||source;return [[source,entry.action||'业务办理',new RegExp('.*')],[target,entry.next||'下一个业务动作',new RegExp('(?!)')]];}
function stepState(i,kind,stage){if(kind==='handoff')return i===0?'done':'current';const score=flowConfig[kind]?.progress?.[stage]??-1,last=(flowConfig[kind]?.steps?.length||0)-1;if(score>=last&&i===last)return 'complete';return i<=score?'done':i===score+1?'current':'waiting'}
function makeCard(step,i,state,history){const [dept,act]=step,record=lastStepRecord(step,history),done=['done','complete'].includes(state),operator=record?.person||record?.by||(done?'历史记录未注明':'待分配'),time=record?.at||record?.time||'—',canTrack=Boolean(activeContinue)&&['current','complete'].includes(state);return `<div class="journey-card is-${state}" data-journey-step="${i}">
 <div class="journey-card-head"><span class="journey-seq">${String(i+1).padStart(2,'0')}</span><div class="journey-card-head-actions">${canTrack?'<button type="button" class="journey-card-track" data-flow-track>'+(state==='complete'?'查看已办结环节':'跟踪当前环节')+' →</button>':`<span class="journey-state">${state==='done'?'已办理':state==='current'?'当前环节':state==='complete'?'已办结':'待办理'}</span>`}</div></div>
 <div class="journey-dept">${clean(label(dept))}</div><strong class="journey-task">${clean(act)}</strong><div class="journey-person"><time class="journey-time">${clean(time)}</time><span class="journey-operator" title="${clean(operator)}">${clean(operator)}</span></div>
 ${['current','complete'].includes(state)?'<svg class="journey-marquee" aria-hidden="true"><rect x="2" y="2" width="calc(100% - 4px)" height="calc(100% - 4px)" rx="12"/></svg>':''}</div>`}
// 所有单据共用同一条顺时针闭合路线。只有历史上确实发生退回时才绘制回环。
function snakeOfCards(steps,kind,stage,history){
 const cols=4,cardW=176,cardH=122,gapX=36,gapY=72,padX=34,padY=34;
 const rows=Math.ceil(steps.length/cols),width=padX*2+cols*cardW+(cols-1)*gapX,height=padY*2+rows*cardH+Math.max(0,rows-1)*gapY;
 const pos=steps.map((_,i)=>{const row=Math.floor(i/cols),slot=i%cols,col=row%2===0?slot:cols-1-slot;return {row,col,x:padX+col*(cardW+gapX),y:padY+row*(cardH+gapY)}});
 const states=steps.map((_,i)=>stepState(i,kind,stage)),currentIndex=states.indexOf('current'),arrivalConnector=currentIndex>0?currentIndex-1:-1;
 const connector=(a,b)=>{
  const same=a.row===b.row;
  if(same){const dir=b.x>a.x?1:-1,x1=dir>0?a.x+cardW:a.x,x2=dir>0?b.x:b.x+cardW,y=a.y+cardH/2;return `M${x1} ${y} L${x2} ${y}`}
  // 贪吃蛇换行时，下一个节点就在当前节点正下方：从卡片底部中心直接向下进入下一张卡片。
  const x=a.x+cardW/2,y1=a.y+cardH,y2=b.y;
  return `M${x} ${y1} V${y2}`;
 };
 const arrows=steps.slice(0,-1).map((_,i)=>{const cls=i===arrivalConnector?'is-arrival':i<arrivalConnector?'is-past':'is-future',d=connector(pos[i],pos[i+1]);return `<path class="journey-snake-arrow ${cls}" ${i===arrivalConnector?'pathLength="1"':''} d="${d}" ${i===arrivalConnector?'':'marker-end="url(#journey-arrow-tip)"'}/>${i===arrivalConnector?`<path class="journey-snake-arrival-tip" d="${d}" marker-end="url(#journey-arrow-tip)"/>`:''}`}).join('');
 const returns=(history||[]).filter(h=>/驳回|退回|不合格|返洗|返工|复检/.test(h.action||''));
 const returnLines=returns.slice(-3).map((h,i)=>{
  const action=String(h.action||'退回'),fromIndex=Math.min(steps.length-1,Math.max(1,stepForReturn(action,kind,steps.length))),toIndex=Math.max(0,Math.min(steps.length-1,returnTarget(action,kind,steps.length))),a=pos[fromIndex],b=pos[toIndex];
  const x1=a.x+cardW/2,y1=a.y+cardH/2,x2=b.x+cardW/2,y2=b.y+cardH/2,lift=42+i*18,cy=Math.min(y1,y2)-lift;
  return `<path class="journey-snake-return" d="M${x1} ${y1} C${x1} ${cy} ${x2} ${cy} ${x2} ${y2}" marker-end="url(#journey-return-tip)"/>`;
 }).join('');
 const cards=steps.map((step,i)=>`<div class="journey-snake-position" style="left:${pos[i].x}px;top:${pos[i].y}px;width:${cardW}px;height:${cardH}px">${makeCard(step,i,states[i],history,steps.length)}</div>`).join('');
 return `<div class="journey-snake-scroll" role="region" aria-label="连续折返流程图" tabindex="0" data-arrival-index="${currentIndex}"><div class="journey-snake" style="width:${width}px;height:${height}px"><svg viewBox="0 0 ${width} ${height}" class="journey-snake-paths" aria-hidden="true"><defs><marker id="journey-arrow-tip" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M1 1 L8 5 L1 9" fill="none" stroke="#62758a" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></marker><marker id="journey-return-tip" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M1 1 L8 5 L1 9" fill="none" stroke="#b76b44" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>${arrows}${returnLines}</svg>${cards}</div></div>`;
}

function stepForReturn(action,kind,n){if(kind==='order'&&/物料不齐套|退回排程/.test(action))return 4;if(/审批|评审/.test(action))return 1;if(/QC|检验|复检/.test(action))return kind==='order'?(/半成品/.test(action)?8:11):kind==='purchase'?3:1;return Math.max(1,n-3)}
function returnTarget(action,kind,n){if(kind==='order'&&/物料不齐套|退回排程/.test(action))return 2;if(/审批|评审/.test(action))return 0;if(/QC|检验|复检/.test(action))return kind==='order'?(/半成品/.test(action)?6:9):kind==='purchase'?2:0;return Math.max(0,n-4)}
function orderDetails(entry,kind){
 if(kind!=='order')return '';
 const o=window.FactoryOperations?.getOrder?.(entry.ref);
 if(!o)return '<div class="journey-extra"><div class="journey-section-head"><strong>销售订单内容</strong><small>原始订单未找到</small></div><div class="journey-extra-line"><span>无法读取订单正文，请核对订单是否已删除。</span></div></div>';
 const fields=[['订单编号',o.id],['产品名称',o.product],['产品规格',o.spec],['订单数量',o.qty===undefined?'未填写':o.qty+' '+(o.unit||'')],['订单状态',o.status||entry.status||'—']];
 for(const [key,label] of [['customer','客户'],['customerName','客户'],['deliveryDate','交货日期'],['dueDate','交期'],['createdAt','创建时间'],['owner','负责部门 / 人员'],['remark','备注'],['notes','备注']]){
  if(o[key]!==undefined&&o[key]!==null&&String(o[key]).trim()&&!fields.some(x=>x[0]===label))fields.push([label,o[key]]);
 }
 const outbound=window.FactoryModules?.state?.outbound?.filter(x=>x.order===entry.ref)||[];
 const sent=outbound.filter(x=>x.status==='已出库').reduce((n,x)=>n+Number(x.qty||0),0);
 const match=String(o.spec||'').match(/([\d.]+)\s*L\s*[×xX*]\s*(\d+)/);
 const perCase=match?Number(match[1])*Number(match[2]):20;
 const expected=Math.ceil(Number(o.qty||0)/Math.max(perCase,0.000001));
 const due=Math.max(0,expected-sent);
 const batches=window.FactoryModules?.state?.batches?.filter(b=>b.order===entry.ref&&b.group==='成品')||[];
 const available=batches.filter(b=>b.quality==='合格').reduce((n,b)=>n+Math.max(0,Number(b.qty||0)),0);
 const shortage=Math.max(0,due-available);
 const shipment=outbound.length?'<div class="journey-section-head"><strong>订单发货进度</strong><small>数量单位：箱</small></div><div class="journey-extra-line"><b>应发 '+clean(expected)+' 箱</b><span>已出库 '+clean(sent)+' 箱 · 待发 '+clean(due)+' 箱 · 合格库存 '+clean(available)+' 箱 · 缺口 '+clean(shortage)+' 箱</span></div>':'';
 return '<div class="journey-extra"><div class="journey-section-head"><strong>销售订单内容</strong><small>原始订单信息</small></div>'+
 fields.map(([label,value])=>'<div class="journey-extra-line"><b>'+clean(label)+'</b><span>'+clean(value)+'</span></div>').join('')+shipment+'</div>';
}
function extras(entry,kind){if(entry.detailHtml)return `<div class="journey-extra">${entry.detailHtml}</div>`;if(kind==='order'){const m=window.FactoryModules?.state,ref=entry.ref;
 const outbound=m?.outbound?.filter(x=>x.order===ref)||[];
 if(outbound.length)return `<div class="journey-extra"><div class="journey-section-head"><strong>成品出库与客户交付</strong><small>${outbound.length} 次出库记录</small></div>${outbound.map(r=>`<div class="journey-extra-line"><b>${clean(r.id)}</b><span>${clean(r.qty)} 箱 · ${clean(r.destination)} · ${clean(r.status)}</span></div>`).join('')}</div>`;
 }return ''}
function renderGraph(entry){const kind=inferKind(entry),history=getHistory(entry,kind),cfg=flowConfig[kind],stage=getStage(entry,kind),type=entry.docType||cfg?.title||docMeta(entry).type;
 const steps=buildSteps(entry,kind);const summary=entry.summary||'';
 return `<div class="flow-veil" data-flow-close aria-hidden="true"></div><section class="flow-window journey-dialog" role="dialog" aria-modal="true" aria-labelledby="journey-title">
 <header class="journey-top"><div><span class="journey-eyebrow">跨部门单据流转</span><h2 id="journey-title">${clean(type)} <span>${clean(entry.ref||'业务记录')}</span></h2><p>${clean(summary)}</p></div></header>
 ${kind==='order'?"<div class=\"journey-tabs\" role=\"tablist\" aria-label=\"订单弹窗\">\n  <button type=\"button\" class=\"journey-tab is-active\" role=\"tab\" id=\"journey-tab-flow\" aria-controls=\"journey-panel-flow\" aria-selected=\"true\" tabindex=\"0\" data-journey-tab=\"flow\">流转图</button>\n  <button type=\"button\" class=\"journey-tab\" role=\"tab\" id=\"journey-tab-order\" aria-controls=\"journey-panel-order\" aria-selected=\"false\" tabindex=\"-1\" data-journey-tab=\"order\">订单内容</button>\n </div>\n <section class=\"journey-tab-panel is-active\" id=\"journey-panel-flow\" role=\"tabpanel\" aria-labelledby=\"journey-tab-flow\" data-journey-panel=\"flow\">":orderDetails(entry,kind)}
 <div class="journey-steps">${snakeOfCards(steps,kind,stage,history)}</div>
 ${kind==='order'?"</section><section class=\"journey-tab-panel\" id=\"journey-panel-order\" role=\"tabpanel\" aria-labelledby=\"journey-tab-order\" data-journey-panel=\"order\" hidden>"+orderDetails(entry,kind)+extras(entry,kind)+'</section>':extras(entry,kind)}
 </section>`}
function openDialog(entry){const host=document.querySelector('#flow-transition-host');if(!host||!entry)return;
 clearTimeout(dismissTimer);
 const liveStage=(entry.kind==='order'||/^SO-/.test(String(entry.ref||'')))?window.FactoryOperations?.state?.flows?.[entry.ref]?.stage:null;
 const orderTarget=liveStage==='delivered'?{dept:'sales',feature:'orderHistory',record:entry.ref}:
  liveStage==='shipped'?{dept:'sales',feature:'orders',record:entry.ref}:
  ['dispatch','shipping'].includes(liveStage)?{dept:'warehouse',feature:'warehouseOutbound',record:entry.ref}:null;
 activeContinue=orderTarget||entry.nextOpen||nextTargets[entry.action]||null;activeTrackRef=entry.ref||'';
 host.innerHTML=renderGraph(entry);host.classList.remove('flow-dismiss');host.classList.add('flow-visible');
 const dialog=host.querySelector('.journey-dialog'),snakeScroll=dialog?.querySelector('.journey-snake-scroll'),arrival=Number(snakeScroll?.dataset.arrivalIndex??-1);
 if(dialog&&snakeScroll&&arrival>=0){
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
   const current=dialog.querySelector(`[data-journey-step="${arrival}"]`),previous=dialog.querySelector(`[data-journey-step="${Math.max(0,arrival-1)}"]`);
   if(current){
    const cr=current.getBoundingClientRect(),pr=previous?.getBoundingClientRect()||cr,sr=snakeScroll.getBoundingClientRect(),dr=dialog.getBoundingClientRect();
    const midX=((cr.left+cr.right+pr.left+pr.right)/4)-sr.left+snakeScroll.scrollLeft;
    snakeScroll.scrollLeft=Math.max(0,midX-snakeScroll.clientWidth/2);
    const midY=(Math.min(cr.top,pr.top)+Math.max(cr.bottom,pr.bottom))/2;
    dialog.scrollTop=Math.max(0,dialog.scrollTop+(midY-(dr.top+dr.height/2)));
   }
   requestAnimationFrame(()=>{
    dialog.classList.add('is-flowing-current');
    dismissTimer=setTimeout(()=>dialog.classList.add('is-arrived-current'),1750);
   });
  }));
 }
}
function show(entry){openDialog(entry)}
function openDocument(entry){openDialog(entry)}
function dismiss(){const host=document.querySelector('#flow-transition-host');if(!host)return;host.classList.remove('flow-visible');host.classList.add('flow-dismiss');host.innerHTML='';activeContinue=null;activeTrackRef=''}
function fromAudit(row,history,defaultDept){const rule=routes[row.type]||Object.entries(routes).find(([k])=>String(row.type).includes(k))?.[1],from=rule?.[0]||defaultDept||'当前部门',to=rule?.[1]||from;
 show({ref:row.ref,action:row.type,from,to,status:row.detail||'已记录',summary:row.detail||'',operator:row.by||'当前用户',at:row.time||'',history,next:rule?.[2]||'查看单据状态',nextOpen:nextTargets[row.type]||Object.entries(nextTargets).find(([k])=>String(row.type).includes(k))?.[1]});}
document.addEventListener('click',event=>{
 const tab=event.target.closest('[data-journey-tab]');
 if(tab){const dialog=tab.closest('.journey-dialog'),name=tab.dataset.journeyTab;if(dialog){dialog.querySelectorAll('[data-journey-tab]').forEach(btn=>{const on=btn===tab;btn.classList.toggle('is-active',on);btn.setAttribute('aria-selected',on?'true':'false');btn.setAttribute('tabindex',on?'0':'-1')});dialog.querySelectorAll('[data-journey-panel]').forEach(panel=>{const on=panel.dataset.journeyPanel===name;panel.hidden=!on;panel.classList.toggle('is-active',on)});dialog.scrollTop=0}return;}
 if(event.target.closest('[data-flow-track]')){const target=activeContinue?{...activeContinue}:null,ref=activeTrackRef;dismiss();if(target)window.FactoryNavigation?.trackBottleneck?.(target,ref);return;}
 if(event.target.closest('[data-flow-close]')||(event.target.closest('#flow-transition-host')&&!event.target.closest('.journey-dialog')))dismiss();});
document.addEventListener('keydown',event=>{
 const activeTab=event.target.closest?.('[data-journey-tab]');
 if(activeTab&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
  const tabs=[...activeTab.closest('[role="tablist"]').querySelectorAll('[data-journey-tab]')],i=tabs.indexOf(activeTab);
  const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(i+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
  event.preventDefault();tabs[next].click();tabs[next].focus();return;
 }
 if(event.key==='Escape')dismiss();
});
window.FactoryFlowUI={show,openDocument,dismiss,fromAudit,names:deptNames,flowConfig};
})();