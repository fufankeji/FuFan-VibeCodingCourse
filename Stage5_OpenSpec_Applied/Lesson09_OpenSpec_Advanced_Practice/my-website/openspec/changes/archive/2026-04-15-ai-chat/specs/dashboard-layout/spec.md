## ADDED Requirements

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
