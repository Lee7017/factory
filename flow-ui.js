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
let dismissTimer=null,activeContinue=null,activeTrackRef='',activeFlowDocuments=[],activeFlowEntry=null;
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
  ['production','配制任务完成',/配制任务完成|配制报检/],
  ['production','配制线清洗执行与复核',/配制线清洗执行与复核/],
  ['quality','半成品检验判定',/半成品检验合格|半成品不合格/],
  ['engineering','调机调线执行与复核',/调机调线任务复核完成/],
  ['production','包装开工',/包装开工/],
  ['production','包装任务完成',/包装任务完成|包装报检/],
  ['production','包装线清洗执行与复核',/包装线清洗执行与复核/],
  ['quality','成品检验判定并放行',/成品检验合格并放行|成品检验合格|质量放行|成品不合格/],
  ['warehouse','成品入库',/成品入库/],
  ['sales','发起发货通知',/发起发货通知/],
  ['warehouse','按销售订单成品出库',/仓库按订单出库|仓库成品出库|成品销售出库/],
  ['sales','确认客户收货',/确认客户收货|交付确认/]
 ],loops:[['销售订单评审','退回修改后重新送审','sales'],['QC 判定','不合格 → 生产返工并重新报检','production']],progress:{draft:-1,review:0,approved:1,trial:2,formal:3,reserved:4,issued:5,blending:6,blend_clean:7,semi_qc:8,semi_ok:9,packaging:11,pack_clean:12,final_qc:13,inspected:14,released:14,stored:15,dispatch:16,shipping:16,shipped:17,delivered:18}},
 purchase:{title:'采购单',steps:[
  ['pmc','PMC 生成采购单',/PMC 依据销售订单缺料生成采购单|PMC 创建采购单|创建采购需求/],
  ['pmc','PMC 主管确认需求',/PMC主管确认采购单|PMC主管确认采购需求/],
  ['purchase','采购员完善采购单',/采购员完善采购单并送审|采购员编制采购订单并送审|采购员创建并送审/],
  ['purchase','采购主管审批',/采购主管审批通过|采购主管驳回/],
  ['finance','财务预算审核',/财务审核通过|财务驳回/],
  ['leadership','总经办审批',/总经办审批通过|总经办驳回/],
  ['warehouse','仓库登记到货',/仓库到货登记|采购到货登记/],
  ['quality','QC 来料检验',/QC|来料检验/],
  ['warehouse','确认合格批次入库',/仓库确认入库|来料入库/]
 ],loops:[['采购审批','驳回 → 采购员修改并重新送审','purchase'],['QC 来料检验','不合格 → 隔离或供应商补货','warehouse']],progress:{}},
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
 if(kind==='purchase'){const p=ops?.purchases?.find(x=>x.id===ref),r=ops?.purchaseRequests?.find(x=>x.id===p?.requestId),receipts=(modules?.incoming||[]).filter(x=>x.purchase===ref);
  const receiptHistory=receipts.flatMap(x=>x.history||[]);
  const qcHistory=(modules?.inspections||[]).filter(x=>receipts.some(r=>r.id===x.incoming)&&x.status!=='待判定').map(x=>({action:'QC 来料检验'+x.status,person:String(x.result||'').split(' · ')[0]||'质量部',at:String(x.result||'').split(' · ')[1]||'—',from:'quality'}));
  return [...(r?.history||[]),...(p?.history||[]),...receiptHistory,...qcHistory]
 }
 if(kind==='receipt')return (modules?.ledger||[]).filter(x=>x.ref===ref).map(x=>({action:x.type,person:x.by,at:x.time,from:x.dept}));
 if(kind==='outbound')return (modules?.ledger||[]).filter(x=>x.ref===ref).map(x=>({action:x.type,person:x.by,at:x.time,from:x.dept}));
 return entry.action?[{action:entry.action,at:entry.at||'',person:entry.operator||'',from:entry.from}]:[];
}
function lastStepRecord(step,history){return [...history].reverse().find(row=>step[2]?.test(String(row.action||'')))}
function buildSteps(entry,kind){const config=flowConfig[kind];if(kind==='purchase'){
  const p=window.FactoryOperations?.state?.purchases?.find(x=>x.id===entry.ref),plan=p?.approvalPlan;
  return config.steps.filter((x,i)=>(i!==1||!p?.pmcAutoConfirmed)&&(i!==4&&i!==5||(i===4?plan?.finance!==false:plan?.leadership!==false)))
 }
 if(config)return config.steps;
 const source=entry.from||'sales',target=entry.to||source;return [[source,entry.action||'业务办理',new RegExp('.*')],[target,entry.next||'下一个业务动作',new RegExp('(?!)')]];}
