## ADDED Requirements

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

#### Scenario: Sidebar 导航项点击滚动
- **WHEN** 用户点击 Sidebar 中的导航项（概览 / 目标 / AI 建议 / 趋势）
- **THEN** 主内容区平滑滚动到对应区块

### Requirement: Dashboard 主内容区布局
Dashboard 主内容区 SHALL 使用响应式网格布局排列各功能面板。

#### Scenario: 桌面端网格布局
- **WHEN** 视口宽度 ≥ 768px
- **THEN** 统计卡片 4 列排列，DailyGoals 和 AiSuggestions 2 列并排，StudyTrends 全宽

#### Scenario: 移动端单列布局
- **WHEN** 视口宽度 < 768px
- **THEN** 所有面板垂直单列堆叠

