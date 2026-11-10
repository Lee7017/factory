/**
 * Business UI families are grouped by interaction model, never by department.
 * Every distinct feature must belong to exactly one family; CI rejects omissions.
 */
export const businessFamilies = {
  records: [
    "orders","orderHistory","purchase","leave","hours","hoursAppeal",
    "sopExecutions","payroll","incentive"
  ],
  inventory: [
    "warehouseOps","warehouseIncoming","warehousePick","warehouseOutbound",
    "warehouseReturns","warehouseLedger","inventory","issue","kitting","qaQualityStock"
  ],
  approval: [
    "leaveApproval","orderReview","finance","approvals","workshopDispute"
  ],
  planning: [
    "schedule","shift","shiftPeople"
  ],
  reports: [
    "shiftStats","orderProductStats","orderDailyReport"
  ],
  configuration: [
    "employees","skills","permissions","settings","productSettings",
    "dictionarySettings","catalog","sop","templates","bom"
  ],
  execution: [
    "tasks","batch","workshopReceive","workshopRework","qaQc","qaSampling",
    "qaCleanInspection","qaNcr","release","workshop","engineering"
  ]
} as const

export type BusinessFamily = keyof typeof businessFamilies
const familyByFeature = new Map<string,BusinessFamily>(
  (Object.entries(businessFamilies) as [BusinessFamily,readonly string[]][])
    .flatMap(([family,features])=>features.map(feature=>[feature,family] as const))
)

export function businessFamily(feature:string):BusinessFamily {
  const family=familyByFeature.get(feature)
  if(!family)throw new Error(`未归类的业务功能：${feature}。请先纳入统一页面类别。`)
  return family
}
