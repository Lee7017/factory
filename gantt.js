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
 '清洗':'clean','配制':'blend','半成品 QC':'semi-qc','调机调线':'change',
 '包装':'pack','成品 QC':'final-qc','QA 放行':'qa'
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
const laneOptions={
 "清洗": [
  "L01 配制一线",
  "L02 配制二线"
 ],
 "配制": [
  "L01 配制一线",
  "L02 配制二线"
 ],
 "半成品 QC": [
  "QC 检验位"
 ],
 "调机调线": [
  "S03-4# 瓶装线",
  "S04 包装二线"
 ],
 "包装": [
  "S03-4# 瓶装线",
  "S04 包装二线"
 ],
 "成品 QC": [
  "QC 检验位"
 ],
 "QA 放行": [
  "QA 放行"
 ]
};
function taskSpan(item){
 const start=ms(item.start),duration=Number(item.duration);
 return Number.isFinite(start)&&Number.isFinite(duration)&&duration>0?{start,end:start+duration*60000}:null;
}
function hasConflict(a,b){
 const x=taskSpan(a),y=taskSpan(b);
 return !!(x&&y&&a.lane===b.lane&&x.start<y.end&&y.start<x.end);
}
function dayLayout(entries,day){
 const start=ms(stamp(day,0)),end=ms(stamp(dayShift(day,1),0));
 const rows={},conflictIds=new Set(),conflictPairs=new Set(),invalid=[];
 for(const lane of lanes){
  const visible=[];
  for(const item of entries.filter(e=>e.lane===lane.id)){
   const span=taskSpan(item);
   if(!span){invalid.push(item);continue}
   if(span.start<end&&span.end>start)visible.push({item,...span});
  }
  visible.sort((a,b)=>a.start-b.start||a.end-b.end||String(a.item.id).localeCompare(String(b.item.id)));
  const tracks=[],active=[],placements=[];
  for(const x of visible){
   for(const prev of active){
    if(x.start<prev.end){
     conflictIds.add(x.item.id);conflictIds.add(prev.item.id);
     conflictPairs.add([String(x.item.id),String(prev.item.id)].sort().join('|'));
    }
   }
   for(let i=active.length-1;i>=0;i--)if(active[i].end<=x.start)active.splice(i,1);
   let track=tracks.findIndex(lastEnd=>lastEnd<=x.start);
   if(track===-1){track=tracks.length;tracks.push(x.end)}else tracks[track]=x.end;
   active.push(x);
   const left=(Math.max(x.start,start)-start)/(end-start)*100;
   const width=(Math.min(x.end,end)-Math.max(x.start,start))/(end-start)*100;
   placements.push({item:x.item,track,left,width,span:x,continuedFromPrevious:x.start<start,continuesNext:x.end>end});
  }
  rows[lane.id]={placements,tracks:Math.max(1,tracks.length),height:Math.max(64,tracks.length*48+16)};
 }
 return {rows,conflictIds,conflictPairs:[...conflictPairs],invalid};
}
function nextFreeSlot(lane,notBefore,duration,occupied){
 if(!Number.isFinite(notBefore)||!Number.isFinite(duration)||duration<=0||duration>900)return null;
 let cursor=notBefore;
 for(let day=0;day<366;day++){
  const date=dayString(new Date(cursor));
  const dayOpen=ms(stamp(date,420)),dayClose=ms(stamp(date,1320));
  let candidate=Math.max(cursor,dayOpen);
  const busy=occupied.filter(x=>x.lane===lane).map(taskSpan).filter(Boolean)
   .filter(x=>x.end>candidate&&x.start<dayClose).sort((a,b)=>a.start-b.start);
  for(const block of busy){
   if(candidate+duration*60000<=block.start)break;
   if(block.end>candidate)candidate=block.end;
  }
  if(candidate+duration*60000<=dayClose)return candidate;
  cursor=ms(stamp(dayShift(date,1),420));
 }
 return null;
}
function allocateOrder(items,occupied,seed,keepOriginalTimes){
 const result=[];
 let cursor=seed;
 for(const item of items){
  const duration=Number(item.duration);
  const allowed=laneOptions[item.type]||[];
  if(!allowed.length||!Number.isFinite(duration)||duration<=0||duration>900)throw Error('自动试排无法安排 '+item.type+'：请检查工序和时长');
  const earliest=Math.max(cursor,keepOriginalTimes&&Number.isFinite(ms(item.start))?ms(item.start):seed);
  let choice=null;
  for(const lane of [item.lane,...allowed].filter((v,i,a)=>allowed.includes(v)&&a.indexOf(v)===i)){
   const start=nextFreeSlot(lane,earliest,duration,occupied.concat(result));
   if(start!==null&&(!choice||start<choice.start))choice={lane,start};
  }
  if(!choice)throw Error('无法找到空闲工位：'+item.type);
  result.push({...item,lane:choice.lane,start:dayString(new Date(choice.start))+'T'+pad(new Date(choice.start).getHours())+':'+pad(new Date(choice.start).getMinutes())});
  cursor=choice.start+duration*60000;
 }
 return result;
}
function optimizedPlan(stateData,orderIds){
 const eligible=new Set(orderIds);
 const occupied=stateData.gantt.filter(x=>!eligible.has(x.orderId));
 const draftOrders=orderIds.map(id=>({
  id,items:stateData.gantt.filter(x=>x.orderId===id).sort((a,b)=>stages.indexOf(a.type)-stages.indexOf(b.type))
 })).filter(x=>x.items.length).sort((a,b)=>{
  const min=items=>Math.min(...items.map(x=>ms(x.start)).filter(Number.isFinite));
  return min(a.items)-min(b.items)||a.id.localeCompare(b.id);
 });
 const proposed=[];
 for(const o of draftOrders){
  const seed=Math.min(...o.items.map(x=>ms(x.start)).filter(Number.isFinite));
  proposed.push(...allocateOrder(o.items,occupied.concat(proposed),Number.isFinite(seed)?seed:ms(stamp(dayString(new Date()),420)),true));
 }
 const byId=new Map(proposed.map(x=>[x.id,x]));
 const changes=stateData.gantt.filter(x=>byId.has(x.id)&&
  (x.start!==byId.get(x.id).start||x.lane!==byId.get(x.id).lane)).map(x=>({before:x,after:byId.get(x.id)}));
 return {changes,entries:stateData.gantt.map(x=>byId.get(x.id)||x)};
}

