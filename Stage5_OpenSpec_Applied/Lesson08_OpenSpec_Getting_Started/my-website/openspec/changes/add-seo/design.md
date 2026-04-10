## Context

当前 `index.html` 的 `<title>` 为默认的 `my-website`，无 `<meta name="description">`。页面结构为 `Navbar + HeroSection + ProjectSection`（后续会加 AboutSection）。`<nav>` 已在 Navbar 中使用，但缺少 `<main>` 包裹主体内容。

部署在 GitHub Pages，base path 为 `/my-website/`。

## Goals / Non-Goals

**Goals:**

- 搜索引擎能索引到有意义的标题和描述
- 社交分享（微信/Twitter/Facebook）时显示正确的预览信息
- HTML 语义化层级合理
- Google 爬虫可以自由索引

**Non-Goals:**

- 不做 sitemap.xml
- 不做 JSON-LD 结构化数据
- 不做分析工具集成

## Decisions

### 1. Meta Tags：静态写入 index.html

**选择**：直接在 `index.html` 的 `<head>` 中硬编码 meta tags

**备选方案**：
- react-helmet / react-helmet-async：SPA 动态设置，但本站是单页面，无路由切换需求，过重
- Vite 插件动态注入：增加构建复杂度，无必要

**理由**：单页面站点，meta 信息固定，硬编码最简单且对爬虫友好（无需 JS 执行即可读取）。

### 2. Open Graph Tags

**选择**：添加基础 OG tags

```html
<meta property="og:title" content="木羽Cheney - 全栈开发工程师">
<meta property="og:description" content="...">
<meta property="og:type" content="website">
<meta property="og:url" content="https://muyu.github.io/my-website/">
```

**理由**：微信/Twitter/Facebook 分享时会读取 OG tags 生成预览卡片。`og:image` 暂不添加（无合适的社交分享图），后续可补充。

### 3. 语义化审查清单

当前状态和调整方案：

| 元素 | 当前 | 调整 |
|------|------|------|
| `<nav>` | ✅ Navbar 已使用 | 无需修改 |
| `<main>` | ❌ 缺失 | App.tsx 中用 `<main>` 包裹 Hero + Project + About |
| `<section>` | ✅ HeroSection / ProjectSection 已使用 | 无需修改 |
| `<h1>` | ✅ Hero 中使用 | 确认全页仅一个 h1 |
| `<h2>` | ✅ ProjectSection 标题 | 确认 AboutSection 也用 h2 |
| `<h3>` | ✅ ProjectCard 卡片标题 | 无需修改 |
| `lang` 属性 | ❌ `<html lang="en">` | 改为 `lang="zh-CN"` |

### 4. robots.txt

**选择**：`public/robots.txt`，允许所有爬虫

```
User-agent: *
Allow: /
```

**理由**：个人品牌站无需限制爬虫。放在 `public/` 目录，Vite 构建时会原样复制到 `dist/`。

## Risks / Trade-offs

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| SPA 内容需要 JS 执行才能渲染 | 爬虫可能看不到动态内容 | meta tags 在 HTML 中静态存在，不依赖 JS；Google 爬虫已支持 JS 渲染 |
| `og:url` 硬编码可能过时 | 换域名后 OG 链接错误 | 部署时更新即可，低频操作 |
