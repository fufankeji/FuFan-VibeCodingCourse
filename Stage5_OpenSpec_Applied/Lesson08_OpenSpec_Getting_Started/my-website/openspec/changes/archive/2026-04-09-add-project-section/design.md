## Context

当前页面结构为 `Navbar + HeroSection`。Hero 的 CTA 按钮 `<a href="#projects">` 和 Navbar 的「项目」链接均指向 `#projects`，但页面中还没有该锚点目标。`index.css` 已配置 `section[id] { scroll-margin-top: 4rem }` 和 `scroll-behavior: smooth`，新 Section 自动受益。

项目截图需要 lazy loading（config.yaml 性能要求），且需支持亮/暗模式。

## Goals / Non-Goals

**Goals:**

- 在 Hero 下方新增项目展示区，承接 CTA 和导航链接的跳转目标
- 卡片式响应式布局，展示项目截图、名称、简介、GitHub 链接
- 悬浮微交互提升视觉反馈
- 图片 lazy loading 保证性能

**Non-Goals:**

- 不做项目详情页
- 不做项目搜索功能
- 不做卡片的入场动画或滚动动画（悬浮 transition 不算动画效果）

## Decisions

### 1. 组件拆分：ProjectSection + ProjectCard

**选择**：两个组件分离

```
ProjectSection.tsx    — Section 容器 + 标题 + 网格布局
ProjectCard.tsx       — 单张项目卡片（截图 + 名称 + 简介 + 链接）
```

**理由**：卡片逻辑独立，便于复用和维护。Section 负责布局，Card 负责内容渲染。

### 2. 项目数据：常量数组硬编码

**选择**：在 `ProjectSection.tsx` 中定义 `PROJECTS` 常量数组

```ts
interface Project {
  title: string
  description: string
  image: string
  github: string
}
```

**备选方案**：
- 独立 JSON/TS 配置文件：目前仅一处使用，拆文件过早抽象
- CMS/API：out-of-scope

**理由**：硬编码最简单，后续数据量增加时再提取配置文件。

### 3. 卡片布局：CSS Grid 响应式

**选择**：Tailwind Grid

```
移动端:   grid-cols-1     （单列堆叠）
平板端:   md:grid-cols-2  （两列）
桌面端:   lg:grid-cols-2  （两列，卡片更宽更有呼吸感）
```

**备选方案**：
- Flexbox wrap：需要手动处理等宽和间距，Grid 更直接
- 三列/四列：4 张卡片用两列每行 2 张更整齐，三列会出现 4-3=1 的不对称

**理由**：Grid 原生支持等宽列和 gap，配合 Tailwind 断点即可。两列布局在桌面端给卡片足够空间展示截图。

### 4. 悬浮微交互：Tailwind transition

**选择**：`hover:-translate-y-1 hover:shadow-lg transition-all duration-200`

**理由**：纯 CSS 实现，无需 JS。轻微上移 + 阴影增强是最经典的卡片悬浮反馈，不属于 out-of-scope 中禁止的「动画效果」（那指的是入场/滚动动画）。

### 5. 图片处理：`loading="lazy"` + 占位色

**选择**：`<img loading="lazy">` + 卡片图片区域设固定高宽比 + 灰色背景色占位

**理由**：
- 原生 lazy loading 零依赖，浏览器原生支持
- 固定高宽比防止图片加载前的布局偏移（CLS）
- 初期可用占位色块代替真实截图，后续替换 src 即可

### 6. GitHub 链接：外部链接 `target="_blank"`

**选择**：`<a href={github} target="_blank" rel="noopener noreferrer">`

**理由**：GitHub 链接应在新标签页打开，不中断用户浏览。`rel="noopener noreferrer"` 防止安全隐患。

### 7. Section 锚点对接

**选择**：`<section id="projects">` — 无需修改 HeroSection 或 Navbar

**理由**：Hero CTA 已是 `<a href="#projects">`，Navbar 也已有 `#projects` 链接。新 Section 只需添加正确的 `id`，现有 `scroll-margin-top: 4rem` 规则自动生效。

## Risks / Trade-offs

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 项目截图尺寸不统一导致卡片高度参差 | 布局不整齐 | 图片区域使用 `aspect-video` 固定比例 + `object-cover` 裁切 |
| 初期无真实截图 | 视觉效果差 | 使用灰色占位块 + alt 文字，后续替换 |
| 移动端卡片过长导致滚动疲劳 | 用户体验 | 单列布局，每张卡片紧凑，截图高度适中 |
| `prefers-reduced-motion` 下悬浮 transition | 可访问性 | 悬浮 translate 属于微交互（非连续动画），通常不需禁用；但可加 `motion-safe:` 前缀 |
