# 工序云 · 工厂管理系统（GitHub Pages 前端演示）

此仓库只放前端静态演示，不包含数据库、Node.js API、员工真实密码、客户数据或任何服务器密钥。

- 黑白灰玻璃拟态界面，13 个部门为左侧一级导航，功能为二级菜单。
- 演示角色切换，部门及功能级锁定示意。
- 包含订单、生产任务、生产排程、工艺模板、BOM、产线、权限和技能矩阵、请假、工资、消息中心等界面。
- 少量演示交互数据保存在**当前浏览器的 localStorage**，不与其他浏览器同步。
- 本版本**不提供真实身份认证、审批、库存或生产执行**。正式业务版本另行运行 Node.js + SQLite 服务。

## 在线发布

将本仓库的 GitHub Pages 来源设置为 **GitHub Actions**：`Settings → Pages → Build and deployment → Source → GitHub Actions`。推送到 `main` 后 `.github/workflows/pages.yml` 自动构建发布。

网站目标地址：`https://lee7017.github.io/factory/`

## 本地预览

项目无需安装依赖，在本目录执行：

```bash
python3 -m http.server 8080
```

打开 `http://localhost:8080`。也可以用 VS Code Live Server。

## 迭代

`index.html` 管页面骨架和 SVG 图标；`styles.css` 管视觉样式；`app.js` 管演示数据、部门导航、示例页面与交互。每次提交到 `main` 自动重新发布，GitHub Pages 构建完成后刷新网站即可看到更新。