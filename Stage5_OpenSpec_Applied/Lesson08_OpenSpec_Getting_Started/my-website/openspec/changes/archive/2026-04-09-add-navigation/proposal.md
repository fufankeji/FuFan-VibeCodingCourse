## Why

当前个人品牌站仅有 Hero Section，缺少页面内导航能力。用户无法快速跳转到不同内容区域（如项目、联系方式），需要一个固定顶部导航栏来提升浏览体验和信息可达性。

## What Changes

- 新增固定在页面顶部的导航栏组件（Navbar）
- 左侧展示个人 Logo 或名字
- 右侧包含导航链接：首页、项目、联系我
- 点击导航链接平滑滚动到对应 section
- 导航栏具有背景模糊效果（backdrop-blur）
- 支持亮色/暗色模式
- 移动端适配：汉堡菜单展开/收起

## Out-of-Scope

- **不做搜索功能**
- **不做多级下拉菜单**
- **不做用户登录和注册**

## Capabilities

### New Capabilities

- `navigation`：固定顶部导航栏，包含 Logo/名字展示、导航链接、锚点平滑滚动、背景模糊效果、移动端响应式菜单

### Modified Capabilities

（无现有 spec 需要修改——导航栏是独立组件，不改变 hero-section 或 theme-switching 的既有行为）

## Impact

- **代码**：新增 `src/components/Navbar.tsx`，修改 `src/App.tsx` 引入导航栏
- **依赖**：无新增依赖（纯 Tailwind CSS 实现）
- **样式**：导航栏 `fixed top-0` 会占据页面顶部空间，HeroSection 需考虑与导航栏的视觉重叠（导航栏半透明 + blur，不影响 Hero 全屏效果）
- **可访问性**：导航栏使用语义化 `<nav>` 标签，链接支持键盘导航，移动端汉堡按钮需 aria-label