function stepState(i,kind,stage,steps,ref){if(kind==='handoff')return i===0?'done':'current';
 if(kind==='order'&&stage==='semi_ok'){
  const linked=window.FactoryOperations?.taskGateForOrder?.(ref,'调机调线');
  const score=linked?.status==='已完成'?10:9;
  return i<=score?'done':i===score+1?'current':'waiting';
 }
 if(kind==='purchase'){
  const index=label=>steps.findIndex(x=>x[1]===label),pmc=index('PMC 主管确认需求'),buyer=index('采购员完善采购单'),prior=index('采购主管审批'),finance=index('财务预算审核'),leader=index('总经办审批'),arrival=index('仓库登记到货'),qc=index('QC 来料检验');
  const waitingQC=stage==='到货处理中'||stage==='部分到货',approvedReceipt=waitingQC&&(window.FactoryModules?.state?.incoming||[]).some(r=>r.purchase===activeTrackRef&&r.status==='合格待入库');
  const score=stage==='待补采购需求'?-1:stage==='待PMC确认'?0:stage==='待采购填写'?(pmc<0?0:pmc):stage==='待采购主管审批'?buyer:stage==='待财务审核'?prior:stage==='待总经办审批'?Math.max(prior,finance):stage==='待到货'?Math.max(prior,finance,leader):waitingQC?(approvedReceipt?qc:arrival):stage==='已入库'?steps.length-1:stage==='已驳回'?0:-1;
  return score>=steps.length-1&&i===steps.length-1?'complete':i<=score?'done':i===score+1?'current':'waiting';
 }
 const score=flowConfig[kind]?.progress?.[stage]??-1,last=(flowConfig[kind]?.steps?.length||0)-1;if(score>=last&&i===last)return 'complete';return i<=score?'done':i===score+1?'current':'waiting'}

