## 1. 路由基础设施与页面骨架

- [x] 1.1 安装 `react-router-dom` 依赖
- [x] 1.2 创建 `src/pages/Home.tsx`，将原 App.tsx 中的品牌站内容（Navbar + Hero + Projects + About）迁移至此
- [x] 1.3 改造 `src/App.tsx` 为路由配置层（BrowserRouter + Routes），配置 `/` → Home、`/dashboard` → DashboardPage、`*` → 重定向到 `/`
- [x] 1.4 更新 `vite.config.ts`，确保 base path 和 SPA fallback 与 GitHub Pages 兼容
- [x] 1.5 改造 `src/components/Navbar.tsx`，将锚点 href 替换为 router Link，新增 Dashboard 入口链接

**验证**：启动 dev server，确认 `/` 显示品牌站、`/dashboard` 可访问（空白页即可）、Navbar 路由导航正常工作。

## 2. Mock 数据层

- [x] 2.1 创建 `src/mock/dashboard.ts`，定义 TypeScript 类型接口（Stats, Goal, Suggestion, TrendPoint）
- [x] 2.2 实现 `getMockStats()` 返回统计数据（学习时长、任务完成数、连续打卡、效率百分比）
- [x] 2.3 实现 `getMockGoals()` 返回每日目标列表（5-6 项，含 id、title、completed 字段）
- [x] 2.4 实现 `getMockSuggestions()` 返回 AI 建议列表（3-4 项，含 id、title、description、tag 字段）
- [x] 2.5 实现 `getMockTrends(period: 'week' | 'month')` 返回趋势数据点数组

**验证**：在浏览器控制台或临时组件中调用 mock 函数，确认返回数据结构正确。

## 3. Dashboard 布局（Sidebar + 主内容区）

- [x] 3.1 创建 `src/components/dashboard/Sidebar.tsx`，实现左侧导航栏（概览/目标/AI建议/趋势菜单项 + ThemeToggle + 返回首页链接）
- [x] 3.2 实现 Sidebar 移动端响应式：< md 时默认隐藏，通过汉堡按钮展开为遮罩层
- [x] 3.3 创建 `src/pages/dashboard/DashboardPage.tsx`，实现 CSS Grid 两栏布局（Sidebar 256px + 主内容区 1fr）
- [x] 3.4 实现主内容区响应式网格：统计卡片 4 列、Goals+AI 2 列并排、趋势全宽；移动端全部单列堆叠
- [x] 3.5 确认 Dashboard 所有布局元素支持亮/暗色模式

**验证**：启动 dev server，确认 `/dashboard` 显示 Sidebar + 空主内容区，响应式断点切换正常，暗色模式无样式缺失。

## 4. 统计卡片组件

- [x] 4.1 创建 `src/components/dashboard/StatsCards.tsx`，渲染 4 张统计卡片（图标 + 名称 + 数值 + 变化趋势箭头）
- [x] 4.2 接入 `getMockStats()` 数据，处理数据为零时的正常显示
- [x] 4.3 实现响应式布局（≥ md 4 列，< md 2×2 网格）和暗色模式样式

**验证**：确认 4 张卡片渲染正确，数值展示准确，趋势箭头方向正确，响应式和暗色模式正常。

## 5. 每日目标清单组件

- [x] 5.1 创建 `src/components/dashboard/DailyGoals.tsx`，渲染目标列表面板（标题 + 进度指示 + 目标项）
- [x] 5.2 实现勾选交互：点击切换完成状态，已完成项显示删除线样式，更新进度计数
- [x] 5.3 实现空目标列表的空状态提示
- [x] 5.4 接入 `getMockGoals()` 数据，确认暗色模式样式

**验证**：确认目标列表渲染、勾选/取消交互、进度更新、空状态提示、暗色模式均正常。

## 6. AI 建议面板组件

- [x] 6.1 创建 `src/components/dashboard/AiSuggestions.tsx`，渲染建议卡片列表（标题 + 描述 + 分类标签）
- [x] 6.2 实现分类标签彩色样式（不同 tag 对应不同颜色）
- [x] 6.3 实现空建议列表的空状态提示
- [x] 6.4 接入 `getMockSuggestions()` 数据，确认暗色模式样式

**验证**：确认建议卡片渲染、标签颜色区分、空状态提示、暗色模式均正常。

## 7. 学习趋势图表组件

- [x] 7.1 安装 `recharts` 依赖
- [x] 7.2 创建 `src/components/dashboard/StudyTrends.tsx`，实现周/月切换按钮 + 折线图
- [x] 7.3 接入 `getMockTrends(period)` 数据，实现周/月切换时图表数据更新
- [x] 7.4 实现图表响应式宽度自适应（ResponsiveContainer）和暗色模式配色
- [x] 7.5 确认空数据点显示为 0，折线连续不断裂

**验证**：确认图表渲染、周/月切换、响应式适配、暗色模式配色、空数据点处理均正常。

## 8. 集成测试与最终验证

- [x] 8.1 完整走查 `/` → `/dashboard` → `/` 路由导航流程
- [x] 8.2 在 Dashboard 页面完整走查所有面板交互（卡片展示、目标勾选、趋势切换）
- [x] 8.3 验证移动端响应式（Sidebar 折叠、布局切换）
- [x] 8.4 验证亮/暗色模式全局切换无样式遗漏
- [x] 8.5 运行 `npm run build` 确认构建无错误
