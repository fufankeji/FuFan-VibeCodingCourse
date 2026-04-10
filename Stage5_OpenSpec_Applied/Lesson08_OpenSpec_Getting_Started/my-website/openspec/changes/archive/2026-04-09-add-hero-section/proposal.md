## Why

当前首页仍为 Vite 默认模板（计数器 demo），缺乏个人品牌展示能力。需要一个全屏 Hero Section 作为访客的第一印象入口，展示个人身份信息并引导用户浏览项目内容。

## What Changes

- 新增全屏高度的 Hero Section 组件，居中展示姓名、职业和一句话介绍
- 新增 CTA 按钮，锚点跳转至 `#projects` 区域
- 新增粒子背景效果：CSS 渐变底层 + Canvas 粒子叠加层
- 新增亮色/暗色模式切换功能，含 ThemeToggle 按钮
- 移除 Vite 默认模板内容（计数器 demo、文档链接等）

## Out-of-Scope

- **不做动画效果**：无入场动画、无过渡动画、无滚动动画
- **不做导航栏**：本次变更不包含顶部导航
- **不做后端 API**：所有数据硬编码在前端

## Capabilities

### New Capabilities

- `hero-section`：全屏 Hero 区域，包含个人信息展示、CTA 按钮、粒子背景
- `theme-switching`：亮色/暗色模式切换，支持用户偏好持久化和系统主题检测

### Modified Capabilities

（无现有 spec 需要修改）

## Impact

- **代码**：替换 `src/App.tsx` 现有内容，新增 `src/components/` 和 `src/contexts/` 目录
- **依赖**：新增 `@tsparticles/react` 和 `@tsparticles/slim` 用于粒子效果
- **样式**：从 `App.css` 迁移至 Tailwind CSS class，可能移除或清空 `App.css`
- **可访问性**：需检测 `prefers-reduced-motion`，为粒子效果提供降级方案
- **性能**：粒子渲染在移动端需降低粒子数量以保证首屏 < 2 秒
