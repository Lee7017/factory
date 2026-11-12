/* Run: node --test tests/flow-ui.test.cjs */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
function boot(history){
 const original=fs.readFileSync(path.join(__dirname,'..','flow-ui.js'),'utf8');
 const signature='window.FactoryFlowUI={show,openDocument,dismiss,fromAudit,names:deptNames,flowConfig};';
 assert.ok(original.includes(signature));
 const script=original.replace(signature,'window.FactoryFlowUI={show,openDocument,dismiss,fromAudit,names:deptNames,flowConfig,debug:{renderGraph,returnEvents}};');
 const host={innerHTML:'',classList:{add(){},remove(){}},querySelector(){return null}};
 const listeners={};
 const window={
  FactoryOperations:{
   state:{flows:{'SO-TEST':{stage:'packaging',audit:history}},purchases:[],purchaseRequests:[]},
   getOrder:()=>({id:'SO-TEST',product:'测试品',spec:'5L × 4桶',qty:100})
  },
  FactoryNavigation:{trackBottleneck(target,ref){window.lastTracked={target,ref}}}
 };
 const document={
  addEventListener(type,callback){listeners[type]=callback},
  querySelector(selector){return selector==='#flow-transition-host'?host:null}
 };
 vm.runInNewContext(script,{window,document,
  setTimeout(){},clearTimeout(){},requestAnimationFrame(){},console});
 window.FactoryFlowUI.testView={host,listeners,window};
 return window.FactoryFlowUI;
}
const history=[
 {action:'接收订单并提交评审',at:'11/11 08:00',person:'销售员'},
 {action:'评审通过',at:'11/11 08:10',person:'主管'},
 {action:'配制开工',at:'11/11 09:00',person:'甲'},
 {action:'配制任务完成',at:'11/11 10:00',person:'甲'},
 {action:'半成品不合格 / 返回配制',at:'11/11 10:10',person:'检验员',reason:'粘度不合格'},
 {action:'配制开工',at:'11/11 11:00',person:'乙'},
 {action:'配制任务完成',at:'11/11 12:00',person:'乙'},
 {action:'成品不合格 / 返回包装',at:'11/11 13:00',person:'检验员',reason:'封口不良'}
];
test('first two order cards open Order Content directly, with no tabs',()=>{
 const api=boot(history),html=api.debug.renderGraph({ref:'SO-TEST',kind:'order'});
 assert.match(html,/接收订单并提交评审/);
 assert.match(html,/订单评审通过/);
 assert.equal((html.match(/data-flow-order-content/g)||[]).length,2);
 assert.doesNotMatch(html,/data-journey-tab/);
});
test('pending order review keeps its tracking action instead of being replaced by order content',()=>{
 const api=boot([{action:'接收订单并提交评审',at:'11/11 15:27',person:'小明'}]);
 const {host,listeners,window}=api.testView;
 const show=stage=>api.show({
  kind:'order',ref:'SO-TEST',stage,
  nextOpen:{dept:'sales',feature:stage==='review'?'orderReview':'orders',record:'SO-TEST'}
 });
 const card=(index)=>{
  const start=host.innerHTML.indexOf('data-journey-step="'+index+'"');
  assert.ok(start>=0,"Flow step "+index+" must exist");
  const end=host.innerHTML.indexOf('<div class="journey-dept">',start);
  return host.innerHTML.slice(start,end);
 };
 show('review');
 assert.match(card(0),/data-flow-order-content/,"Completed order intake retains its order document");
 assert.match(card(1),/data-flow-track/,"Current review step must provide a tracking button");
 assert.match(card(1),/跟踪当前环节/);
 assert.doesNotMatch(card(1),/data-flow-order-content/,"Pending review must not override tracking");
 assert.doesNotMatch(card(2),/data-flow-order-content|data-flow-track/,
  "Future steps are not actionable as completed documents");
 listeners.click({target:{
  closest(selector){return selector==='[data-flow-track]'?{}:null},
  matches(){return false}
 }});
 assert.equal(window.lastTracked?.target.dept,'sales');
 assert.equal(window.lastTracked?.target.feature,'orderReview');
 assert.equal(window.lastTracked?.ref,'SO-TEST');
 show('approved');
 assert.match(card(1),/data-flow-order-content/,"Once reviewed, the order document can be opened");
 assert.doesNotMatch(card(1),/data-flow-track/,"Completed review is no longer the bottleneck");
 show('draft');
 assert.match(card(0),/data-flow-track/,"Draft order's current first step also keeps tracking");
 assert.doesNotMatch(card(0),/data-flow-order-content/);
});
test('red return segments show a single arrowhead at each final destination',()=>{
 const api=boot(history),html=api.debug.renderGraph({ref:'SO-TEST',kind:'order'});
 const events=api.debug.returnEvents(history,'order',19);
 assert.equal(events.length,2);
 assert.equal(events[0].from,9);assert.equal(events[0].to,6);
 assert.equal(events[1].from,14);assert.equal(events[1].to,11);
 assert.doesNotMatch(html,/journey-return-overview|第1次打回|第2次打回/);
 assert.match(html,/data-flow-return-list/);
 const paths=[...html.matchAll(/<path class="journey-snake-return" d="([^"]+)"([^>]*)>/g)];
 assert.equal(paths.length,6); // 10→9→8→7 and 15→14→13→12
 assert.equal(paths.filter(x=>x[2].includes('marker-end=')).length,2);
 assert.ok(paths.every(x=>/^(M\d+ \d+ (?:L\d+ \d+|V\d+))$/.test(x[1])));
 const finalPaths=paths.filter(x=>x[2].includes('marker-end=')).map(x=>x[1]);
 assert.ok(finalPaths.some(x=>x.includes('L')));
 assert.ok(finalPaths.some(x=>x.includes('V')));
});
test('fixed-height cards have no attempt or return counts and open the side drawer',()=>{
 const api=boot(history),html=api.debug.renderGraph({ref:'SO-TEST',kind:'order'});
 assert.doesNotMatch(html,/次执行|次打回|data-flow-step-history|data-flow-step-returns/);
 assert.doesNotMatch(html,/journey-return-overview|journey-tab-panel/);
 assert.match(html,/data-flow-step-open="6"/);
 assert.match(html,/data-flow-card-step="6"/);
 const css=fs.readFileSync(path.join(__dirname,'..','flow-ui.css'),'utf8');
 assert.match(css,/\.journey-order-panel-backdrop/);
 assert.match(css,/justify-content:flex-end/);
 assert.match(css,/\.journey-history-row/);
});

