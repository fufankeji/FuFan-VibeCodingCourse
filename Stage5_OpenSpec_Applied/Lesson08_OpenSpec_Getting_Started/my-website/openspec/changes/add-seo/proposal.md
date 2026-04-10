## Why

个人品牌站已有完整的页面结构（Hero + 项目 + 关于我），但缺乏基础 SEO 设置。搜索引擎无法获取有意义的标题和描述，也没有 robots.txt 来控制爬虫行为。此外，现有 HTML 语义化程度需要审查和加强，以提升搜索引擎对页面结构的理解。

## What Changes

- 在 `index.html` 中设置有意义的 `<title>` 和 `<meta name="description">`
- 添加 Open Graph meta tags（`og:title`、`og:description`、`og:type`、`og:url`）用于社交分享
- 审查并优化现有组件的 HTML 语义化（确保正确使用 `<main>`、`<section>`、`<nav>`、`<h1>`~`<h3>` 层级）
- 在 `public/` 目录下添加 `robots.txt`，允许 Google 爬虫索引

## Out-of-Scope

- **不做 sitemap.xml 生成**
- **不做结构化数据（JSON-LD）**
- **不做 Google Analytics 或其他分析工具集成**

## Capabilities

### New Capabilities

- `seo-meta`：HTML meta tags（title/description/OG）和 robots.txt 配置

### Modified Capabilities

（无现有 spec 需要修改——语义化审查是代码优化，不改变功能行为）

## Impact

- **代码**：修改 `index.html`（meta tags），可能微调 `App.tsx`（添加 `<main>` 包裹），新增 `public/robots.txt`
- **依赖**：无新增依赖
- **现有功能**：语义化调整不改变视觉效果或交互行为
