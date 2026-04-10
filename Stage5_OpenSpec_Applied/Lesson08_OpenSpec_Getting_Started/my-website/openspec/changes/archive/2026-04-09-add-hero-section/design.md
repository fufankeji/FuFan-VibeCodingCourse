## Context

当前 `src/App.tsx` 为 Vite 默认模板，样式写在 `App.css` 中，未使用 Tailwind CSS。项目已安装 Tailwind CSS v4（`@tailwindcss/vite` 插件），但尚未在组件中使用。需要从零搭建组件结构、主题系统和粒子背景。

## Goals / Non-Goals

**Goals:**

- 建立组件化的项目结构（`components/`、`contexts/`）
- 实现响应式全屏 Hero Section
- 实现可复用的亮/暗主题切换系统
- 粒子背景在桌面端流畅，移动端优雅降级

**Non-Goals:**

- 不做任何动画效果（入场、过渡、滚动）
- 不做导航栏
- 不做后端 API 集成
- 不做 `#projects` 目标区域本身（仅做跳转按钮）

## Decisions

### 1. 粒子方案：`@tsparticles/react` + `@tsparticles/slim`

**选择**：tsparticles slim 包

**备选方案**：
- 自写 Canvas：零依赖但开发成本高，需自己实现碰撞检测和连线逻辑
- Three.js：包体积 ~150KB，对于 2D 粒子效果严重过重
- CSS-only 伪粒子：无额外依赖但效果有限，无法实现粒子互连

**理由**：slim 包 gzip 后约 30KB，提供粒子、连线、交互的开箱即用方案。支持运行时动态更新配置，方便暗色模式切换时改变粒子颜色。

### 2. 背景分层：CSS 渐变 + Canvas 粒子叠加

**选择**：两层分离

```
┌─────────────────────────────────┐
│  div.gradient-bg  (CSS 渐变底)  │  ← Tailwind bg-gradient, 支持 dark: 变体
│  ┌─────────────────────────────┐│
│  │ canvas (粒子层, absolute)   ││  ← tsparticles, pointer-events-none
│  └─────────────────────────────┘│
│  ┌─────────────────────────────┐│
│  │ content (文字层, relative)  ││  ← z-10, 居中布局
│  └─────────────────────────────┘│
└─────────────────────────────────┘
```

**理由**：
- CSS 渐变的暗色切换可用 Tailwind `dark:` 变体直接控制，无需 JS
- 粒子层设 `pointer-events-none`，不干扰文字层的交互
- 降级时只需隐藏 canvas，渐变背景仍然美观

### 3. 暗色模式：class 策略 + localStorage 持久化

**选择**：Tailwind `class` 策略 + React Context

**实现方式**：
1. `ThemeContext` 管理 `theme` 状态（`'light' | 'dark'`）
2. 初始化优先级：`localStorage` → `prefers-color-scheme` → `'light'`
3. 在 `<html>` 元素上切换 `dark` class
4. 在 `index.html` 的 `<head>` 中加入同步脚本，防止 FOUC（首次加载闪烁）

**理由**：class 策略比 media 策略更灵活，允许用户手动覆盖系统偏好，且 Tailwind v4 原生支持。

### 4. 全屏高度：`min-h-dvh`

**选择**：`min-h-dvh` 而非 `h-screen`

**理由**：移动端浏览器的地址栏会影响 `100vh` 的计算，`dvh`（dynamic viewport height）会自动适应地址栏的显示/隐藏。使用 `min-h-` 前缀允许内容超长时自然撑开。

### 5. CTA 跳转：锚点滚动

**选择**：`<a href="#projects">` 配合 CSS `scroll-behavior: smooth`

**理由**：项目初期内容较少，无需引入 react-router。锚点跳转零依赖、语义化好，后续如需路由可无缝迁移。

### 6. 组件结构

```
src/
├── components/
│   ├── HeroSection.tsx         # 主容器：组装背景、内容、滚动提示
│   ├── ParticleBackground.tsx  # 封装 tsparticles canvas
│   └── ThemeToggle.tsx         # 亮/暗切换按钮（fixed 定位右上角）
├── contexts/
│   └── ThemeContext.tsx         # 主题状态 + Provider
├── App.tsx                     # 根组件，组装 ThemeProvider + HeroSection
├── index.css                   # Tailwind 入口 + 全局样式
└── main.tsx                    # 入口文件
```

## Risks / Trade-offs

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 粒子在低端移动设备卡顿 | 用户体验差，首屏超过 2 秒 | 检测 `navigator.hardwareConcurrency`，低端设备减少粒子数（80 → 20）或降级为纯渐变 |
| `prefers-reduced-motion` 用户看到粒子动画 | 可访问性问题 | 检测该媒体查询，开启时完全禁用粒子，仅保留渐变背景 |
| tsparticles 包体积影响首屏加载 | 性能指标 | 使用 slim 包（~30KB gzip），配合 Vite 的 code splitting 异步加载 |
| 暗色模式首次加载闪白（FOUC） | 视觉跳动 | 在 `index.html` `<head>` 中内联同步 JS 脚本，在 React 挂载前设定 `dark` class |
