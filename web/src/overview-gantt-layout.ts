import type { GanttEntry } from "./overview-data"

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
  const minimum=range.days===1?5:range.days===7?5.8:1.4
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
