/* PMC 时间—产线排程。共享 FactoryOperations 状态和页面渲染，不建立第二套业务状态。 */
(()=>{'use strict';
const $=s=>document.querySelector(s);
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ops=window.FactoryOperations;
const lanes=[
 {id:'L01 配制一线',desc:'配制'},
 {id:'L02 配制二线',desc:'配制'},
 {id:'S03-4# 瓶装线',desc:'包装'},
 {id:'S04 包装二线',desc:'包装'},
 {id:'QC 检验位',desc:'QA / QC 检验'},
 {id:'QA 放行',desc:'质量审核'}
];
const categories={
 '清洗':'clean','配制':'make','半成品 QC':'qc','调机调线':'change',
 '包装':'make','成品 QC':'qc','QA 放行':'qa'
};
const stages=['清洗','配制','半成品 QC','调机调线','包装','成品 QC','QA 放行'];
const nonProductionTypes=new Set(['清洗','调机调线']);
const taskLabel=type=>nonProductionTypes.has(type)?`非生产 · ${type}`:type;
const defaults=[
 ['清洗','L01 配制一线',420,60],
 ['配制','L01 配制一线',480,210],
 ['半成品 QC','QC 检验位',690,60],
 ['调机调线','S03-4# 瓶装线',750,60],
 ['包装','S03-4# 瓶装线',810,180],
 ['成品 QC','QC 检验位',990,60],
 ['QA 放行','QA 放行',1050,45]
];
const pad=n=>String(n).padStart(2,'0');
const dayString=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parseLocal=s=>new Date(`${String(s).replace(' ','T')}:00`.replace(/:00:00$/,':00'));
const stamp=(day,min)=>`${day}T${pad(Math.floor(min/60))}:${pad(min%60)}`;
const ms=s=>new Date(s).getTime();
const dayShift=(day,delta)=>{let d=new Date(day+'T12:00:00');d.setDate(d.getDate()+delta);return dayString(d)};
let ctx=null;
let editId=null;
let restoreLeft=360;
const state=()=>ops.state;
function ensure(){
 const s=state();if(!s)return;
 s.gantt??=[];
 s.ganttDay??=dayString(new Date());
 const orders=ctx?.data?.orders||[];
 for(const order of orders){
   if(s.gantt.some(x=>x.orderId===order.id))continue;
   const orderIdx=orders.indexOf(order);
   const day=dayShift(s.ganttDay,orderIdx);
   defaults.forEach(([type,lane,start,duration],i)=>{
     s.gantt.push({id:`G-${order.id}-${i+1}`,orderId:order.id,type,lane,
       start:stamp(day,start),duration,source:'订单排程'});
   });
 }
 ctx?.save?.();
}
function status(entry){
 const flow=state().flows[entry.orderId]?.stage||'draft';
 const order=['draft','review','approved','trial','formal','reserved','issued','blending','semi_qc','semi_ok','packaging','final_qc','inspected','released','stored'];
 const rank=order.indexOf(flow);
 const expected={'清洗':7,'配制':8,'半成品 QC':9,'调机调线':10,'包装':11,'成品 QC':12,'QA 放行':13};
 const taskType=entry.type==='清洗'||entry.type==='调机调线'?entry.type:null;
 const task=taskType&&ctx.data.tasks?.find(t=>t.type===taskType);
 if(task&&task.status!=='待开始')return task.status;
 if(rank<3)return '待排程';if(rank===3)return '试算';
 if(rank >= expected[entry.type])return '流程已推进';
 return '已排程';
}
function readDay(){return state().ganttDay}
function fmtMin(m){return `${pad(Math.floor(m/60))}:${pad(m%60)}`}
function startMinute(x){const d=new Date(x.start);return d.getHours()*60+d.getMinutes()}
function render(){
 ensure();ops.checkPrestartMaterials?.();const day=readDay(),entries=state().gantt.filter(x=>x.start.slice(0,10)===day);
 const canEdit=ctx.access.has('pmc','schedule','edit');
 const types=[['生产任务 · 配制 / 包装','make'],['非生产 · 清洗','clean'],['非生产 · 调机调线','change'],['QC 检验','qc'],['QA 放行','qa']];
 const times=Array.from({length:25},(_,i)=>`<span class="gantt-tick" style="left:${i/24*100}%">${pad(i)}:00</span>`).join('');
 const rows=lanes.map(lane=>{
  const bars=entries.filter(x=>x.lane===lane.id).map(item=>{
   const start=startMinute(item),end=Math.min(1440,start+Number(item.duration));
   if(start>=1440||end<=0)return '';
   const width=Math.max(8,(end-start)/1440*100);
   const label=`${taskLabel(item.type)} · ${item.orderId} · ${fmtMin(start)}–${fmtMin(end)} · ${status(item)}`;
   return `<button class="gantt-bar category-${categories[item.type]}" style="left:${(start/1440*100).toFixed(4)}%;width:${width.toFixed(4)}%" type="button" data-gantt="edit" data-gantt-id="${safe(item.id)}" aria-label="${safe(label)}" title="${safe(label)}"><strong>${safe(taskLabel(item.type))}</strong><small>${safe(item.orderId)} · ${fmtMin(start)}</small></button>`;
  }).join('');
  return `<div class="gantt-row"><div class="gantt-lane"><strong>${safe(lane.id)}</strong><small>${safe(lane.desc)}</small></div><div class="gantt-track">${bars}</div></div>`;
 }).join('');
 const legend=types.map(([name,type])=>`<span class="gantt-legend-item"><i class="category-${type}"></i>${name}</span>`).join('');
 const n=entries.length;
 const replans=(ctx.data.orders||[]).filter(o=>state().flows?.[o.id]?.stage==='trial'&&(state().flows[o.id].audit||[]).some(a=>a.action==='开工前一天物料不齐套，退回排程'));
 const replanNote=replans.length?'<div class="op-rule"><strong>开工前物料不足，已退回排程</strong>'+replans.map(o=>{
  const audit=(state().flows[o.id].audit||[]).filter(a=>a.action==='开工前一天物料不齐套，退回排程').at(-1);
  return '<p>'+safe(o.id)+'：'+safe(audit?.state||'请复查物料')+'。请调整生产计划，再重新发布正式排程。</p>';
 }).join('')+'</div>':'';
 requestAnimationFrame(()=>{const sc=$('.gantt-scroll');if(sc)sc.scrollLeft=restoreLeft});
 return replanNote+`<section class="gantt-panel" aria-label="排产甘特图">
   <header class="gantt-panel-head"><div><h2>排产甘特图</h2><p>横轴：时间　纵轴：产线及质检工位 · 点击任务调整时间和产线</p></div>
   <div class="gantt-controls"><button type="button" data-gantt="prev" aria-label="前一天">‹</button><input type="date" id="gantt-date" aria-label="选择排产日期" value="${day}"><button type="button" data-gantt="next" aria-label="后一天">›</button><button type="button" data-gantt="today">今天</button><button type="button" class="gantt-add" data-gantt="add" ${canEdit?'':'title="无权修改排程"'}>+ 新建任务</button></div></header>
   <div class="gantt-legend">${legend}<span class="gantt-count">当天 ${n} 项任务</span></div>
   <div class="gantt-scroll" tabindex="0" aria-label="可左右滚动的排产甘特图"><div class="gantt-canvas"><div class="gantt-head"><div class="gantt-lane gantt-lane-title">产线 / 工位</div><div class="gantt-hours">${times}</div></div>${rows}</div></div>
   <div class="gantt-foot"><strong>非生产任务：</strong>清洗、调机调线均有独立任务、开工、完工及复核；不计入生产产量。<strong>生产任务：</strong>配制、包装。QC 检验和 QA 放行按各自工位安排。同一工位时间冲突时不允许保存。</div>
 </section>`;
}
function showError(msg){const el=$('#gantt-error');if(el){el.textContent=msg;el.hidden=false;}}
function close(){const el=$('#gantt-dialog-host');if(el)el.innerHTML='';editId=null}
function openEditor(id){
 ensure();const item=state().gantt.find(x=>x.id===id);editId=id||null;
 if(!ctx.access.has('pmc','schedule','edit')){
   const target=document.querySelector(id?`[data-gantt-id="${CSS.escape(id)}"]`:'[data-gantt="add"]');ctx.flashDenied(target);return;
 }
 const orders=ctx.data.orders||[];if(!orders.length)return;
 const day=readDay();const current=item||{orderId:orders[0].id,type:'清洗',lane:'L01 配制一线',start:stamp(day,420),duration:60};
 const options=(list,value)=>list.map(([key,text])=>`<option value="${safe(key)}" ${key===value?'selected':''}>${safe(text)}</option>`).join('');
 const host=$('#gantt-dialog-host')||document.body.appendChild(Object.assign(document.createElement('div'),{id:'gantt-dialog-host'}));
 host.innerHTML=`<div class="gantt-shade" data-gantt="close"></div><div class="gantt-dialog" role="dialog" aria-modal="true" aria-label="编辑排程任务"><header><h3>${item?'编辑排程任务':'新增排程任务'}</h3><button data-gantt="close" aria-label="关闭">×</button></header><form id="gantt-form">
   <label>关联订单<select name="orderId">${options(orders.map(o=>[o.id,`${o.id} · ${o.product}`]),current.orderId)}</select></label>
   <label>任务类型<select name="type">${options(stages.map(x=>[x,taskLabel(x)]),current.type)}</select></label>
   <label>产线 / 检验工位<select name="lane">${options(lanes.map(x=>[x.id,x.id]),current.lane)}</select></label>
   <label>计划开始时间<input type="datetime-local" name="start" required value="${safe(current.start)}"></label>
   <label>计划工时（分钟）<input type="number" name="duration" min="15" max="1440" step="15" required value="${current.duration}"></label>
   <p class="gantt-error" id="gantt-error" hidden role="alert"></p><footer><button type="button" data-gantt="close">取消</button><button type="submit" class="gantt-save">保存排程</button></footer>
   </form></div>`;
}
function validate(candidate){
 const start=ms(candidate.start),duration=Number(candidate.duration),end=start+duration*60000;
 if(!Number.isFinite(start)||!Number.isFinite(end)||duration<15||duration>1440)return '开始时间或任务时长无效。';
 if(!lanes.some(x=>x.id===candidate.lane))return '请选择有效产线或检验工位。';
 if(!ctx.data.orders.some(o=>o.id===candidate.orderId))return '关联订单不存在。';
 const allowedLanes={'清洗':['L01 配制一线','L02 配制二线'],'配制':['L01 配制一线','L02 配制二线'],'半成品 QC':['QC 检验位'],'调机调线':['S03-4# 瓶装线','S04 包装二线'],'包装':['S03-4# 瓶装线','S04 包装二线'],'成品 QC':['QC 检验位'],'QA 放行':['QA 放行']};
 if(!allowedLanes[candidate.type]?.includes(candidate.lane))return `${candidate.type} 不能排到这个工位。`;
 if(new Date(candidate.start).getDate()!==new Date(end-1).getDate())return '当前按自然日排程：请把跨零点任务拆成两段。';
 const others=state().gantt.filter(x=>x.id!==candidate.id);
 if(others.some(x=>x.lane===candidate.lane&&start<ms(x.start)+Number(x.duration)*60000&&end>ms(x.start)))return `「${candidate.lane}」存在时间冲突，需调整开始时间或工位。`;
 const sameOrder=others.filter(x=>x.orderId===candidate.orderId);
 if(sameOrder.some(x=>x.type===candidate.type))return '同一订单已有此任务，请编辑已有任务。';
 const rank=stages.indexOf(candidate.type);
 if(sameOrder.some(x=>stages.indexOf(x.type)<rank&&ms(x.start)+Number(x.duration)*60000>start))return '该任务开始时间早于本订单上一工序结束时间。';
 if(sameOrder.some(x=>stages.indexOf(x.type)>rank&&ms(x.start)<end))return '该任务结束时间晚于本订单后续工序开始时间。';
 return '';
}
function save(ev){ev.preventDefault();if(!ctx.access.has('pmc','schedule','edit'))return;
 const form=Object.fromEntries(new FormData(ev.target).entries());
 const candidate={id:editId||`G-${Date.now()}`,orderId:form.orderId,type:form.type,lane:form.lane,start:form.start,duration:Number(form.duration),source:'手工排程'};
 const error=validate(candidate);if(error){showError(error);return;}
 const s=state(),idx=s.gantt.findIndex(x=>x.id===candidate.id);
 if(idx>=0)s.gantt[idx]=candidate;else s.gantt.push(candidate);
 s.ganttDay=candidate.start.slice(0,10);
 s.logs.unshift({at:new Date().toLocaleString('zh-CN'),person:ctx.access.current().name,action:idx>=0?'调整排程任务':'新增排程任务',ref:candidate.id,detail:`${candidate.type} ${candidate.lane} ${candidate.start}`});
 ctx.save();ops.checkPrestartMaterials?.();close();rerender();
}
function rerender(){restoreLeft=$('.gantt-scroll')?.scrollLeft??restoreLeft;ctx.render();requestAnimationFrame(()=>{const scroll=$('.gantt-scroll');if(scroll)scroll.scrollLeft=restoreLeft});}
function onClick(ev){const el=ev.target.closest('[data-gantt]');if(!el)return;ev.stopPropagation();const a=el.dataset.gantt;
 if(a==='close'){close();return}if(a==='edit'){openEditor(el.dataset.ganttId);return}if(a==='add'){openEditor(null);return}
 if(a==='today')state().ganttDay=dayString(new Date());
 if(a==='prev')state().ganttDay=dayShift(readDay(),-1);
 if(a==='next')state().ganttDay=dayShift(readDay(),1);
 if(['today','prev','next'].includes(a)){ctx.save();rerender()}
}
function init(context){ctx=context;ensure();ops.checkPrestartMaterials?.()}
const baseRender=ops.render.bind(ops);
ops.render=function(feature){let html=baseRender(feature);if(feature!=='schedule')return html;return html.replace('<div class="ops-workbench">','<div class="ops-workbench">'+render())};
document.addEventListener('click',onClick,true);
document.addEventListener('scroll',ev=>{if(ev.target.matches?.('.gantt-scroll'))restoreLeft=ev.target.scrollLeft},true);
document.addEventListener('change',ev=>{if(ev.target.id==='gantt-date'){state().ganttDay=ev.target.value;ctx.save();rerender()}},true);
document.addEventListener('submit',ev=>{if(ev.target.id==='gantt-form'){ev.stopPropagation();save(ev)}},true);
window.FactoryGantt={init,render,validate,get entries(){return state()?.gantt||[]}};
})();
