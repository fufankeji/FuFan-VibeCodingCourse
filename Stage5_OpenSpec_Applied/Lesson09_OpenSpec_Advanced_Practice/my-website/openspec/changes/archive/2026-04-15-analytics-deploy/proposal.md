## Why

StudyPal Dashboard 当前的统计卡片使用 mock 数据，缺少真实的学习行为追踪。用户无法可视化长期学习轨迹，也没有成就激励机制。需要基于真实数据库聚合的学习分析面板，并完成项目部署上线。

## What Changes

- 后端新增 `study_sessions` 和 `achievements` 数据表，记录用户学习行为和成就解锁
- 后端新增学习数据分析 API（日历热力图数据、成就列表、统计聚合）
- 前端新增学习日历热力图组件（类 GitHub contribution graph）
- 前端新增成就系统面板（解锁/未解锁徽章展示）
- 重构 Dashboard Sidebar 导航结构为：学习数据 → AI 对话建议 → 学习目标
- 用真实 API 数据替换 Dashboard 的 mock 统计卡片
- 配置 GitHub Pages 部署，后端部署方案文档化

## Capabilities

### New Capabilities
- `study-analytics`: 学习数据分析 API（日历热力图数据、统计聚合、streak 计算）
- `achievements`: 成就系统（成就定义、解锁条件检查、成就列表 API）
- `study-calendar`: 前端学习日历热力图组件
- `deploy-config`: 前后端部署配置（GitHub Pages + 后端部署文档）

### Modified Capabilities
- `dashboard-layout`: Sidebar 导航重构为"学习数据 / AI 对话建议 / 学习目标"顺序
- `study-stats`: 统计卡片改为从真实 API 获取数据（替换 mock）

## Impact

- **后端新增表**：`study_sessions`（id, user_id, duration_minutes, date, created_at）、`achievements`（id, user_id, type, unlocked_at）
- **后端新增文件**：`models/study_session.py`、`models/achievement.py`、`schemas/analytics.py`、`routers/analytics.py`
- **前端新增文件**：`components/dashboard/StudyCalendar.tsx`、`components/dashboard/Achievements.tsx`
- **前端改动文件**：`Sidebar.tsx`（导航重构）、`DashboardPage.tsx`（布局调整）、`StatsCards.tsx`（接入真实 API）
- **部署配置**：`package.json` deploy 脚本、GitHub Pages 404.html、后端部署文档

## Out-of-Scope（不做）

- 实时通知
- 数据导出
- 学习计时器（手动记录 study_session，不做自动计时）
- 后端自动部署 CI/CD

## 回滚方案

新增组件和 API 独立于现有功能。回滚只需：
1. 后端回滚迁移（`alembic downgrade`）
2. 前端恢复 Sidebar 旧导航和 mock 数据
3. 删除新增组件文件
