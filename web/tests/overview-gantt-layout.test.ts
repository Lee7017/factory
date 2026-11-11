import test from "node:test"
import assert from "node:assert/strict"
import { layoutOverviewBars,overviewRowHeight,PMC_LANES,resourceConflicts } from "../src/overview-gantt-layout"
import { readFileSync } from "node:fs"
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

test("homepage workcenters match the exact PMC gantt.js lane definitions",()=>{
 const js=readFileSync(new URL("../../gantt.js",import.meta.url),"utf8")
 const laneBlock=js.match(/const lanes=\[([\s\S]*?)\];/)
 assert.ok(laneBlock,"PMC must expose its lane definitions")
 const pmc=[...laneBlock[1].matchAll(/\{id:\x27([^\x27]+)\x27,desc:\x27([^\x27]+)\x27\}/g)]
   .map(match=>({id:match[1],desc:match[2]}))
 assert.deepEqual(PMC_LANES.map(lane=>({...lane})),pmc)
})
test("simultaneous tasks conflict only if they share an actual workcenter",()=>{
 const task=(id:string,lane:string,start:string,duration:number):GanttEntry=>({
   id,orderId:"SO-TEST",type:"配制",lane,start,duration,source:"正式排程"
 })
 const entries=[
   task("one","L01 配制一线","2026-11-11T08:00",120),
   task("two","L01 配制一线","2026-11-11T09:00",60),
   task("other","L02 配制二线","2026-11-11T09:00",60),
   task("sequential","L01 配制一线","2026-11-11T10:00",60)
 ]
 assert.deepEqual([...resourceConflicts(entries)].sort(),["one","two"])
 const slots=layoutOverviewBars(entries.filter(x=>x.lane==="L01 配制一线"),period)
 assert.ok(slots.every(x=>x.entry.lane==="L01 配制一线"))
})
