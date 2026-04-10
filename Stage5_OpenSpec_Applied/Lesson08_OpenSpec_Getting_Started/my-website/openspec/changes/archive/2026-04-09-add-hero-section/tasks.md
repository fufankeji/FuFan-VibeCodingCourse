## Phase 1. 项目基础设施搭建

- [x] 1.1 安装依赖：`@tsparticles/react` 和 `@tsparticles/slim`
- [x] 1.2 创建目录结构：`src/components/`、`src/contexts/`
- [x] 1.3 在 `index.html` 的 `<head>` 中添加主题检测内联脚本（防 FOUC）
- [x] 1.4 清理 Vite 默认模板内容：清空 `App.css`，移除 `App.tsx` 中的 demo 代码

## Phase 2. 暗色模式系统

- [x] 2.1 创建 `src/contexts/ThemeContext.tsx`：实现 ThemeProvider，管理 `light`/`dark` 状态，读写 localStorage，监听系统主题变化
- [x] 2.2 创建 `src/components/ThemeToggle.tsx`：切换按钮组件，fixed 定位右上角，亮/暗图标切换，支持键盘操作
- [x] 2.3 在 `src/App.tsx` 中接入 ThemeProvider，验证主题切换功能正常
- [x] 2.4 配置 Tailwind v4 的 dark variant（`@custom-variant dark` 在 `index.css` 中）

## Phase 3. Hero Section 核心内容

- [x] 3.1 创建 `src/components/HeroSection.tsx`：全屏容器（`min-h-dvh`），Flex 居中布局
- [x] 3.2 实现个人信息展示：姓名（h1）、职业、一句话介绍，响应式字号
- [x] 3.3 实现 CTA 按钮：锚点跳转 `#projects`，Tailwind 样式，支持 dark 模式配色，focus 可见样式
- [x] 3.4 添加渐变背景：Tailwind CSS 渐变类，亮/暗模式两套配色

## Phase 4. 粒子背景效果

- [x] 4.1 创建 `src/components/ParticleBackground.tsx`：封装 tsparticles，配置粒子数量、颜色、连线参数
- [x] 4.2 实现主题联动：粒子颜色跟随亮/暗模式切换，使用 refresh 而非销毁重建
- [x] 4.3 实现性能降级：检测 `prefers-reduced-motion` 禁用粒子；检测低端设备减少粒子数量
- [x] 4.4 在 HeroSection 中集成 ParticleBackground，设置 `pointer-events-none` 和正确的 z-index 层级

## Phase 5. 整合与验收

- [x] 5.1 在 `App.tsx` 中组装完整页面：ThemeProvider → ThemeToggle + HeroSection
- [x] 5.2 响应式测试：验证桌面端、平板、手机（竖屏/横屏）下的布局表现
- [x] 5.3 运行 `npm run build`，确认构建无报错，检查产物体积
