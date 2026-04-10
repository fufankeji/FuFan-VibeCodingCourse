## Context

当前页面结构为 `ThemeProvider → ThemeToggle + HeroSection`。HeroSection 是全屏 `min-h-dvh` 容器，ThemeToggle 使用 `fixed top-5 right-5 z-50`。需要新增固定导航栏，同时处理好与现有组件的层级和定位关系。

已有的样式基础设施：Tailwind CSS v4 + `@custom-variant dark`，`scroll-behavior: smooth` 已在 `index.css` 中配置。

## Goals / Non-Goals

**Goals:**

- 固定顶部导航栏，滚动时始终可见
- 背景模糊半透明效果，不完全遮挡下方内容
- 桌面端水平导航 + 移动端汉堡菜单
- 导航链接锚点平滑滚动
- 与现有 ThemeToggle 整合（移入导航栏内）

**Non-Goals:**

- 不做搜索功能
- 不做多级下拉菜单
- 不做用户登录和注册
- 不做滚动时导航栏样式变化（如滚动后加阴影）

## Decisions

### 1. 导航栏定位：`fixed top-0` + backdrop-blur

**选择**：`fixed top-0 inset-x-0 z-40` + `bg-white/70 dark:bg-gray-950/70 backdrop-blur-lg`

**备选方案**：
- `sticky top-0`：需要导航栏是页面流的一部分，但 HeroSection 是全屏容器，sticky 会导致导航栏被 Hero 的 `overflow-hidden` 吞掉
- 不透明背景：会完全遮挡 Hero 的粒子和渐变效果，失去科技感

**理由**：fixed 定位脱离文档流，不受 Hero 的 overflow 影响。半透明 + blur 让导航栏在滚动时既可见又不遮挡内容。

### 2. ThemeToggle 整合：移入导航栏

**选择**：将 ThemeToggle 从 App.tsx 的独立 fixed 定位移入 Navbar 右侧

**理由**：
- 避免两个 fixed 元素在右上角互相重叠
- 导航栏已有右侧空间，Toggle 放在导航链接之后更自然
- ThemeToggle 组件本身不需改动，只需去掉 fixed 定位相关的 class

### 3. 移动端方案：汉堡菜单 + 展开面板

**选择**：React state 控制 `isOpen`，点击汉堡按钮展开全宽下拉面板

**备选方案**：
- 侧边抽屉（Drawer）：实现复杂度更高，三个链接不需要这么重
- 始终显示所有链接（缩小字号）：移动端三个链接挤不下 + Toggle 按钮

**理由**：三个导航链接 + 一个 Toggle，用下拉面板即可，最简方案。

### 4. 导航链接实现：`<a href="#section">`

**选择**：原生锚点链接，配合已有的 `scroll-behavior: smooth`

**理由**：与 CTA 按钮的跳转方案一致（design 复用），零 JS 依赖。

### 5. z-index 层级规划

```
z-50  （保留给 modal / toast 等未来需求）
z-40  Navbar
z-10  HeroSection 内容层
z-0   ParticleBackground
```

**理由**：Navbar 需要在 Hero 内容之上，但不需要最高层级。ThemeToggle 移入 Navbar 后不再需要独立的 z-50。

### 6. 组件结构

```
src/components/
├── Navbar.tsx             # 导航栏主组件（Logo + 链接 + ThemeToggle + 汉堡菜单）
├── ThemeToggle.tsx        # 现有组件，去掉 fixed 定位
├── HeroSection.tsx        # 不变
└── ParticleBackground.tsx # 不变
```

## Risks / Trade-offs

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 导航栏遮挡 Hero 顶部内容 | Hero 标题可能被导航栏盖住 | Hero 已使用 flex 居中，导航栏高度约 64px，居中内容不会被遮挡 |
| 锚点跳转后导航栏遮挡目标 section 顶部 | 跳转目标被导航栏覆盖 | 目标 section 添加 `scroll-margin-top` 对应导航栏高度 |
| 移动端汉堡菜单展开时与粒子层交互冲突 | 用户误触 | 展开面板使用实色/高透明度背景 + backdrop-blur，确保可读性 |
