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
 const window={
  FactoryOperations:{
   state:{flows:{'SO-TEST':{stage:'packaging',audit:history}},purchases:[],purchaseRequests:[]},
   getOrder:()=>({id:'SO-TEST',product:'测试品',spec:'5L × 4桶',qty:100})
  }
 };
 vm.runInNewContext(script,{window,document:{addEventListener() {},querySelector(){return null}},
  setTimeout(){},clearTimeout(){},requestAnimationFrame(){},console});
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
test('each return is numbered with reason and routed through adjacent gaps only',()=>{
 const api=boot(history),html=api.debug.renderGraph({ref:'SO-TEST',kind:'order'});
 const events=api.debug.returnEvents(history,'order',19);
 assert.equal(events.length,2);
 assert.equal(events[0].number,1);assert.equal(events[0].from,9);assert.equal(events[0].to,6);
 assert.equal(events[1].number,2);assert.equal(events[1].from,14);assert.equal(events[1].to,11);
 assert.match(html,/第1次打回/);assert.match(html,/第2次打回/);
 assert.match(html,/粘度不合格/);assert.match(html,/封口不良/);
 const paths=[...html.matchAll(/<path class="journey-snake-return" d="([^"]+)"/g)].map(x=>x[1]);
 assert.equal(paths.length,6); // 10 → 9 → 8 → 7 and 15 → 14 → 13 → 12.
 assert.ok(paths.every(d=>/^(M\d+ \d+ (?:L\d+ \d+|V\d+))$/.test(d)));
});
test('repeated execution stays on fixed-size cards and opens actual operator history',()=>{
 const api=boot(history),html=api.debug.renderGraph({ref:'SO-TEST',kind:'order'});
 assert.match(html,/data-flow-step-history="6"[^>]*>2次执行/);
 assert.match(html,/data-flow-step-returns="9"[^>]*>退回1次/);
 assert.match(html,/--gantt-row-height|journey-snake-position/);
 assert.doesNotMatch(html,/journey-tab-panel/);
 const css=fs.readFileSync(path.join(__dirname,'..','flow-ui.css'),'utf8');
 assert.match(css,/\.journey-history-row/);
 assert.match(css,/\.journey-order-panel-backdrop/);
});
