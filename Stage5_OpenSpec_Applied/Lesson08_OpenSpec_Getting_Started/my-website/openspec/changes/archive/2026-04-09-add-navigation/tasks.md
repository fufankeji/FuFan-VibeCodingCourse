## Phase 1. ThemeToggle 改造

- [x] 1.1 修改 `ThemeToggle.tsx`：移除 fixed 定位相关的 class（`fixed top-5 right-5 z-50`），改为内联流式布局样式
- [x] 1.2 修改 `App.tsx`：移除顶层的 `<ThemeToggle />` 引用（后续由 Navbar 内部渲染）

## Phase 2. Navbar 核心实现

- [x] 2.1 创建 `src/components/Navbar.tsx`：fixed 定位顶部容器，`bg-white/70 dark:bg-gray-950/70 backdrop-blur-lg z-40`
- [x] 2.2 实现左侧 Logo/名字区域：展示「木羽Cheney」，点击回到页面顶部（`<a href="#">`）
- [x] 2.3 实现右侧桌面端导航链接：首页（`#home`）、项目（`#projects`）、联系我（`#contact`），Tailwind 样式 + dark 模式配色 + focus-visible 样式
- [x] 2.4 在导航链接右侧集成 ThemeToggle 组件

## Phase 3. 移动端响应式菜单

- [x] 3.1 添加汉堡按钮：`md:hidden`，SVG 图标，aria-label，focus-visible 样式
- [x] 3.2 实现展开/收起面板：React state `isOpen` 控制显隐，展开时显示导航链接 + ThemeToggle
- [x] 3.3 点击导航链接后自动收起菜单
- [x] 3.4 桌面端隐藏汉堡按钮和展开面板（`hidden md:flex` 控制桌面端导航链接的显示）

## Phase 4. 整合与验收

- [x] 4.1 在 `App.tsx` 中引入 Navbar，放在 ThemeProvider 内、HeroSection 之前
- [x] 4.2 为未来的 section 目标添加 `scroll-margin-top`（在 `index.css` 中添加通用规则，偏移导航栏高度）
- [x] 4.3 运行 `npm run build`，确认构建无报错
