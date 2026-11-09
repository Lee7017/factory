# factory React / shadcn/ui 迁移分支

这是独立于旧版 `main` 的 React + TypeScript + Vite + Tailwind CSS 4 + shadcn/ui + Lucide Icons 界面。

- `npm ci`（有 lockfile 时）或 `npm install`
- `npm run dev` 启动本地开发
- `npm run build` 构建到 `web/dist`
- GitHub Pages 资源基础路径：`/factory/`
- 继续使用原有 Hash 路由（`#/departments/warehouse` 等）。
- 已迁移 React 主界面/部门入口/业务卡片/花名簿，尚未重写的业务模块通过同源 iframe 加载 `legacy/`，共享现有浏览器数据但保留其原有事件和操作逻辑。
- `scripts/prepare-legacy.mjs` 构建前把仓库根目录的旧版 HTML/CSS/JS 复制到 `public/legacy/`，并注入嵌入样式与通信脚本，不能直接删掉旧源码。
- 当前 `main` 的 GitHub Pages 仍运行旧版；新分支通过独立 Actions 工作流构建验证，不会覆盖线上页面。

shadcn/ui 组件基于官方 MIT 开源仓库 `shadcn-ui/ui` 的 `new-york-v4` 组件源码调整项目导入路径；Lucide 图标来自 `lucide-react`。