function ensure(){
 const s=state();if(!s)return;
 s.gantt??=[];s.ganttDay??=dayString(new Date());
 let changed=false;
 for(const order of ctx?.data?.orders||[]){
  if(s.flows?.[order.id]?.stage==='delivered')continue;
  if(s.gantt.some(x=>x.orderId===order.id))continue;
  const day=dayString(new Date());
  const jobs=defaults.map(([type,lane,start,duration],i)=>({
   id:'G-'+order.id+'-'+(i+1),orderId:order.id,type,lane,
   start:stamp(day,start),duration,source:'自动试排'
  }));
  try{s.gantt.push(...allocateOrder(jobs,s.gantt,ms(stamp(day,420)),false));changed=true}
  catch(error){console.warn('订单自动排程未完成',order.id,error)}
 }
 if(changed)ctx?.save?.();
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
function render(options={}){
 ensure();
 const overview=options.overview===true;
 const day=readDay(),view=dayLayout(state().gantt,day),canEdit=ctx.access.has('pmc','schedule','edit');
 const types=stages.map(type=>[type,categories[type]]);
 const times=Array.from({length:25},(_,i)=>`<span class="gantt-tick" style="left:${i/24*100}%">${pad(i)}:00</span>`).join('');
 const rows=lanes.map(lane=>{
  const layout=view.rows[lane.id];
  const bars=layout.placements.map(pos=>{
   const item=pos.item,conflict=view.conflictIds.has(item.id);
   const start=new Date(pos.span.start),end=new Date(pos.span.end);
   const time=d=>pad(d.getHours())+':'+pad(d.getMinutes());
   const summary=`${taskLabel(item.type)} · ${item.orderId} · ${time(start)}–${time(end)} · ${status(item)}${conflict?' · 同工位时间冲突':''}`;
   const sizeClass=pos.width<6?' is-mini':pos.width<12?' is-narrow':'';
   return `<button class="gantt-bar category-${categories[item.type]||'blend'}${conflict?' is-conflict':''}${sizeClass}" style="left:${pos.left.toFixed(4)}%;width:${pos.width.toFixed(4)}%;top:${11+pos.track*48}px" type="button" data-gantt="edit" data-gantt-id="${safe(item.id)}" aria-label="${safe(summary)}" title="${safe(summary)}"><strong>${safe(item.type)}</strong><small>${safe(item.orderId)} · ${time(start)}${conflict?' · 时间冲突':''}</small></button>`;
  }).join('');
  const n=layout.placements.filter(x=>view.conflictIds.has(x.item.id)).length;
  return `<div class="gantt-row" style="--gantt-row-height:${layout.height}px"><div class="gantt-lane"><strong>${safe(lane.id)}</strong><small>${safe(lane.desc)}${n?' · '+n+' 项冲突':''}</small></div><div class="gantt-track">${bars}</div></div>`;
 }).join('');
 const legend=types.map(([name,type])=>`<span class="gantt-legend-item"><i class="category-${type}"></i>${name}</span>`).join('');
 const n=lanes.reduce((sum,lane)=>sum+view.rows[lane.id].placements.length,0);
 const conflictCount=view.conflictPairs.length;
 const replans=(ctx.data.orders||[]).filter(o=>state().flows?.[o.id]?.stage==='trial'&&
  (state().flows[o.id].audit||[]).some(a=>a.action==='开工前一天物料不齐套，退回排程'));
 const replanNote=replans.length?'<div class="op-rule"><strong>开工前物料不足，已退回 PMC 重新排程</strong>'+
  replans.map(o=>'<p>'+safe(o.id)+'：'+safe((state().flows[o.id].audit||[]).filter(a=>a.action==='开工前一天物料不齐套，退回排程').slice(-1)[0]?.state||'请复查物料')+'</p>').join('')+'</div>':'';
 const warning=conflictCount?`<div class="gantt-warning" role="status"><strong>发现 ${conflictCount} 对同工位时间冲突</strong><span>冲突任务已分层显示，不代表工位能同时生产；可编辑任务或整理尚未发布的排程。</span></div>`:'';
 requestAnimationFrame(()=>{const sc=$('.gantt-scroll');if(sc)sc.scrollLeft=restoreLeft});
 return replanNote+`<section class="gantt-panel${overview?' gantt-overview':''}" aria-label="排产甘特图">
   <header class="gantt-panel-head"><div><h2>${overview?'今日生产排程':'排产甘特图'}</h2><p>横轴：24 小时 · 纵轴：产线 / 检验工位 · 短任务用工序颜色识别，悬停查看详情</p></div>
   <div class="gantt-controls"><button type="button" data-gantt="prev" aria-label="前一天">‹</button><input type="date" id="gantt-date" aria-label="选择排产日期" value="${day}"><button type="button" data-gantt="next" aria-label="后一天">›</button><button type="button" data-gantt="today">今天</button>${overview?'':(canEdit?'<button type="button" data-gantt="optimize" class="gantt-optimize">整理未发布排程</button>':'')+'<button type="button" data-gantt="add" class="gantt-add" '+(canEdit?'':'disabled title="无权修改排程"')+'>+ 新建任务</button>'}</div></header>
   <div class="gantt-legend">${legend}<span class="gantt-count">当天 ${n} 项任务${conflictCount?' · '+conflictCount+' 对冲突':''}</span></div>
   ${warning}
   <div class="gantt-scroll" tabindex="0" aria-label="可左右滚动的排产甘特图"><div class="gantt-canvas"><div class="gantt-head"><div class="gantt-lane gantt-lane-title">产线 / 工位</div><div class="gantt-hours">${times}</div></div>${rows}</div></div>
   <div class="gantt-foot"><strong>排程规则：</strong>同一工位不能同时执行两项任务；自动试排暂按 07:00–22:00 寻找空闲工位，依次安排清洗、配制、检验、调机调线、包装与放行（实际班次须由 PMC 确认）。整理仅调整未发布订单，正式排程及已开工任务不会自动移动。</div>
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
 const linked=s.flows?.[candidate.orderId];
 if(linked&&['formal','reserved'].includes(linked.stage)&&candidate.type==='配制'){
  linked.plannedStart=candidate.start.slice(0,10);
 }
 s.logs.unshift({at:new Date().toLocaleString('zh-CN'),person:ctx.access.current().name,action:idx>=0?'调整排程任务':'新增排程任务',ref:candidate.id,detail:`${candidate.type} ${candidate.lane} ${candidate.start}`});
 ctx.save();
 try{ops.checkPrestartMaterials?.()}catch(error){console.error('排程物料复查失败',error)}
 close();rerender();
}
function optimizeDraft(){
 if(!ctx.access.has('pmc','schedule','edit'))return;
 const inform=msg=>{
  if(window.FactoryPrompt?.show)window.FactoryPrompt.show(msg,{title:'排程检查结果'});
  else window.alert(msg);
 };
 const eligible=new Set(['draft','review','approved','trial']);
 const ids=(ctx.data.orders||[]).filter(o=>eligible.has(state().flows?.[o.id]?.stage||'draft')&&
  state().gantt.some(x=>x.orderId===o.id)).map(o=>o.id);
 if(!ids.length)return inform('没有可以自动整理的未发布排程。已发布或已进入生产的订单不会自动移动。');
 let proposal;
 try{proposal=optimizedPlan(state(),ids)}
 catch(error){return inform(error.message||'自动整理失败，请检查任务时长与工位配置。')}
 if(!proposal.changes.length)return inform('检查完成：未发布排程没有需要调整的工位冲突或工序顺序问题。');
 const countOrders=new Set(proposal.changes.map(x=>x.before.orderId)).size;
 const message='将调整 '+countOrders+' 张未发布订单的 '+proposal.changes.length+' 项任务（时间或工位）。\n已发布、已锁库及进入生产的任务不变。\n确认执行自动整理？';
 const apply=()=>{
  const moved=new Set(proposal.changes.map(x=>x.before.id));
  state().gantt=proposal.entries.map(x=>moved.has(x.id)?{...x,source:'自动整理排程'}:x);
  (state().logs??=[]).unshift({
   at:new Date().toLocaleString('zh-CN'),person:ctx.access.current().name,
   action:'自动整理未发布排程',ref:'PMC',detail:countOrders+' 张订单、'+proposal.changes.length+' 项任务'
  });
  ctx.save();rerender();
 };
 if(window.FactoryPrompt?.confirm)window.FactoryPrompt.confirm(message,apply,{title:'自动整理生产排程',confirmLabel:'确认整理'});
 else if(window.confirm(message))apply();
}
function rerender(){restoreLeft=$('.gantt-scroll')?.scrollLeft??restoreLeft;ctx.render();requestAnimationFrame(()=>{const scroll=$('.gantt-scroll');if(scroll)scroll.scrollLeft=restoreLeft});}
function onClick(ev){const el=ev.target.closest('[data-gantt]');if(!el)return;ev.stopPropagation();const a=el.dataset.gantt;
 if(a==='close'){close();return}if(a==='edit'){openEditor(el.dataset.ganttId);return}if(a==='add'){openEditor(null);return}if(a==='optimize'){optimizeDraft();return}
 if(a==='today')state().ganttDay=dayString(new Date());
 if(a==='prev')state().ganttDay=dayShift(readDay(),-1);
 if(a==='next')state().ganttDay=dayShift(readDay(),1);
 if(['today','prev','next'].includes(a)){ctx.save();rerender()}
}
function init(context){ctx=context;ensure()}
const baseRender=ops.render.bind(ops);
ops.render=function(feature){let html=baseRender(feature);if(feature!=='schedule')return html;return html.replace('<div class="ops-workbench">','<div class="ops-workbench">'+render())};
document.addEventListener('click',onClick,true);
document.addEventListener('scroll',ev=>{if(ev.target.matches?.('.gantt-scroll'))restoreLeft=ev.target.scrollLeft},true);
document.addEventListener('change',ev=>{if(ev.target.id==='gantt-date'){state().ganttDay=ev.target.value;ctx.save();rerender()}},true);
document.addEventListener('submit',ev=>{if(ev.target.id==='gantt-form'){ev.stopPropagation();save(ev)}},true);
window.FactoryGantt={init,render,validate,get entries(){return state()?.gantt||[]}};
window.FactoryGantt.renderOverview=()=>render({overview:true});
})();
