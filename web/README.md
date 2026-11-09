# Factory · React + shadcn/ui + Lucide

在 `feat/react-shadcn-migration` 分支维护的工厂管理系统新版。原来的 `main` 仍是稳定发布版，迁移验收后由 PR 合并发布。

## 已实现

- React + TypeScript + Vite + Tailwind CSS 4，shadcn/ui 原生按钮、卡片、标签、弹窗、表格、搜索、排序、分页等组件。
- 11 个部门、53 项功能、55 个部门功能入口；首页、部门花名簿、办公位置、待办、消息、权限员工切换等 React 界面。
- Lucide React 图标。编译时为尚未重写的业务引擎生成 77 个 Lucide symbol，用于原业务页面按钮与图标。
- 保留红绿毛玻璃、桌面紧凑方卡、左侧底板比右侧更不透明。
- **已取消业务 iframe**。复杂 MES/ERP 业务采用 React 内的 `NativeBusiness` 直接挂载原业务 HTML，保留原来的业务状态检查、审批权限、质量判定及库存算法。请注意：这种兼容方式不等于复杂业务表格及所有单据表单已逐一重写成 React/shadcn 组件。
- 请假申请与审批已原生使用 shadcn/ui `Dialog`、`Input`、`DataTable`，并在新申请中禁止同一员工自审。
- 只使用当前 `factory-workspace-v4` 工作区数据，不读取也不迁移旧版 `factory-workspace-v2` 记录；没有 v4 时显示系统初始数据。权限继续使用现行 `factory-permissions-v2` 键。导入/导出仅包含当前 v4 工作区与现行权限，不接受旧版工作区备份。
- `business-selectors.ts` 按旧业务引擎状态处理 11 部门待办、订单环节和首页统计。

## 构建和测试

```sh
cd web
npm ci
npm run dev
npm run test:unit
npm run build
npm run test:smoke
npm run test:full
npm run test:purchase
```

构建产物位于 `web/dist`，部署路径 `/factory/`；仍使用 Hash 路由，无服务端路由依赖。

构建时 `scripts/prepare-legacy.mjs` 把当前仓库中的旧业务模块复制到 `web/public/legacy/`，并运行 `scope-legacy-css.mjs` 将旧 CSS 限定在 `.legacy-root`，避免污染新 UI；`lucide-sprite.mjs` 从官方 `lucide-react` 生成图标。不要删除根目录旧业务 JS；它们仍承担完整业务规则。

GitHub Actions 自动进行：
1. 固定的 `npm ci` 安装、7 项业务指标规则单元测试、TypeScript 类型检查、Vite 生产构建。
2. Chromium 桌面/移动端基础界面测试。
3. 逐个打开全部 55 个部门功能路由，验证页面内容、无 iframe、实际创建销售订单。
4. 采购员创建、不同人员审批、仓库收货、生成待检记录与入库前库存不变的跨部门测试。

## 数据和发布约束

目前为浏览器本地演示系统，GitHub Pages **不提供数据库、多用户实时协同、真正的服务端权限隔离**。前端用户身份切换和权限可用于流程演示，不能当成生产安全权限体系。

发布前检查工作流全部成功、检查 PR 是否可合并，并从 `main` 创建发布前备份分支。合并到 `main` 后，`.github/workflows/pages.yml` 才会部署 React `web/dist` 到原 Pages 地址。若回滚，可从备份分支还原部署 workflow 或撤销本次合并提交后重新运行 Pages Actions。

旧版独立页面 `index.html` 中的原始 SVG symbol 仍保留作未发布的备用源码，新版构建产物中的旧业务图标由 Lucide 自动替换。流程图连线仍以 SVG 作为绘制元素，不属于通用图标替换范围。

## 仍应逐步改造

复杂业务模块尚使用原业务引擎的 HTML 生成函数和事件委托。完整 JSX/shadcn 表单化应按采购、仓库、质量、生产、排产、财务、人事等业务边界分批替换，不能在验收前直接删除原业务逻辑。
