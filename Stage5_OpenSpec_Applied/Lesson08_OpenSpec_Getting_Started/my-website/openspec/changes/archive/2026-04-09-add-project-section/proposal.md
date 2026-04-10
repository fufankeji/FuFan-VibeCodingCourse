## Why

个人品牌站目前仅有 Hero Section 和导航栏，缺少核心内容——项目作品展示。Hero 的 CTA 按钮和导航栏的「项目」链接均指向 `#projects`，但目标区域尚不存在。需要添加项目展示区来承接这些入口，展示个人技术作品。

## What Changes

- 新增项目展示 Section（`#projects`），位于 Hero Section 下方
- 卡片式布局，每张卡片包含：项目截图、项目名称、项目简介、GitHub 链接
- 最少展示 4 个项目，数据硬编码
- 卡片鼠标悬浮时有微交互特效（如轻微上移 + 阴影增强）
- 所有图片使用 lazy loading
- 支持亮色/暗色模式
- **修改现有行为**：确认 Hero Section 的 CTA 按钮锚点 `#projects` 能正确跳转到新 Section

## Out-of-Scope

- **不做项目详情页**：无点击卡片展开详情的功能
- **不做项目搜索功能**

## Capabilities

### New Capabilities

- `project-section`：项目展示区域，包含卡片布局、项目数据渲染、悬浮微交互、lazy loading 图片

### Modified Capabilities

- `hero-section`：CTA 按钮的跳转目标 `#projects` 现在有了实际的目标 Section，需确认锚点正确对接

## Impact

- **代码**：新增 `src/components/ProjectSection.tsx` 和 `src/components/ProjectCard.tsx`，修改 `src/App.tsx` 引入新 Section
- **资源**：需要添加 4+ 张项目截图到 `src/assets/projects/`（或使用占位图）
- **依赖**：无新增依赖
- **样式**：卡片悬浮特效仅使用 Tailwind CSS 的 `hover:` 变体，属于 out-of-scope 中「动画效果」的例外——这里是 CSS transition 微交互而非入场/滚动动画
- **现有功能**：Hero CTA `<a href="#projects">` 无需代码改动，新 Section 添加 `id="projects"` 即可自动对接
