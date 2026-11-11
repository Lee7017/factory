import test from "node:test"
import assert from "node:assert/strict"
import { layoutOverviewBars,overviewRowHeight } from "../src/overview-gantt-layout"
import type { GanttEntry } from "../src/overview-data"

const start=new Date("2026-11-09T00:00:00").getTime()
const period={startMs:start,endMs:start+7*86400000,days:7}
const entry=(id:string,time:string,duration=60):GanttEntry=>({
 id,orderId:"SO-TEST",type:"清洗",lane:"L01",start:"2026-11-11T"+time,duration,source:"手工排程"
})
test("same-day short entries get separate visually nonoverlapping rows",()=>{
 const list=[entry("G1","08:00"),entry("G2","08:20"),entry("G3","08:40"),entry("G4","09:00"),entry("G5","09:20"),entry("G6","09:40")]
 const bars=layoutOverviewBars(list,period)
 assert.equal(bars.length,6)
 for(let a=0;a<bars.length;a++)for(let b=a+1;b<bars.length;b++){
  if(bars[a].slot!==bars[b].slot)continue
  assert.ok(bars[a].left+bars[a].width+0.44<=bars[b].left||
    bars[b].left+bars[b].width+0.44<=bars[a].left,
    "Bars "+bars[a].entry.id+" and "+bars[b].entry.id+" must not overlap in the same row")
 }
 assert.ok(new Set(bars.map(x=>x.slot)).size>=3,"More than two visual rows are required")
 assert.ok(overviewRowHeight(bars)>=14+Math.max(...bars.map(x=>x.slot))*26+26)
})
test("near-identical tasks do not collapse into two alternating slots",()=>{
 const bars=layoutOverviewBars(Array.from({length:8},(_,i)=>entry("S"+i,"09:00")),period)
 assert.deepEqual(bars.map(x=>x.slot),[0,1,2,3,4,5,6,7])
 assert.equal(overviewRowHeight(bars),222)
})
test("tasks outside time period are hidden and end-of-period widths are clipped",()=>{
 const outside=entry("outside","10:00")
 outside.start="2026-11-18T08:00"
 const ending=entry("ending","10:00")
 ending.start="2026-11-15T23:50"
 const bars=layoutOverviewBars([outside,ending],period)
 assert.equal(bars.length,1)
 assert.ok(bars[0].left>=99&&bars[0].left+bars[0].width<=100.00001)
})
test("very short tasks are marked as compact colored bars without forcing labels",()=>{
 const bars=layoutOverviewBars([entry("short","08:00",20),entry("long","08:00",360)],period)
 assert.ok(bars.find(b=>b.entry.id==="short")?.compact)
 assert.ok(bars.every(b=>b.width>0))
})
