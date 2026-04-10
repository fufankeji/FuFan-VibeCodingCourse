## Phase 1. 项目数据与资源准备

- [x] 1.1 创建 `src/assets/projects/` 目录，添加 4 张项目占位图（或真实截图）
- [x] 1.2 在 `src/components/ProjectSection.tsx` 中定义 `Project` 接口和 `PROJECTS` 常量数组（至少 4 项，含 title/description/image/github）

## Phase 2. ProjectCard 组件

- [x] 2.1 创建 `src/components/ProjectCard.tsx`：卡片组件，接收 `Project` props
- [x] 2.2 实现卡片截图区域：`aspect-video` 固定比例 + `object-cover` + `loading="lazy"` + 灰色占位背景
- [x] 2.3 实现卡片内容区域：项目名称、简介、GitHub 链接（`target="_blank" rel="noopener noreferrer"`）
- [x] 2.4 实现悬浮微交互：`hover:-translate-y-1 hover:shadow-lg transition-all duration-200`，`motion-safe:` 前缀控制 translate，暗色模式适配

## Phase 3. ProjectSection 组件

- [x] 3.1 创建 `src/components/ProjectSection.tsx`：Section 容器，`id="projects"`，Section 标题
- [x] 3.2 实现响应式网格布局：`grid grid-cols-1 md:grid-cols-2 gap-6`，渲染 ProjectCard 列表
- [x] 3.3 暗色模式适配：Section 背景色、标题颜色的 `dark:` 变体

## Phase 4. 整合与验收

- [x] 4.1 在 `App.tsx` 中引入 ProjectSection，放在 HeroSection 下方
- [x] 4.2 验证 Hero CTA 按钮和 Navbar「项目」链接点击后平滑滚动到 `#projects`
- [x] 4.3 运行 `npm run build`，确认构建无报错
