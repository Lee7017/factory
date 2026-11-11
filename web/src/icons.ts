import type { LucideIcon } from "lucide-react"
import {
  Activity, Archive, ArrowDownToLine, ArrowLeftRight, BadgeCheck,
  Banknote, Bell, BookOpen, BookOpenCheck, Boxes, Building2, CalendarCheck, CalendarClock, CalendarDays, CalendarRange,
  ChartColumn, ChartLine, ChartPie, CheckCheck, CircleCheck,
  Clipboard, ClipboardCheck, ClipboardList, ClipboardPenLine, ClipboardSignature,
  Clock, ContactRound, Database, FileCheck, FilePenLine,
  FileSpreadsheet, FileText, FolderKanban, Factory, Gauge, GitBranch,
  HandCoins, HardHat, History, House, IdCard, LayoutDashboard,
  ListChecks, ListTodo, ListTree, LockKeyhole, Microscope,
  PackageCheck, PackageMinus, PackageOpen, PackagePlus,
  PackageSearch, ReceiptText, RotateCcw, ScanSearch,
  Settings, Settings2, ShieldAlert, ShieldCheck, ShoppingCart,
  SlidersHorizontal, Tags, Timer, Truck, UserRound,
  UsersRound, Wallet, Warehouse, Wrench
} from "lucide-react"

const DEPARTMENT_ICON_MAP: Record<string, LucideIcon> = {
  hr: UsersRound,
  sales: ShoppingCart,
  pmc: CalendarRange,
  purchase: Truck,
  warehouse: Warehouse,
  quality: ShieldCheck,
  production: Factory,
  engineering: Wrench,
  finance: Wallet,
  it: Settings2,
  leadership: Building2
}

const FEATURE_ICON_MAP: Record<string, LucideIcon> = {
  overview: LayoutDashboard,
  hours: Clock,
  hoursAppeal: FilePenLine,
  sop: BookOpen,
  sopExecutions: BookOpenCheck,
  qaQc: Microscope,
  qaSampling: ScanSearch,
  qaCleanInspection: ShieldCheck,
  qaNcr: ShieldAlert,
  qaQualityStock: PackageSearch,
  workshop: ArrowLeftRight,
  workshopReceive: CheckCheck,
  workshopDispute: ClipboardSignature,
  workshopRework: RotateCcw,
  warehouseOps: Boxes,
  warehouseIncoming: PackagePlus,
  warehousePick: ClipboardCheck,
  warehouseOutbound: PackageMinus,
  warehouseReturns: PackageOpen,
  warehouseLedger: FileSpreadsheet,
  settings: SlidersHorizontal,
  productSettings: Tags,
  dictionarySettings: Database,
  leave: CalendarDays,
  leaveApproval: CalendarCheck,
  employees: IdCard,
  skills: BadgeCheck,
  payroll: Banknote,
  orders: Clipboard,
  orderReview: FileCheck,
  orderHistory: History,
  schedule: CalendarClock,
  kitting: PackageCheck,
  shift: CalendarRange,
  shiftPeople: UsersRound,
  shiftStats: ChartColumn,
  orderProductStats: ChartPie,
  orderDailyReport: ChartLine,
  purchase: ShoppingCart,
  inventory: Archive,
  issue: ArrowDownToLine,
  inspection: ClipboardList,
  release: CircleCheck,
  tasks: ListTodo,
  nonProductionTasks: Wrench,
  batch: FileText,
  incentive: HandCoins,
  templates: FolderKanban,
  bom: ListTree,
  catalog: GitBranch,
  engineering: HardHat,
  finance: ReceiptText,
  permissions: LockKeyhole,
  approvals: ClipboardPenLine
}

export function getDepartmentIcon(id: string): LucideIcon {
  return DEPARTMENT_ICON_MAP[id] ?? Factory
}
export function getFeatureIcon(id: string): LucideIcon {
  return FEATURE_ICON_MAP[id] ?? FileText
}
export { House, Bell, UserRound, Gauge, ListChecks, Settings, Timer, Activity, ContactRound }
