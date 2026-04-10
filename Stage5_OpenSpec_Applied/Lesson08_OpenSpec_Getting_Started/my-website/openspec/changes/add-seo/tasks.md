## Phase 1. HTML Meta Tags 和语言属性

- [x] 1.1 修改 `index.html`：将 `<html lang="en">` 改为 `lang="zh-CN"`
- [x] 1.2 修改 `index.html`：将 `<title>` 从 `my-website` 改为包含站主姓名和职业的有意义标题
- [x] 1.3 修改 `index.html`：添加 `<meta name="description">`，不超过 160 字符
- [x] 1.4 修改 `index.html`：添加 Open Graph tags（`og:title`、`og:description`、`og:type`、`og:url`）

## Phase 2. 语义化 HTML 审查与修复

- [x] 2.1 修改 `App.tsx`：用 `<main>` 包裹主体内容（HeroSection + ProjectSection + AboutSection）
- [x] 2.2 审查标题层级：确认全页仅一个 `<h1>`（Hero），各 Section 标题为 `<h2>`，ProjectCard 标题为 `<h3>`

## Phase 3. robots.txt 和构建验证

- [x] 3.1 在 `public/` 目录下创建 `robots.txt`：`User-agent: * Allow: /`
- [x] 3.2 运行 `npm run build`，确认构建无报错，验证 `dist/robots.txt` 存在
