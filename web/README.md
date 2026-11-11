# React 工厂管理工作台

这是 GitHub Pages **实际部署**的应用，入口为 `src/main.tsx`，React 路由、部门导航、花名簿、待办由 `App.tsx` 管理。

复杂 MES 业务流程仍通过 `business/runtime.ts` 加载根目录的业务引擎并挂载至 `NativeBusiness.tsx`，保留原有订单审批、质量判定、库存校验、采购、排程与操作记录。此前 iframe 和独立老版页面已经移除。

## 共用配置

- `src/scheduling-definitions.json`：5 个工位、6 道工序及其颜色类别、可用工位、默认时长。
- `src/order-stages.json`：订单状态名称。
- `src/order-workflow.json`：下一处理部门、待办对应功能。
- `src/gantt-palette.css`：总览与 PMC 共用颜色变量。

更改流程时，优先修改上述配置，避免在 React 和传统业务引擎里重复写判断。

## 运行与测试

```bash
npm ci
npm run dev
npm run test:unit
npm run build
npm run test:smoke
npm run test:overview
npm run test:full
npm run test:current
```

`prepare:legacy` 仅复制 `access.js`、`operations.js`、`gantt.js`、`modules.js`、`flow-ui.js`、`procurement.js` 到临时构建目录，并从现有 CSS 生成 React 兼容的隔离样式。不要删除这些业务引擎。

GitHub Actions 在 PR 中执行静态、单元、浏览器和业务测试；`main` 分支自动部署 `web/dist` 到 `/factory/` 并进行线上验收。

## 数据边界

目前仅为使用浏览器本地存储的前端原型。保存的数据只属于本浏览器；没有生产数据库、跨设备实时同步或服务端权限校验。数据仍使用 `factory-workspace-v4`，本次代码清理不更改存储结构。
