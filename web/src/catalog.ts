// Generated from the existing factory app.js department/feature definitions.
// Update alongside the legacy catalog until the business modules are fully migrated.
export interface Department {
  id: string
  name: string
  icon: string
  description: string
  features: string[]
}
export const DEPARTMENTS: Department[] = [
  {
    "id": "hr",
    "name": "人事行政办公室",
    "icon": "users",
    "description": "员工自助、培训档案、请假与考勤",
    "features": [
      "leave",
      "hours",
      "hoursAppeal",
      "leaveApproval",
      "employees",
      "skills",
      "payroll"
    ]
  },
  {
    "id": "sales",
    "name": "销售部",
    "icon": "sales",
    "description": "销售订单、客户需求、订单评审与历史订单",
    "features": [
      "orders",
      "orderReview",
      "orderHistory"
    ]
  },
  {
    "id": "pmc",
    "name": "生产计划与物料控制部（PMC）",
    "icon": "pmc",
    "description": "生产计划、物料齐套、产线排程及人员班次安排",
    "features": [
      "schedule",
      "kitting",
      "shift",
      "shiftPeople",
      "shiftStats",
      "orderProductStats",
      "orderDailyReport"
    ]
  },
  {
    "id": "purchase",
    "name": "采购 / 供应链部",
    "icon": "purchase",
    "description": "采购申请、供应商与到货协同",
    "features": [
      "purchase"
    ]
  },
  {
    "id": "warehouse",
    "name": "仓库 / 物流部",
    "icon": "warehouse",
    "description": "库存批次、来料收货、备料、出库、退库与收发存",
    "features": [
      "warehouseOps",
      "warehouseIncoming",
      "warehousePick",
      "warehouseOutbound",
      "warehouseReturns",
      "warehouseLedger",
      "inventory",
      "issue"
    ]
  },
  {
    "id": "quality",
    "name": "质量部 QA / QC",
    "icon": "quality",
    "description": "报检判定、抽检、清洗报检、不合格处置与 QA 放行",
    "features": [
      "qaQc",
      "qaSampling",
      "qaCleanInspection",
      "qaNcr",
      "qaQualityStock",
      "release"
    ]
  },
  {
    "id": "production",
    "name": "生产车间",
    "icon": "production",
    "description": "领退料、到料接收、返洗返工、生产任务与班组管理",
    "features": [
      "workshop",
      "workshopReceive",
      "workshopDispute",
      "workshopRework",
      "tasks",
      "batch",
      "shift",
      "skills",
      "incentive"
    ]
  },
  {
    "id": "engineering",
    "name": "设备工程部",
    "icon": "engineering",
    "description": "设备维护、调机调线和非生产工单",
    "features": [
      "engineering"
    ]
  },
  {
    "id": "finance",
    "name": "财务部",
    "icon": "finance",
    "description": "应收应付、加班费和激励工资审核",
    "features": [
      "payroll",
      "finance"
    ]
  },
  {
    "id": "it",
    "name": "信息化部",
    "icon": "it",
    "description": "权限组织、主数据、操作标准、工艺模板与 BOM 统一管理",
    "features": [
      "permissions",
      "employees",
      "settings",
      "productSettings",
      "dictionarySettings",
      "catalog",
      "sop",
      "sopExecutions",
      "templates",
      "bom"
    ]
  },
  {
    "id": "leadership",
    "name": "总经办",
    "icon": "leadership",
    "description": "跨部门审批与重点事项",
    "features": [
      "approvals"
    ]
  }
]
export const FEATURE_NAMES: Record<string,string> = {
  "overview": "工厂运行总览",
  "hours": "我的工时",
  "hoursAppeal": "工时申诉",
  "sop": "操作标准卡",
  "sopExecutions": "标准卡执行记录",
  "qaQc": "报检判定",
  "qaSampling": "抽检",
  "qaCleanInspection": "清洗报检",
  "qaNcr": "不合格品处置",
  "qaQualityStock": "质量库存",
  "workshop": "车间领料 / 退库",
  "workshopReceive": "到料接收双签",
  "workshopDispute": "工时申诉审批",
  "workshopRework": "返洗 / 返工",
  "warehouseOps": "库存批次",
  "warehouseIncoming": "采购到货",
  "warehousePick": "备料执行 · FIFO",
  "warehouseOutbound": "成品出库",
  "warehouseReturns": "退库接收",
  "warehouseLedger": "月末收发存",
  "settings": "流程与工艺设置",
  "productSettings": "产品与物料设置",
  "dictionarySettings": "基础字典",
  "leave": "我的请假",
  "leaveApproval": "请假审批",
  "employees": "员工档案",
  "skills": "员工技能矩阵",
  "payroll": "加班费 / 激励工资",
  "orders": "销售订单",
  "orderReview": "订单评审",
  "orderHistory": "历史订单",
  "schedule": "生产排程",
  "kitting": "物料齐套",
  "shift": "排班编排",
  "shiftPeople": "员工排班",
  "shiftStats": "排班统计",
  "orderProductStats": "订单产品统计",
  "orderDailyReport": "订单日报表",
  "purchase": "采购单",
  "inventory": "库存与生产入库",
  "issue": "领料与发料",
  "inspection": "检验任务",
  "release": "QA 放行",
  "tasks": "生产 / 非生产任务",
  "batch": "生产批次卡",
  "incentive": "生产激励提报",
  "templates": "工艺模板",
  "bom": "BOM 关系",
  "catalog": "产品与产线",
  "engineering": "设备与调机调线",
  "finance": "财务审核",
  "permissions": "员工权限矩阵",
  "approvals": "总经办审批"
}
export const FEATURE_HINTS: Record<string,string> = {
  "overview": "订单、产线、质量、物料及人员运行状态",
  "hours": "本人管理岗与辅助工时、班次工时确认；本人确认后才进入排班统计与订单产品统计",
  "hoursAppeal": "本人对工时计算结果发起申诉并查看处理结果；原工时保留，审批记录可追溯",
  "sop": "受控操作步骤、版本、岗位、工序、审核与发布",
  "sopExecutions": "标准卡执行人、版本、工序、签名与执行时间",
  "qaQc": "来料、半成品与成品报检单的 QC 判定；生产流程到配制报检 / 包装报检后会自动生成对应报检单，这里是实际 QC 判定入口",
  "qaSampling": "按批次执行抽检并记录判定结果；抽检异常会自动生成不合格品处置单",
  "qaCleanInspection": "清洗任务报检、判定与返洗衔接；清洗为独立非生产任务，检验通过后才能复核完工",
  "qaNcr": "隔离、返洗、返工、报废等不合格品处置；每次处置保留独立记录",
  "qaQualityStock": "待检、合格、冻结等质量库存状态；未经放行或已冻结的批次不能参与正常发料",
  "workshop": "车间发起领料与结余退库申请；仓库签发与车间接收必须由不同人员完成签名记录",
  "workshopReceive": "仓库签发后由车间人员完成到料接收双签；两个操作人、时间和数量写入同一领料单",
  "workshopDispute": "车间管理人员审批员工工时申诉；审批后生成工时更正记录，原记录保留可追溯",
  "workshopRework": "根据质量异常发起返洗或返工任务；返洗形成独立清洗工单，返工保留原批次和问题来源",
  "warehouseOps": "库存批次、效期、质量状态与冻结管理",
  "warehouseIncoming": "采购到货、来料比对、报检和入库确认",
  "warehousePick": "按合格批次和 FIFO 执行生产备料；冻结、待检或过期批次排除",
  "warehouseOutbound": "按订单成品批次执行销售出库；冻结、待检及不合格批次不能出库，库存缺口按剩余待发减当前合格可发库存计算",
  "warehouseReturns": "接收生产结余退库并回补原批次；确认后增加原批次结余并记录入库流水",
  "warehouseLedger": "按月查看收入、发出、结存与批次流水",
  "shift": "按产线 × 岗位编排班次；同时检查技能、请假、工位撞班并执行开工前 Gate",
  "settings": "清洗报检、双签、FIFO、技能与请假等流程规则；修改后会直接影响对应业务校验",
  "productSettings": "产品、物料主数据、成品与半成品 BOM、产线关系统一维护入口",
  "dictionarySettings": "班次、工种、物料分类、检验项目等基础字典；按类型启用或停用并保留历史记录",
  "leave": "员工自助发起并查看请假记录",
  "leaveApproval": "人事审批请假单及结果通知",
  "employees": "员工身份、岗位与组织关系",
  "skills": "技能等级、工种与资质有效期",
  "payroll": "加班申请、激励计量与审批",
  "orders": "产品 · 规格 · 数量 · 交期",
  "orderReview": "订单提交、评审与审批",
  "orderHistory": "已交付订单、完成时间与完整流转记录",
  "schedule": "时间、产线、配制包装、清洗、调机调线及质检任务",
  "kitting": "库存齐套与批号预留",
  "shiftPeople": "按员工查看日期、岗位、产线、班次和工种安排",
  "shiftStats": "查看排班数量、Gate 通过率与人员覆盖",
  "orderProductStats": "按订单汇总已确认工时与参与员工；只累计员工本人已确认的订单工时",
  "orderDailyReport": "按日期和订单汇总已确认工时；未确认工时不进入报表",
  "purchase": "采购下单、主管审批与到货进度",
  "inventory": "成品、半成品及原辅包分类",
  "issue": "按正式任务领料、发料、签收",
  "inspection": "来料、半成品、成品检验",
  "release": "成品 QC 合格后的 QA 最终放行",
  "tasks": "配制、包装、清洗、调机调线",
  "batch": "生产实绩与批次过程记录",
  "incentive": "按合格计量提报激励",
  "templates": "受控模板、版本、一键填充",
  "bom": "成品与半成品及原辅料关系",
  "catalog": "产品、规格、产线、品类关系",
  "engineering": "非生产任务、设备维护",
  "finance": "财务审核记录和汇总",
  "permissions": "岗位权限与个人追加权限取并集；个人授权用于补充特定操作权限",
  "approvals": "高风险权限与经营决策"
}
export const getDepartment = (id: string) => DEPARTMENTS.find((dept) => dept.id === id)