test('clicking a flow card opens operator history and return details in a right-side drawer',()=>{
 const original=fs.readFileSync(path.join(__dirname,'..','flow-ui.js'),'utf8');
 const listeners={},host={
  innerHTML:'',classList:{add(){},remove(){}},querySelector(){return null},
  insertAdjacentHTML(_,html){this.lastPanel=html}
 };
 const document={
  querySelector:q=>q==='#flow-transition-host'?host:null,
  addEventListener:(type,fn)=>{listeners[type]=fn}
 };
 const window={
  FactoryOperations:{state:{flows:{'SO-TEST':{stage:'packaging',audit:history}},purchases:[]},
   getOrder:()=>({id:'SO-TEST',product:'测试品',spec:'5L × 4桶',qty:100})}
 };
 vm.runInNewContext(original,{window,document,setTimeout(){},clearTimeout(){},requestAnimationFrame(){},console});
 window.FactoryFlowUI.show({ref:'SO-TEST',kind:'order'});
 assert.ok(!host.innerHTML.includes('journey-return-overview'));
 const click=(selector,dataset={})=>listeners.click({
  target:{closest:q=>q===selector?{dataset}:null,matches:()=>false}
 });
 click('[data-flow-card-step]',{flowCardStep:'6'});
 assert.match(host.lastPanel,/journey-order-panel/);
 assert.match(host.lastPanel,/11\/11 09:00/);
 assert.match(host.lastPanel,/11\/11 11:00/);
 assert.match(host.lastPanel,/粘度不合格/);
 assert.doesNotMatch(host.lastPanel,/第\s*\d+\s*次/);
 click('[data-flow-return-list]');
 assert.match(host.lastPanel,/封口不良/);
 assert.match(host.lastPanel,/打回记录/);
});
