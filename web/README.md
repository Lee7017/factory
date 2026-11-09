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


## Lucide 图标统一（旧业务模块兼容）

`web/src/icons.ts` 为 React 主界面维护 11 个部门和 53 项功能的 Lucide 映射。

`web/scripts/lucide-sprite.mjs` 在每次 `npm run prepare:legacy` / `npm run build` 时，直接读取相同的 React 映射和 `lucide-react` 官方组件，生成包含 **77 个 Lucide symbol** 的 SVG 图标库，注入发布目录 `web/dist/legacy/index.html` 中。旧代码的 `<use href="#ic-...">` 仍可正常引用，但实际绘图已是 Lucide 的路径，不再使用手绘图标。

根目录的 `index.html` 继续保留迁移前的图标库作为独立旧版页面的备用源码；**构建发布时会自动覆盖**，不会出现在新版 React 网站的旧业务 iframe 中。流程图的连线/高亮框等 SVG 不是图标，仍按原方式绘制，避免破坏业务流程图布局。

浏览器测试检查了 iframe 里 77 个图标均带有 `data-lucide-icon`，同时检查了 React 组件图标与旧业务页面正常加载。