/* 只从已存在的业务记录找单据；没有单号就保留“已办理”，不生成假链接。 */
function linkedDocuments(entry,kind,step){
 const name=step[1],ref=String(entry.ref||''),ops=window.FactoryOperations?.state||{},modules=window.FactoryModules?.state||{};
 const cleanReports=modules.cleanReports||[],inspections=modules.inspections||[],ncr=modules.ncr||[];
 const incoming=modules.incoming||[],outbound=modules.outbound||[],batches=modules.batches||[];
 const documents=[];
 const add=(records,type,title)=>{for(const record of records||[])if(record?.id)documents.push({type,title,ref:String(record.id)})};
 const fromInspection=xs=>{const ids=new Set(xs.map(x=>x.id));return ncr.filter(r=>ids.has(r.ref)||ids.has(r.inspection))};
 if(kind==='order'){
  const cleanFor=phase=>cleanReports.filter(r=>r.order===ref&&(r.phase===phase||(!r.phase&&/配制/.test(r.line||'')&&phase==='配制')||(!r.phase&&/包装|瓶装/.test(r.line||'')&&phase==='包装')));
  if(name==='确认物料齐套并锁库')add((ops.purchases||[]).filter(p=>p.sourceOrder===ref),'purchase','采购单');
  if(name==='确认领料发料')add((modules.materialRequests||[]).filter(r=>r.order===ref&&r.type==='领料'),'material','领料单');
  if(name==='配制线清洗执行与复核'||name==='包装线清洗执行与复核'){
   const phase=name.startsWith('配制')?'配制':'包装';
   const reports=cleanFor(phase);
   // 展示所有真实报检记录，包含不合格后重新报检的历史；不擅自隐藏或合并单据。
   for(const r of reports)if(r.id)documents.push({
    type:'clean',title:'清洗报检单',ref:String(r.id),
    taskId:String(r.task||''),line:String(r.line||''),phase,
    status:String(r.status||'未记录'),at:String(r.checkedAt||r.submittedAt||''),
    remark:String(r.remark||r.failureReason||'')
   });
   if(!reports.length){
    const tasks=window.FactoryOperations?.tasksForOrder?.(ref,'清洗',phase)||[];
    add(tasks,'task','清洗工单');
   }
  }
  if(name==='半成品检验判定'||name==='成品检验判定并放行'){
   const phase=name.startsWith('半成品')?'半成品':'成品';
   const records=inspections.filter(r=>r.order===ref&&r.phase===phase);
   add(records,'inspection',phase+'检验单');
   add(fromInspection(records),'ncr','不合格品处置单');
  }
  if(name==='调机调线执行与复核')add(window.FactoryOperations?.tasksForOrder?.(ref,'调机调线')||[],'task','调机调线工单');
  if(name==='成品入库')add(batches.filter(b=>b.order===ref&&b.group==='成品'),'batch','成品库存批次');
  if(name==='按销售订单成品出库')add(outbound.filter(r=>r.order===ref),'outbound','成品出库单');
 }else if(kind==='purchase'){
  if(['PMC 生成采购单','采购员完善采购单'].includes(name))
   add((ops.purchases||[]).filter(r=>r.id===ref),'purchase','采购单');
  const receipts=incoming.filter(r=>r.purchase===ref);
  if(name==='仓库登记到货')add(receipts,'receipt','采购到货单');
  if(name==='QC 来料检验'){
   const ids=new Set(receipts.map(r=>r.id));
   const checks=inspections.filter(r=>ids.has(r.incoming));
   add(checks,'inspection','来料检验单');add(fromInspection(checks),'ncr','不合格品处置单');
  }
  if(name==='确认合格批次入库')add(batches.filter(b=>receipts.some(r=>r.id===b.incoming||r.batch===b.id)),'batch','入库批次');
 }else if(kind==='receipt'){
  if(name==='仓库登记实收与供应商批次')add(incoming.filter(r=>r.id===ref),'receipt','采购到货单');
  if(name==='QC 检验并判定'){
   const checks=inspections.filter(r=>r.incoming===ref);
   add(checks,'inspection','来料检验单');add(fromInspection(checks),'ncr','不合格品处置单');
  }
  if(name==='确认合格批次入库')add(batches.filter(b=>b.incoming===ref||incoming.some(r=>r.id===ref&&r.batch===b.id)),'batch','入库批次');
 }else if(kind==='outbound'){
  if(['仓库按成品批次拣货','核对并确认出库'].includes(name))
   add(outbound.filter(r=>r.id===ref),'outbound','成品出库单');
 }
 return documents.filter((d,i)=>documents.findIndex(x=>x.type===d.type&&x.ref===d.ref)===i);
}
function returnEvents(history,kind,length){
 const events=[];
 for(const row of history||[]){
  const action=String(row.action||'');
  if(!/驳回|退回|打回|不合格|返洗|返工|复检/.test(action))continue;
  const from=Math.min(length-1,Math.max(1,stepForReturn(action,kind,length))),to=Math.max(0,Math.min(length-1,returnTarget(action,kind,length)));
  if(from<=to)continue;
  const reason=[row.reason,row.detail,row.remark,row.failureReason].map(x=>String(x||'').trim()).find(Boolean)||'';
  events.push({number:events.length+1,from,to,action,reason,at:String(row.at||row.time||'—'),person:String(row.person||row.by||'未注明')});
 }
 return events;
}
// 每次打回沿相邻卡片逐段画红线；只在最终回到的卡片前添加箭头。
function renderReturnSegments(events,pos,cardW,cardH){
 return events.map(event=>{
  const title=event.action+(event.reason?'；原因：'+event.reason:'');
  const parts=[];
  for(let i=event.from;i>event.to;i--){
   const from=pos[i],to=pos[i-1];if(!from||!to)continue;
   let d;
   if(from.row===to.row){
    const right=to.x>from.x;
    const x1=right?from.x+cardW:from.x,x2=right?to.x:to.x+cardW;
    const y=from.y+cardH/2+17;
    d='M'+x1+' '+y+' L'+x2+' '+y;
   }else{
    const x=from.x+cardW/2-16;
    d='M'+x+' '+from.y+' V'+(to.y+cardH);
   }
   // 只给该次打回的最后一段设置箭头；途中保持单纯红色连线。
   const tip=i===event.to+1?' marker-end="url(#journey-return-tip)"':'';
   parts.push('<path class="journey-snake-return" d="'+d+'"'+tip+'><title>'+clean(title)+'</title></path>');
  }
  return parts.join('');
 }).join('');
}
function makeCard(step,i,state,history,documents=[],kind='handoff',returns=[]){
 const [dept,act]=step,record=lastStepRecord(step,history),done=['done','complete'].includes(state);

 const operator=record?.person||record?.by||(done?'历史记录未注明':'待分配'),time=record?.at||record?.time||'—';
 const canTrack=Boolean(activeContinue)&&['current','complete'].includes(state);
 const title=!documents.length?'':documents.length===1?documents[0].title:
  documents.every(d=>d.title===documents[0]?.title)?`${documents[0].title}（${documents.length}）`:`相关单据（${documents.length}）`;
 const docButton=done&&documents.length?
  `<button type="button" class="journey-card-document" data-flow-document-step="${i}" title="${clean('查看'+title)}">查看${clean(title)}</button>`:'';
 const status=state==='done'?'已办理':state==='current'?'当前环节':state==='complete'?'已办结':'待办理';
 // 订单最初两张业务卡右上角直接查看订单正文，不再使用独立 Tab。
 const head=kind==='order'&&i<2?
  '<button type="button" class="journey-card-document journey-order-content" data-flow-order-content>订单内容</button>':
  (docButton||(canTrack?
   `<button type="button" class="journey-card-track" data-flow-track>${state==='complete'?'查看已办结环节':'跟踪当前环节'} →</button>`:
   `<span class="journey-state">${status}</span>`));
 return `<div class="journey-card is-${state}" data-journey-step="${i}" data-flow-card-step="${i}" title="查看本环节的执行记录">
  <div class="journey-card-head"><span class="journey-seq">${String(i+1).padStart(2,'0')}</span>
   <div class="journey-card-head-actions">${head}</div></div>
  <div class="journey-dept">${clean(label(dept))}</div><strong class="journey-task">${clean(act)}</strong>
  <button type="button" class="journey-person journey-person-open" data-flow-step-open="${i}" aria-label="查看${clean(act)}的执行记录和打回原因" title="查看执行记录和打回原因"><time class="journey-time">${clean(time)}</time>
   <span class="journey-operator" title="${clean(operator)}">${clean(operator)}</span></button>
  ${['current','complete'].includes(state)?'<svg class="journey-marquee" aria-hidden="true"><rect x="2" y="2" width="calc(100% - 4px)" height="calc(100% - 4px)" rx="12"/></svg>':''}</div>`;
}
// 所有单据共用同一条顺时针闭合路线。只有历史上确实发生退回时才绘制回环。
function snakeOfCards(steps,kind,stage,history,ref,documentsByStep){
 const cols=4,cardW=176,cardH=122,gapX=36,gapY=72,padX=34,padY=34;
 const rows=Math.ceil(steps.length/cols),width=padX*2+cols*cardW+(cols-1)*gapX,height=padY*2+rows*cardH+Math.max(0,rows-1)*gapY;
 const pos=steps.map((_,i)=>{const row=Math.floor(i/cols),slot=i%cols,col=row%2===0?slot:cols-1-slot;return {row,col,x:padX+col*(cardW+gapX),y:padY+row*(cardH+gapY)}});
 const states=steps.map((_,i)=>stepState(i,kind,stage,steps,ref)),currentIndex=states.indexOf('current'),arrivalConnector=currentIndex>0?currentIndex-1:-1;
 const connector=(a,b)=>{
  const same=a.row===b.row;
  if(same){const dir=b.x>a.x?1:-1,x1=dir>0?a.x+cardW:a.x,x2=dir>0?b.x:b.x+cardW,y=a.y+cardH/2;return `M${x1} ${y} L${x2} ${y}`}
  // 贪吃蛇换行时，下一个节点就在当前节点正下方：从卡片底部中心直接向下进入下一张卡片。
  const x=a.x+cardW/2,y1=a.y+cardH,y2=b.y;
  return `M${x} ${y1} V${y2}`;
 };
 const arrows=steps.slice(0,-1).map((_,i)=>{const cls=i===arrivalConnector?'is-arrival':i<arrivalConnector?'is-past':'is-future',d=connector(pos[i],pos[i+1]);return `<path class="journey-snake-arrow ${cls}" ${i===arrivalConnector?'pathLength="1"':''} d="${d}" ${i===arrivalConnector?'':'marker-end="url(#journey-arrow-tip)"'}/>${i===arrivalConnector?`<path class="journey-snake-arrival-tip" d="${d}" marker-end="url(#journey-arrow-tip)"/>`:''}`}).join('');
 const returns=returnEvents(history,kind,steps.length);
 const returnLines=renderReturnSegments(returns,pos,cardW,cardH);
 const cards=steps.map((step,i)=>`<div class="journey-snake-position" style="left:${pos[i].x}px;top:${pos[i].y}px;width:${cardW}px;height:${cardH}px">${makeCard(step,i,states[i],history,documentsByStep?.[i]||[],kind,returns)}</div>`).join('');
 return `<div class="journey-snake-scroll" role="region" aria-label="连续折返流程图" tabindex="0" data-arrival-index="${currentIndex}"><div class="journey-snake" style="width:${width}px;height:${height}px"><svg viewBox="0 0 ${width} ${height}" class="journey-snake-paths" aria-hidden="true"><defs><marker id="journey-arrow-tip" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M1 1 L8 5 L1 9" fill="none" stroke="#62758a" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></marker><marker id="journey-return-tip" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M1 1 L8 5 L1 9" fill="none" stroke="#d34445" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>${arrows}${returnLines}</svg>${cards}</div></div>`;
}

