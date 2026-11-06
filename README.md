# 工序云 · 工厂管理系统

线上地址：https://lee7017.github.io/factory/

这份仓库包含制造运营系统前端界面，采用黑白灰企业管理后台风格。左侧以 13 个部门为一级导航，各部门内部列出功能入口。右上角默认显示 **小明 / 开发人员**，点击员工信息可以切换当前浏览器中的查看身份。

## 员工与权限

- **一个员工可以兼任多个岗位**：岗位 A 的权限 ∪ 岗位 B 的权限 ∪ …。
- **个人权限单独追加**：员工最终权限 = 所有兼任岗位的权限并集 ∪ 个人追加权限。
- 每项业务权限细分到查看、创建、修改、审批、执行、配置等操作。
- **开发人员**拥有全部功能权限。信息化管理员可以配置普通岗位权限和个人权限，只有开发人员可以为别人分配开发人员岗位。
- 管理入口：信息化 / 主数据管理 → 员工权限矩阵。锁定功能被点击时短暂泛红，不出现阻断操作的弹窗。
- 当前页面的身份切换、授权修改和业务数据保存在本浏览器的 localStorage；这里没有服务器端登录、权限校验或真实业务数据同步。敏感生产与工资业务仍需使用有后端校验的正式系统。

## 各部门总览地址

点击部门总览可查看并复制相应链接。各页面地址固定，支持刷新和直接打开。

| 部门 | 总览页面 |
|---|---|
| 人事行政办公室 | https://lee7017.github.io/factory/#/departments/hr |
| 销售部 | https://lee7017.github.io/factory/#/departments/sales |
| PMC 办公室 | https://lee7017.github.io/factory/#/departments/pmc |
| 采购 / 供应链部 | https://lee7017.github.io/factory/#/departments/purchase |
| 仓库 / 物流部 | https://lee7017.github.io/factory/#/departments/warehouse |
| 质量部 QA / QC | https://lee7017.github.io/factory/#/departments/quality |
| 生产车间 | https://lee7017.github.io/factory/#/departments/production |
| 工艺技术部 | https://lee7017.github.io/factory/#/departments/tech |
| 设备工程部 | https://lee7017.github.io/factory/#/departments/engineering |
| EHS 安全环保部 | https://lee7017.github.io/factory/#/departments/ehs |
| 财务部 | https://lee7017.github.io/factory/#/departments/finance |
| 信息化 / 主数据管理 | https://lee7017.github.io/factory/#/departments/it |
| 总经办 | https://lee7017.github.io/factory/#/departments/leadership |

## 项目结构

- `index.html`：网站基础结构与 SVG 图标
- `styles.css`：黑白灰界面、部门导航、权限矩阵与响应式样式
- `access.js`：员工、岗位、操作级权限、权限并集和授权编辑
- `app.js`：业务页面、部门地址、消息中心与前端交互
- `.github/workflows/pages.yml`：推送 `main` 后自动发布 GitHub Pages

本地预览：在仓库目录执行 `python3 -m http.server 8080`，访问 http://localhost:8080。
