# 工厂管理系统（MES / ERP / APS 原型）

当前 GitHub Pages 入口是 **`web/` 下的 React + TypeScript + Vite 应用**。部门导航、首页总览、花名簿、待办和部分员工业务页面使用 React；复杂制造业务仍沿用已验证的 JavaScript 业务引擎，通过 React 内的 `NativeBusiness` 加载。**不是两套独立运行的网站。**

在线地址：https://lee7017.github.io/factory/

## 功能范围

- 10 个部门；生产车间分别有**生产任务**（配制、包装）与**非生产任务**（清洗、调机调线、设备点检）。
- 销售订单评审 → PMC 排程及物料齐套 → 仓库发料 → 车间执行 → 半成品 / 成品 QAQC → 成品入库及发货。
- 首页和 PMC 使用同一份排程配置：5 个工位、6 种任务颜色、工序顺序、可选工位与试排默认时长。
- 订单状态名称及下一办理部门由单一配置维护。
- 权限、质量、仓库、采购、工时和操作日志都保留现有业务逻辑。

## 代码结构

| 位置 | 作用 |
|---|---|
| `web/src/App.tsx` | 唯一的 React 页面框架、部门入口 |
| `web/src/OverviewDashboard.tsx` | React 管理驾驶舱和总览甘特图 |
| `web/src/business/runtime.ts` | 业务引擎与 React 的连接、脚本加载与路由 |
| `web/src/business/NativeBusiness.tsx` | 将业务页面及弹窗托管在 React 中 |
| `web/src/scheduling-definitions.json` | 首页与 PMC 共用的工位、工序、可用产线及默认时长 |
| `web/src/order-stages.json` | 订单流程状态名称 |
| `web/src/order-workflow.json` | 订单状态对应办理部门、功能入口及待办标题 |
| `web/src/gantt-palette.css` | 首页、PMC 共用的六种工序颜色 |
| 根目录 `operations.js`、`modules.js`、`procurement.js`、`gantt.js`、`flow-ui.js` | **仍在使用**的订单、采购、库存、质量、排程与流转业务引擎 |
| 根目录 `access.js`、`*.css` | 仍需加载的权限脚本和旧业务表单样式 |
| `web/scripts/prepare-legacy.mjs` | 仅复制需要的业务脚本、生成图标和隔离旧业务 CSS |

此前根目录的独立 `index.html` / `app.js` 和 iframe 桥接已退出构建；**保留的业务引擎并不等于废弃代码**。

## 本地开发与验证

```bash
cd web
npm ci
npm run dev
npm run test:unit
npm run build
npm run test:smoke
npm run test:overview
npm run test:full
```

`npm run test:unit` 包含 TypeScript 规则测试和根目录传统业务引擎的 Node 回归测试。仓库结构检查：

```bash
python3 -m unittest discover -s tests -p test_department_ui.py
```

GitHub Actions 的 `react-build.yml` 在 PR 中检查结构、编译、业务回归和 Chromium 页面交互；合并到 `main` 后由 `pages.yml` 部署 `web/dist`，随后对公开站点执行浏览器验收。

## 数据与安全边界

当前版本使用浏览器 `localStorage`（工作区 `factory-workspace-v4` 和现行权限记录）。这是前端原型：**没有后端数据库、真实跨设备协作、服务端权限隔离或正式电子签名**。请保留数据备份；清理代码不会主动删除已有浏览器数据。

## 维护规则

1. 新工序、工位、颜色先修改共用配置，不要分别在首页与 PMC 再写一套。
2. 新订单状态及下一处理部门先修改共用工作流配置，并同步业务回归。
3. 不直接删除仍由 `business/runtime.ts` 加载的业务引擎。
4. 业务重构走独立分支和 PR，待自动测试通过再合并发布。