function stepForReturn(action,kind,n){if(kind==='order'&&/物料不齐套|退回排程/.test(action))return 4;if(/审批|评审/.test(action))return 1;if(/QC|检验|复检|不合格/.test(action))return kind==='order'?(/半成品/.test(action)?9:14):kind==='purchase'?3:1;return Math.max(1,n-3)}
function returnTarget(action,kind,n){if(kind==='order'&&/物料不齐套|退回排程/.test(action))return 2;if(/审批|评审/.test(action))return 0;if(/QC|检验|复检|不合格/.test(action))return kind==='order'?(/半成品/.test(action)?6:11):kind==='purchase'?2:0;return Math.max(0,n-4)}
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
function renderGraph(entry){
 const kind=inferKind(entry),history=getHistory(entry,kind),cfg=flowConfig[kind],stage=getStage(entry,kind),type=entry.docType||cfg?.title||docMeta(entry).type;
 const steps=buildSteps(entry,kind),summary=entry.summary||'';
 const documentsByStep=steps.map(step=>linkedDocuments(entry,kind,step));
 const blocker=entry.blockedTask;
 const blockedInfo=blocker?`<div class="journey-blocker" role="status"><strong>当前卡点：${clean(blocker.type)}工单 ${clean(blocker.id)} · ${clean(blocker.status)}</strong><span>${clean(blocker.line)} · ${clean(blocker.note)}</span><small>点击当前环节的“跟踪当前环节”前往待办。</small></div>`:'';
 return `<div class="flow-veil" data-flow-close aria-hidden="true"></div><section class="flow-window journey-dialog" role="dialog" aria-modal="true" aria-labelledby="journey-title">
 <header class="journey-top"><div><span class="journey-eyebrow">跨部门单据流转</span><h2 id="journey-title">${clean(type)} <span>${clean(entry.ref||'业务记录')}</span></h2><p>${clean(summary)}</p></div>
 ${returnEvents(history,kind,steps.length).length?'<button type="button" class="journey-return-link" data-flow-return-list>打回记录</button>':''}</header>
 ${blockedInfo}
 <div class="journey-steps">${snakeOfCards(steps,kind,stage,history,entry.ref,documentsByStep)}</div>
 ${extras(entry,kind)}
 </section>`;
}
// 订单正文、执行历史、打回记录统一在右侧栏展示，不再遮盖流程顶部。
function openOrderContent(){
 if(!activeFlowEntry||inferKind(activeFlowEntry)!=='order')return;
 openHistoryPanel('订单内容',orderDetails(activeFlowEntry,'order')+extras(activeFlowEntry,'order'));
}
function openStepHistory(i){
 if(!activeFlowEntry)return;
 const kind=inferKind(activeFlowEntry),steps=buildSteps(activeFlowEntry,kind),step=steps[i];
 if(!step)return;
 const history=getHistory(activeFlowEntry,kind);
 const records=history.filter(x=>step[2]?.test(String(x.action||'')));
 const returns=returnEvents(history,kind,steps.length).filter(x=>x.from>=i&&x.to<=i);
 const rows=records.length?records.map(x=>
  '<div class="journey-history-row"><strong>'+clean(x.action||step[1])+'</strong><span>'+clean(x.at||x.time||'时间未登记')+' · '+clean(x.person||x.by||'员工未登记')+'</span>'+
  (x.reason||x.detail?'<small>'+clean(x.reason||x.detail)+'</small>':'')+'</div>'
 ).join(''):'<p class="journey-detail-empty">这个环节暂无执行记录。</p>';
 const returned=returns.length?'<h3 class="journey-side-subtitle">相关打回记录</h3>'+returns.map(x=>
  '<div class="journey-history-row is-return"><strong>'+clean(x.action)+'</strong><span>'+clean(steps[x.from]?.[1]||'原环节')+' → '+clean(steps[x.to]?.[1]||'返回环节')+'</span>'+
  '<span>'+clean(x.at)+' · '+clean(x.person)+'</span><small>原因：'+clean(x.reason||'未记录具体原因')+'</small></div>'
 ).join(''):'';
 openHistoryPanel(step[1]+' · 记录',rows+returned);
}
function openReturnHistory(){
 if(!activeFlowEntry)return;
 const kind=inferKind(activeFlowEntry),steps=buildSteps(activeFlowEntry,kind);
 const events=returnEvents(getHistory(activeFlowEntry,kind),kind,steps.length);
 const body=events.length?events.map(h=>
  '<div class="journey-history-row is-return"><strong>'+clean(h.action)+'</strong>'+
  '<span>'+clean(steps[h.from]?.[1]||'原环节')+' → '+clean(steps[h.to]?.[1]||'返回环节')+'</span>'+
  '<span>'+clean(h.at)+' · '+clean(h.person)+'</span>'+
  '<small>原因：'+clean(h.reason||'未记录具体原因')+'</small></div>'
 ).join(''):'<p class="journey-detail-empty">没有打回记录。</p>';
 openHistoryPanel('打回记录',body);
}
function openHistoryPanel(title,body){
 const host=document.querySelector('#flow-transition-host');if(!host)return;
 host.querySelector('[data-flow-order-panel]')?.remove();
 host.insertAdjacentHTML('beforeend',`<div class="journey-order-panel-backdrop" data-flow-order-panel>
  <aside class="journey-order-panel" role="dialog" aria-modal="true" aria-label="${clean(title)}">
   <header><strong>${clean(title)}</strong><button type="button" data-flow-order-dismiss aria-label="关闭侧栏">×</button></header>
   <div class="journey-order-panel-body">${body}</div>
  </aside></div>`);
 host.querySelector('[data-flow-order-dismiss]')?.focus();
}
function openDialog(entry){const host=document.querySelector('#flow-transition-host');if(!host||!entry)return;
 clearTimeout(dismissTimer);
 const liveStage=(entry.kind==='order'||/^SO-/.test(String(entry.ref||'')))?window.FactoryOperations?.state?.flows?.[entry.ref]?.stage:null;
 const orderTarget=liveStage==='delivered'?{dept:'sales',feature:'orderHistory',record:entry.ref}:
  liveStage==='shipped'?{dept:'sales',feature:'orders',record:entry.ref}:
  ['dispatch','shipping'].includes(liveStage)?{dept:'warehouse',feature:'warehouseOutbound',record:entry.ref}:null;
 activeContinue=orderTarget||entry.nextOpen||nextTargets[entry.action]||null;activeTrackRef=entry.nextOpen?.record||entry.ref||'';
 activeFlowDocuments=buildSteps(entry,inferKind(entry)).map(step=>linkedDocuments(entry,inferKind(entry),step));activeFlowEntry=entry;
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
function dismiss(){const host=document.querySelector('#flow-transition-host');if(!host)return;host.classList.remove('flow-visible');host.classList.add('flow-dismiss');host.innerHTML='';activeContinue=null;activeTrackRef='';activeFlowDocuments=[];activeFlowEntry=null;activeDocumentChoices=[]}
function openLinkedDocument(doc){
 if(!doc)return;
 if(!window.FactoryModules?.openRecordDocument){window.alert('单据查看功能尚不可用');return}
 dismiss();
 window.FactoryModules.openRecordDocument(doc.type,doc.ref);
}

// 解释同一环节为何出现多张清洗报检单，只根据工单号、产线和实际检验结论下结论。
function cleaningDocumentsExplanation(docs){
 const items=docs.filter(d=>d.type==='clean');
 if(items.length<2)return '';
 const tasks=[...new Set(items.map(d=>d.taskId).filter(Boolean))],
  lines=[...new Set(items.map(d=>d.line).filter(Boolean))];
 if(items.some(d=>!d.taskId||!d.line))
  return '有历史报检单缺少关联清洗工单或产线信息，无法确认多张单的具体原因，请核对下方工单号与检验结论。';
 if(tasks.length===1&&lines.length>1)
  return `同一个清洗工单（${tasks[0]}）的历史报检却填写了 ${lines.length} 条不同产线：${lines.join('、')}。工单与产线信息存在冲突，无法据此判断是否真的清洗了多条线，需核对原始工单。`;
 if(tasks.length===1){
  const failed=items.filter(d=>d.status==='不合格');
  if(failed.length)
   return `同一条产线（${lines.join('、')}）、同一清洗工单（${tasks[0]}），共有 ${items.length} 次报检；其中 ${failed.length} 次检验不合格，系统按规则退回重新清洗，因此产生再次报检记录。不是两条产线同时清洗。`;
  return `同一清洗工单（${tasks[0]}）关联 ${items.length} 张报检单，但未发现“不合格”结论。当前记录不能证明有重新清洗，需核实是否为历史重复报检。`;
 }
 if(lines.length>1)
  return `这 ${items.length} 张报检单属于 ${tasks.length} 张不同清洗工单，涉及 ${lines.length} 条产线：${lines.join('、')}。这是不同产线的记录，并非一条产线重复报检。`;
 if(lines.length===1)
  return `同一条产线（${lines[0]}）关联了 ${tasks.length} 张清洗工单。它们不是同一清洗工单的复检；可能是不同生产任务或返工后分别清洗。现有记录没有注明重复开工原因，不能认定是重复清洗。`;
 return '多张报检单关联不同清洗工单，但产线信息不完整，暂时无法判定原因。';
}
function chooseLinkedDocuments(docs){
 const host=document.querySelector('#flow-transition-host');
 if(!host||!docs.length)return;
 if(docs.length===1)return openLinkedDocument(docs[0]);
 host.querySelector('[data-flow-document-picker]')?.remove();
 const reason=cleaningDocumentsExplanation(docs);
 const body=docs.map((doc,i)=>{
  const details=doc.type==='clean'?
   `<small>${clean(doc.phase||'清洗')}线 · ${clean(doc.line||'产线未登记')} · 工单 ${clean(doc.taskId||'未关联')} · ${clean(doc.status||'未记录')}${doc.at?' · '+clean(doc.at):''}</small>`:'';
  return `<button type="button" class="journey-doc-choice" data-flow-document-choice="${i}">
   <span class="journey-doc-choice-main"><strong>${clean(doc.title)} · ${clean(doc.ref)}</strong>${details}</span></button>`;
 }).join('');
 host.insertAdjacentHTML('beforeend',`<div class="journey-doc-picker-backdrop" data-flow-document-picker>
  <section class="journey-doc-picker" role="dialog" aria-modal="true" aria-label="选择关联单据">
   <header><strong>${reason?'这几张清洗报检单为什么同时存在？':'选择要查看的单据'}</strong><button type="button" data-flow-document-dismiss aria-label="关闭关联单据列表">×</button></header>
   ${reason?`<p class="journey-doc-explanation">${clean(reason)}</p>`:''}
   <div class="journey-doc-picker-list">${body}</div>
  </section></div>`);
 activeDocumentChoices=docs;
}
let activeDocumentChoices=[];
function fromAudit(row,history,defaultDept){const rule=routes[row.type]||Object.entries(routes).find(([k])=>String(row.type).includes(k))?.[1],from=rule?.[0]||defaultDept||'当前部门',to=rule?.[1]||from;
 show({ref:row.ref,action:row.type,from,to,status:row.detail||'已记录',summary:row.detail||'',operator:row.by||'当前用户',at:row.time||'',history,next:rule?.[2]||'查看单据状态',nextOpen:nextTargets[row.type]||Object.entries(nextTargets).find(([k])=>String(row.type).includes(k))?.[1]});}
document.addEventListener('click',event=>{
 if(event.target.closest('[data-flow-order-content]')){openOrderContent();return;}
 const returnLink=event.target.closest('[data-flow-return-list]');
 if(returnLink){openReturnHistory();return;}
 const stepHistory=event.target.closest('[data-flow-step-open]');
 if(stepHistory){openStepHistory(Number(stepHistory.dataset.flowStepOpen));return;}
 if(event.target.closest('[data-flow-order-dismiss]')||(event.target.matches?.('[data-flow-order-panel]'))){
  document.querySelector('[data-flow-order-panel]')?.remove();return;
 }
 const choice=event.target.closest('[data-flow-document-choice]');
 if(choice){const item=activeDocumentChoices[Number(choice.dataset.flowDocumentChoice)];return openLinkedDocument(item)}
 if(event.target.closest('[data-flow-document-dismiss]')||event.target.matches?.('[data-flow-document-picker]')){
  document.querySelector('[data-flow-document-picker]')?.remove();activeDocumentChoices=[];return;
 }
 const linked=event.target.closest('[data-flow-document-step]');
 if(linked){const docs=activeFlowDocuments[Number(linked.dataset.flowDocumentStep)]||[];
  chooseLinkedDocuments(docs);return;
 }
 if(event.target.closest('[data-flow-track]')){const target=activeContinue?{...activeContinue}:null,ref=activeTrackRef;dismiss();if(target)window.FactoryNavigation?.trackBottleneck?.(target,ref);return;}
 const card=event.target.closest('[data-flow-card-step]');
 if(card){openStepHistory(Number(card.dataset.flowCardStep));return;}
 if(event.target.closest('[data-flow-close]')||(event.target.closest('#flow-transition-host')&&!event.target.closest('.journey-dialog')))dismiss();});
document.addEventListener('keydown',event=>{
 if(event.key==='Escape'){const panel=document.querySelector('[data-flow-order-panel]');if(panel){panel.remove();return}dismiss();}
});
window.FactoryFlowUI={show,openDocument,dismiss,fromAudit,names:deptNames,flowConfig};
})();