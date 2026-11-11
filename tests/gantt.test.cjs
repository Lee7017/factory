/* Run: node --test tests/gantt.test.cjs */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const scheduling = require('../web/src/scheduling-definitions.json');
const vm = require('node:vm');

const original = fs.readFileSync(path.join(__dirname, '..', 'gantt.js'), 'utf8');
const exportLine = 'window.FactoryGantt={init,render,validate,get entries(){return state()?.gantt||[]}};';
assert.ok(original.includes(exportLine), 'Gantt public API changed: update the harness');
const script = original.replace(exportLine,
 'window.FactoryGantt={init,render,validate,debug:{dayLayout,optimizedPlan,hasConflict},get entries(){return state()?.gantt||[]}};');

function boot(orders, existing = [], flows = {}) {
 const state = {gantt: existing, flows, logs: [], ganttDay: '2026-11-11'};
 const listeners = {};
 const win = {
  FactoryOperations: {state, render: () => '<div class="ops-workbench"></div>'},
  FactorySchedulingConfig:scheduling,
  confirm: () => true, alert: () => {}
 };
 const doc = {
  querySelector: () => null,
  addEventListener: (event, handler) => (listeners[event] ??= []).push(handler)
 };
 vm.runInNewContext(script, {
  window: win, document: doc, CSS: {escape: x => x}, FormData,
  requestAnimationFrame() {}, console, setTimeout
 }, {filename: 'gantt.js'});
 let saves = 0;
 const ctx = {
  data: {orders, tasks: []}, save: () => {saves++},
  access: {has: () => true, current: () => ({name: 'test'})}, render() {}
 };
 win.FactoryGantt.init(ctx);
 return {api: win.FactoryGantt, state, get saves(){return saves}};
}

const order = id => ({id, product: '测试产品'});
const entry = (id, orderId, type, lane, start, duration) =>
 ({id, orderId, type, lane, start, duration, source: '手工排程'});

test('30 orders generate resource-feasible, sequential tasks without repeated saves', () => {
 const orders = Array.from({length: 30}, (_,i) => order('T'+i));
 const flows = Object.fromEntries(orders.map(o => [o.id, {stage: 'approved'}]));
 const app = boot(orders, [], flows);
 assert.equal(app.state.gantt.length, 180);
 for(let i=0;i<app.state.gantt.length;i++){
  const a=app.state.gantt[i];
  for(let j=i+1;j<app.state.gantt.length;j++){
   assert.equal(app.api.debug.hasConflict(a,app.state.gantt[j]),false,a.id+' vs '+app.state.gantt[j].id);
  }
 }
 for(const o of orders) {
  const tasks=app.state.gantt.filter(x=>x.orderId===o.id);
  for(let i=1;i<tasks.length;i++)
   assert.ok(Date.parse(tasks[i].start)>=Date.parse(tasks[i-1].start)+tasks[i-1].duration*60000);
 }
 const saves=app.saves;
 app.api.render();
 assert.equal(app.saves,saves,'render must not persist unchanged schedule');
});

test('overlapping tasks get separate tracks; a 15-minute bar remains proportional', () => {
 const jobs=[
  entry('A','A','配制','L01 配制一线','2026-11-11T08:00',120),
  entry('B','B','清洗','L01 配制一线','2026-11-11T08:15',60),
  entry('C','C','半成品 QC','QC 检验位','2026-11-11T11:00',15)
 ];
 const app=boot([order('A'),order('B'),order('C')],jobs);
 const layout=app.api.debug.dayLayout(jobs,'2026-11-11');
 assert.equal(layout.conflictPairs.length,1);
 assert.equal(layout.rows['L01 配制一线'].tracks,2);
 assert.equal(layout.rows['L01 配制一线'].height,112);
 assert.ok(Math.abs(layout.rows['QC 检验位'].placements[0].width-100/96)<0.0001);
 const html=app.api.render();
 assert.match(html,/width:1\.0417%/);
 assert.match(html,/同工位时间冲突/);
});

test('optimizing unpublished tasks resolves conflicts without moving formal schedules', () => {
 const fixed=entry('P','P','配制','L01 配制一线','2026-11-11T08:00',120);
 const move=entry('D','D','配制','L01 配制一线','2026-11-11T08:30',210);
 const app=boot([order('P'),order('D')],[fixed,move],{P:{stage:'formal'},D:{stage:'trial'}});
 const plan=app.api.debug.optimizedPlan(app.state,['D']);
 assert.ok(plan.changes.length>=1);
 assert.equal(plan.entries.find(x=>x.id==='P').start,fixed.start);
 assert.equal(plan.entries.find(x=>x.id==='P').lane,fixed.lane);
 assert.equal(app.api.debug.hasConflict(plan.entries[0],plan.entries[1]),false);
});

test('PMC compact and full views share a six-color task renderer', () => {
 const jobs=[
  entry('X','X','配制','L01 配制一线','2026-11-11T08:00',120),
  entry('Y','Y','清洗','L01 配制一线','2026-11-11T08:15',60),
  entry('Z','Z','半成品 QC','QC 检验位','2026-11-11T11:00',15)
 ];
 const app=boot([order('X'),order('Y'),order('Z')],jobs);
 const home=app.api.renderOverview(),pmc=app.api.render();
 assert.match(home,/class="gantt-panel gantt-overview"/);
 assert.match(home,/--gantt-row-height:112px/);
 assert.match(home,/is-mini/);
 const positions=html=>Array.from(html.matchAll(/class="gantt-bar [^"]+" style="([^"]+)"/g),m=>m[1]);
 assert.deepEqual(positions(home),positions(pmc));
 const classes=['clean','blend','semi-qc','change','pack','final-qc'];
 assert.ok(classes.every(x=>home.includes('category-'+x)),'six legend categories required');
 const css=fs.readFileSync(path.join(__dirname,'..','gantt.css'),'utf8');
 const palette=classes.map(x=>{
  const result=css.match(new RegExp('--gantt-'+x+':(#[0-9a-fA-F]{6})'));
  assert.ok(result,x+' color token missing');
  return result[1].toLowerCase();
 });
 assert.equal(new Set(palette).size,6,'operation colors must be distinct');
 const modules=fs.readFileSync(path.join(__dirname,'..','modules.js'),'utf8');
 assert.match(modules,/FactoryGantt\?\.renderOverview\?\.\(\)/);
});

test('only two QAQC tasks remain; old QC names migrate and old QA release schedule is preserved in archive', () => {
 const old=[
  entry('Q1','X','半成品 QC','QC 检验位','2026-11-11T11:00',60),
  entry('Q2','X','成品 QC','QC 检验位','2026-11-11T16:00',60),
  entry('Q3','X','QA 放行','QA 放行','2026-11-11T17:30',45)
 ];
 const app=boot([order('X')],old);
 assert.equal(app.state.gantt.length,2);
 assert.deepEqual(app.state.gantt.map(x=>x.type),['半成品 QAQC','成品 QAQC']);
 assert.equal(app.state.ganttArchived.length,1);
 assert.equal(app.state.ganttArchived[0].id,'Q3');
 const html=app.api.render();
 assert.match(html,/半成品 QAQC/);
 assert.match(html,/成品 QAQC/);
 assert.doesNotMatch(html,/category-qa\b/);
 assert.doesNotMatch(html,/QA 放行<\/strong>/);
});
