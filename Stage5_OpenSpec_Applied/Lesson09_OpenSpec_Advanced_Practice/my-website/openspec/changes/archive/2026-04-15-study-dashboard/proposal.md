## Why

当前项目是纯静态个人品牌站（Hero + Projects + About 线性堆叠），无法承载学习助手功能。需要引入路由系统和 Dashboard 布局，将品牌站作为 landing page 保留，同时新增 StudyPal 学习 Dashboard 作为核心功能入口。本次变更只搭建前端 Dashboard 框架和 UI，使用 mock 数据驱动。

## What Changes

- 引入 `react-router-dom`，将 App.tsx 从线性堆叠改为路由层
- 品牌站内容（Hero/Projects/About）保留为 `/` 路由
- 新建 `/dashboard` 路由，包含 Dashboard 布局：
  - 左侧可折叠导航栏（Sidebar）
  - 数据统计卡片（今日学习时长、完成任务数、连续打卡天数、学习效率）
  - 每日目标清单（可勾选的 todo list）
  - AI 建议学习面板（mock 静态建议，不接入真实 AI）
  - 周/月学习趋势图（基于 mock 数据的图表）
- 改造 Navbar，支持路由导航（品牌站首页 ↔ Dashboard 切换）
- 所有数据使用 mock 数据，集中管理在 `src/mock/` 目录

## Capabilities

### New Capabilities
- `dashboard-layout`: Dashboard 页面骨架，包含 Sidebar 导航 + 主内容区响应式布局
- `study-stats`: 数据统计卡片组件，展示学习概览指标
- `daily-goals`: 每日目标清单，支持勾选完成状态（本地状态管理）
- `ai-suggestions`: AI 建议学习面板，展示 mock 学习建议卡片
- `study-trends`: 周/月学习趋势图表，支持时间维度切换

### Modified Capabilities
（无——openspec/specs/ 当前为空，无已有 spec 需修改）

## Impact

- **新增依赖**：`react-router-dom`（路由）、轻量图表库（趋势图渲染）
- **改动文件**：`App.tsx`（路由层改造）、`Navbar.tsx`（锚点 → router Link）、`vite.config.ts`（可能需调整 base path 对 SPA 路由的支持）
- **新增文件**：Dashboard 布局组件、5 个功能组件、mock 数据模块
- **复用组件**：ThemeContext / ThemeToggle 直接复用，Navbar 改造复用

## Out-of-Scope（不做）

- 后端 API 服务（FastAPI / SQLite）
- AI 功能（真实模型调用、对话系统）
- 用户认证（登录 / 注册 / session 管理）
- 数据持久化（所有状态仅在内存 / localStorage）
- 移动端原生适配（仅做基本响应式）

## 回滚方案

本次变更采用新增路由 + 新建组件的方式，品牌站原有代码几乎不删改。回滚只需：
1. 移除 `react-router-dom` 依赖
2. 将 `App.tsx` 还原为线性堆叠
3. 将 `Navbar.tsx` 还原为锚点导航
4. 删除 `src/pages/dashboard/` 和 `src/mock/` 目录
