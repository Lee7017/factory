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
 '采购到货登记':['purchase','warehouse','来料比对'],
 '来料比对':['warehouse','quality','来料 QC 判定'],
 '来料 QC 合格':['quality','warehouse','批次入库确认'],
 '来料入库确认':['warehouse','warehouse','可用批次参与 FIFO 备料'],
 '采购单审批':['purchase','warehouse','采购到货与收货'],
 '成品出库单创建':['warehouse','warehouse','确认成品批次出库'],
 '成品销售出库':['warehouse','sales','成品已发出，销售可查看交付结果'],
 '填报工时':['production','production','本人确认工时'],
 '工时申诉提交':['production','hr','工时申诉审批'],
 '工时申诉审批':['hr','production','员工再次确认'],
 '开工前 Gate 检查':['pmc','production','执行车间工单'],
 '岗位排班':['pmc','production','开工前 Gate 校验'],
 '不合格品处置':['quality','production','返洗、返工或报废执行']
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
 [/^IN-/,'采购到货单','warehouse','warehouseOps'],
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
let tid=null,fadeTimer=null;
function show(entry){
 const host=document.querySelector('#flow-transition-host');if(!host||!entry)return;
 clearTimeout(tid);clearTimeout(fadeTimer);
 const from=label(entry.from),to=label(entry.to||entry.from),history=Array.isArray(entry.history)?entry.history.slice(-5):[];
 const same=from===to,doc=docMeta(entry);
 const action=entry.action||'操作完成',operator=entry.operator||history.at(-1)?.person||'当前用户',at=entry.at||history.at(-1)?.at||currentTime();
 const openButton=doc.dept&&doc.feature?`<button type="button" class="flow-open-doc" data-flow-open-dept="${clean(doc.dept)}" data-flow-open-feature="${clean(doc.feature)}">查看这张单据</button>`:'';
 host.innerHTML=`<div class="flow-veil" aria-hidden="true"></div><section class="flow-window" role="status" aria-label="业务流转结果">
   <div class="flow-window-top"><div class="flow-signal"><span class="flow-signal-dot">✓</span><span>单据流转已更新</span></div><button type="button" class="flow-close" data-flow-close aria-label="关闭流转提示">×</button></div>
   <header class="flow-document">
     <span class="flow-document-type">${clean(doc.type)}</span>
     <strong class="flow-document-id">${clean(doc.ref)}</strong>
     ${doc.summary?`<p class="flow-document-summary">${clean(doc.summary)}</p>`:''}
   </header>
   <div class="flow-path">
     <div class="flow-node"><small>${same?'处理部门':'本次处理部门'}</small><strong>${clean(from)}</strong></div>
     <div class="flow-travel"><span class="flow-route-line"></span><span class="flow-route-arrow">${same?'·':'→'}</span></div>
     <div class="flow-node flow-node-dest"><small>${same?'当前仍由该部门处理':'下一处理部门'}</small><strong>${clean(to)}</strong></div>
   </div>
   <div class="flow-state"><span>当前状态 <b>${clean(entry.status||'已更新')}</b></span><span>下一步 <b>${clean(entry.next||'查看对应业务记录')}</b></span></div>
   <div class="flow-history-title"><strong>这张单据怎么走到这里</strong><span>${history.length} 条近期记录</span></div>
   <div class="flow-history">${history.length?history.map((h,i)=>`<div class="flow-history-row"><span class="flow-history-dot ${i===history.length-1?'is-current':''}"></span><span class="flow-history-dept">${clean(label(h.from||h.dept))}</span><span class="flow-history-action">${clean(h.action||'状态更新')}</span><small>${clean(h.at||'')}</small></div>`).join(''):'<div class="flow-history-empty">当前是这张单据的第一条业务记录</div>'}</div>
   <div class="flow-action-receipt"><span>刚刚执行</span><strong>${clean(action)}</strong><small>${clean(operator)} · ${clean(at)}</small></div>
   <footer class="flow-bottom"><span>画面会自动消退</span><div class="flow-bottom-actions">${openButton}<button type="button" data-flow-close>继续操作</button></div></footer>
   <div class="flow-timer"></div>
 </section>`;
 host.classList.remove('flow-dismiss');host.classList.add('flow-visible');
 tid=setTimeout(()=>dismiss(),6500);
}
function dismiss(){const host=document.querySelector('#flow-transition-host');if(!host)return;host.classList.remove('flow-visible');host.classList.add('flow-dismiss');clearTimeout(tid);fadeTimer=setTimeout(()=>{if(!host.classList.contains('flow-visible'))host.innerHTML=''},450)}
function fromAudit(row,history,defaultDept){const rule=routes[row.type]||Object.entries(routes).find(([key])=>String(row.type).includes(key))?.[1];let from=rule?.[0]||defaultDept||'当前部门',to=rule?.[1]||from;
 const newer=rule?.[2]||'查看对应单据状态和待办';show({ref:row.ref,action:row.type,from,to,next:newer,status:row.detail||'已记录',summary:row.detail||'',operator:row.by||'当前用户',at:row.time||'',history});}
document.addEventListener('click',ev=>{
 const open=ev.target.closest('[data-flow-open-dept]');
 if(open){const dept=open.dataset.flowOpenDept,feature=open.dataset.flowOpenFeature;dismiss();if(dept&&feature)location.hash=`#/departments/${dept}/${feature}`;return;}
 if(ev.target.closest('[data-flow-close]'))dismiss();
});
document.addEventListener('keydown',ev=>{if(ev.key==='Escape')dismiss()});
window.FactoryFlowUI={show,dismiss,fromAudit,names:deptNames};
})();
