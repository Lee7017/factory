/**
 * Business page families are grouped by workflow, not department.
 * Each feature is rendered through the same outer page frame. The family only
 * changes content density; the original business engine owns all state/actions.
 */
const families = {
  records: [
    "orders","orderHistory","hours","hoursAppeal","leave","leaveApproval",
    "warehouseOps","warehouseIncoming","warehousePick","warehouseOutbound","warehouseReturns",
    "warehouseLedger","inventory","issue","tasks","batch","workshopReceive",
    "workshopDispute","workshopRework","qaQc","qaSampling","qaCleanInspection",
    "qaNcr","qaQualityStock","release","purchase","sopExecutions"
  ],
  planning: ["schedule","kitting","shift","shiftPeople","workshop","engineering"],
  reports: ["shiftStats","orderProductStats","orderDailyReport","payroll","incentive","finance"],
  configuration: [
    "employees","skills","permissions","settings","productSettings",
    "dictionarySettings","catalog","sop","templates","bom"
  ],
  approval: ["orderReview","approvals"]
} as const

export type BusinessFamily = keyof typeof families
const familyByFeature = new Map<string,BusinessFamily>(
  (Object.entries(families) as [BusinessFamily,readonly string[]][])
    .flatMap(([family,features])=>features.map(feature=>[feature,family] as const))
)
export function businessFamily(feature:string):BusinessFamily {
  const family=familyByFeature.get(feature)
  if(!family)throw new Error(`未归类的业务功能：${feature}。请先纳入统一页面类别。`)
  return family
}
