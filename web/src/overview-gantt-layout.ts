import type { GanttEntry } from "./overview-data"
import schedulingDefinitions from "./scheduling-definitions.json"

export type OverviewRange = {startMs:number;endMs:number;days:number}
export type OverviewBar = {
  entry:GanttEntry;left:number;width:number;slot:number;compact:boolean
}

/**
 * Lay out bars by their visible widths, not just their actual run time.
 * Each independently positioned bar owns a slot until its painted right edge.
 * This prevents compressed short tasks from covering one another in weekly/monthly views.
 */
export function layoutOverviewBars(entries:GanttEntry[],range:OverviewRange):OverviewBar[]{
  const total=range.endMs-range.startMs
  if(!(total>0))return []
  // Narrow colored markers remain legible without claiming hours of nonexistent occupancy.
  // At the defined minimum timeline widths these are approximately 7-10 CSS pixels.
  const minimum=range.days===1?2.5:range.days===7?1.6:0.8
  const positions=entries.flatMap(entry=>{
    const start=new Date(entry.start).getTime()
    const end=start+Number(entry.duration)*60000
    if(!Number.isFinite(start)||!Number.isFinite(end)||end<=range.startMs||start>=range.endMs)return []
    const left=Math.max(0,(start-range.startMs)/total*100)
    const visible=(Math.min(end,range.endMs)-Math.max(start,range.startMs))/total*100
    const width=Math.min(100-left,Math.max(visible,minimum))
    return [{entry,left,width,compact:width<9||visible<minimum}]
  }).sort((a,b)=>a.left-b.left||b.width-a.width||a.entry.id.localeCompare(b.entry.id))

  const rowEnds:number[]=[]
  return positions.map(bar=>{
    let slot=rowEnds.findIndex(right=>bar.left>=right+0.45)
    if(slot<0){slot=rowEnds.length;rowEnds.push(0)}
    rowEnds[slot]=bar.left+bar.width
    return {...bar,slot}
  })
}

/** 20px bars + 6px gap + 7px top/bottom padding. */
export const overviewRowHeight=(bars:OverviewBar[]):number=>
  Math.max(57,14+(bars.length?Math.max(...bars.map(bar=>bar.slot))+1:1)*26)

/** React and PMC both use exactly the same workcenter identifiers. */
export const PMC_LANES=schedulingDefinitions.lanes

/**
 * 真正的产能冲突：仅当同一工位上的任务实际起止时间相交。
 * 不把因任务条最小可视宽度而产生的绘图拥挤误判为工位冲突。
 */
export function resourceConflicts(entries:GanttEntry[]):Set<string>{
 const result=new Set<string>()
 const byLane=new Map<string,{id:string;start:number;end:number}[]>()
 for(const e of entries){
  const start=new Date(e.start).getTime(),duration=Number(e.duration)
  if(!Number.isFinite(start)||!Number.isFinite(duration)||duration<=0)continue
  const current=byLane.get(e.lane)||[]
  current.push({id:e.id,start,end:start+duration*60000})
  byLane.set(e.lane,current)
 }
 for(const tasks of byLane.values()){
  tasks.sort((a,b)=>a.start-b.start||a.end-b.end)
  for(let i=0;i<tasks.length;i++)for(let j=i+1;j<tasks.length&&tasks[j].start<tasks[i].end;j++){
   result.add(tasks[i].id)
   result.add(tasks[j].id)
  }
 }
 return result
}
