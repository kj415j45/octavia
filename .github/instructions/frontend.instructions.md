---
applyTo: "public/**"
---

# 前端静态资源 — 编码规范

## 技术限制

- `public/` 目录是**纯静态资源**，由 Cloudflare Workers Assets 提供服务。
- **无构建工具**：不使用 Vite / Webpack / Rollup 等打包器，不使用 npm 包。
- **无 TypeScript**：所有脚本为原生 JavaScript（`.js`）。
- UI 框架：**Bootstrap 5**（本地托管，路径 `/lib/bootstrap.min.css` 和 `/lib/bootstrap.bundle.min.js`）。

## 文件组织

| 路径 | 说明 |
|------|------|
| `public/*.html` | 各页面 HTML |
| `public/lib/common.js` | 公共 JS 工具（API 调用、区域操作等）——**所有页面均引入** |
| `public/data/regions.json` | 区服配置，前端通过 `fetch('/data/regions.json')` 加载 |
| `public/lib/` | 第三方库（Bootstrap、Chart.js、lodash、html2canvas 等） |

## API 调用规范

- 所有 API 请求通过 `common.js` 中封装的函数发起（`getStageInfo`、`getAuthorInfo`、`searchStageDatabase` 等）。
- `baseUrl` 为空字符串（同域请求），不要硬编码域名。
- 若需新增 API 调用，在 `common.js` 中添加对应封装函数，再在页面 JS 中使用。

## 区域（Region）

- 区服配置从 `/data/regions.json` 动态加载，使用 `populateRegionDropdown()` 填充选择框。
- 支持 `auto`（自动检测）选项，通过 URL 参数 `?region=auto` 触发。
- **不要**在页面 JS 中硬编码区服 ID，应从 `regionMap` 中读取。

## 页面导航

- 导航栏在每个 HTML 文件中独立编写（无服务端模板），保持风格一致。
- 外部链接（米游社、HoYoLab）使用 `target="_blank" rel="noopener"` 属性。

## 第三方库引用

- 所有第三方库已本地化，放在 `public/lib/`。
- 引用路径使用绝对路径（`/lib/xxx.js`），不要使用 CDN URL。

## 添加新页面步骤

1. 在 `public/` 新建 `page-name.html`。
2. 引入 `/lib/bootstrap.min.css`、`/lib/font.css`（字体）。
3. 引入 `/lib/bootstrap.bundle.min.js`、`/lib/common.js`。
4. 在导航栏中加入链接入口（在相关页面的 HTML 中更新导航）。
