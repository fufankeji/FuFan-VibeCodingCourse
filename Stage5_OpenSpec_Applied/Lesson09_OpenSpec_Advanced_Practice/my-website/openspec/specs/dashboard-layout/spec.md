# dashboard-layout Specification

## Purpose
TBD - created by archiving change study-dashboard. Update Purpose after archive.
## Requirements
### Requirement: 路由系统支持多页面导航
系统 SHALL 使用 react-router-dom 提供客户端路由，支持 `/`（品牌站）和 `/dashboard`（学习仪表盘）两个顶级路由。

#### Scenario: 访问根路径显示品牌站
- **WHEN** 用户访问 `/`
- **THEN** 系统渲染品牌站页面（Hero + Projects + About）

#### Scenario: 访问 Dashboard 路径
- **WHEN** 用户访问 `/dashboard`
- **THEN** 系统渲染 Dashboard 页面（Sidebar + 主内容区）

#### Scenario: 访问不存在的路径
- **WHEN** 用户访问未定义的路径（如 `/foo`）
- **THEN** 系统重定向到 `/`

### Requirement: Sidebar 左侧导航栏
Dashboard 页面 SHALL 包含一个固定在左侧的导航栏，展示导航菜单项并支持折叠。

#### Scenario: 桌面端显示完整 Sidebar
- **WHEN** 视口宽度 ≥ 768px（md 断点）
- **THEN** Sidebar 以 256px 固定宽度显示，展示图标 + 文字标签

#### Scenario: 移动端 Sidebar 折叠
- **WHEN** 视口宽度 < 768px
- **THEN** Sidebar 默认隐藏，通过汉堡按钮展开为全屏遮罩层

#### Scenario: 导航项顺序
- **WHEN** Sidebar 渲染
- **THEN** 导航项按以下顺序排列：学习数据（/dashboard）→ AI 对话建议（/dashboard/chat）→ 学习目标（scroll to #goals）

#### Scenario: Sidebar 显示当前用户信息
- **WHEN** 用户已登录且 Dashboard 渲染
- **THEN** Sidebar 底部显示用户头像、等级徽章和登出按钮

### Requirement: Dashboard 主内容区布局
Dashboard 主内容区 SHALL 使用响应式网格布局排列各功能面板。

#### Scenario: 桌面端网格布局
- **WHEN** 视口宽度 ≥ 768px
- **THEN** 统计卡片 4 列排列，DailyGoals 和 AiSuggestions 2 列并排，StudyTrends 全宽

#### Scenario: 移动端单列布局
- **WHEN** 视口宽度 < 768px
- **THEN** 所有面板垂直单列堆叠

### Requirement: Dashboard 认证守卫
Dashboard 路由 SHALL 要求用户已登录，未登录用户自动重定向到登录页。

#### Scenario: 未登录访问 Dashboard
- **WHEN** 未认证用户访问 `/dashboard`
- **THEN** 系统重定向到 `/login`

#### Scenario: 已登录访问 Dashboard
- **WHEN** 已认证用户访问 `/dashboard`
- **THEN** 系统正常渲染 Dashboard 页面

#### Scenario: token 过期时访问 Dashboard
- **WHEN** 用户 access_token 过期但 refresh_token 有效
- **THEN** 系统自动刷新 token 并正常渲染 Dashboard

### Requirement: Sidebar 包含 AI 对话导航项
Dashboard Sidebar SHALL 包含"AI 对话"菜单项，点击后导航到 `/dashboard/chat`。

#### Scenario: 点击 AI 对话导航
- **WHEN** 用户点击 Sidebar 中的"AI 对话"菜单项
- **THEN** 系统导航到 `/dashboard/chat` 并渲染对话页面

### Requirement: Dashboard 支持子路由
Dashboard SHALL 支持嵌套子路由，`/dashboard` 显示统计面板，`/dashboard/chat` 显示对话页面。

#### Scenario: 访问 /dashboard 显示统计面板
- **WHEN** 用户访问 `/dashboard`
- **THEN** 系统渲染统计卡片、目标清单、AI 建议、趋势图

#### Scenario: 访问 /dashboard/chat 显示对话页
- **WHEN** 用户访问 `/dashboard/chat`
- **THEN** 系统渲染 AI 对话界面

