## 1. 后端数据模型与迁移

- [x] 1.1 创建 `backend/app/models/study_session.py`（StudySession ORM：id, user_id, duration_minutes, date, created_at）
- [x] 1.2 创建 `backend/app/models/achievement.py`（UserAchievement ORM：id, user_id, type, unlocked_at + ACHIEVEMENT_DEFINITIONS 常量）
- [x] 1.3 在 `models/__init__.py` 注册新模型，生成并执行 Alembic 迁移

**验证**：确认 `study_sessions` 和 `user_achievements` 表已创建。

## 2. 后端学习分析 API

- [x] 2.1 创建 `backend/app/schemas/analytics.py`（SessionCreate, SessionResponse, CalendarResponse, StatsResponse, AchievementResponse, AchievementCheckResponse）
- [x] 2.2 创建 `backend/app/routers/analytics.py`，实现 `POST /api/analytics/sessions`（记录学习时段）
- [x] 2.3 实现 `GET /api/analytics/calendar?year=`（按日聚合学习分钟数，返回 { year, data } ）
- [x] 2.4 实现 `GET /api/analytics/stats`（聚合：total_minutes, streak_days, sessions_count, today_minutes）
- [x] 2.5 实现 `GET /api/analytics/achievements`（返回全部成就定义 + 用户解锁状态）
- [x] 2.6 实现 `POST /api/analytics/achievements/check`（检查条件并解锁新成就）
- [x] 2.7 在 `main.py` 挂载 analytics router

**验证**：通过 Swagger UI 测试记录学习、获取日历、获取统计、获取成就、检查解锁。

## 3. 前端 Sidebar 导航重构

- [x] 3.1 修改 `Sidebar.tsx` 导航项顺序：学习数据（/dashboard）→ AI 对话建议（/dashboard/chat）→ 学习目标（#goals）
- [x] 3.2 移除旧的概览/目标/AI建议/趋势锚点导航项

**验证**：确认 Sidebar 导航项顺序正确，路由和锚点跳转正常。

## 4. 前端统计卡片接入真实 API

- [x] 4.1 修改 `StatsCards.tsx`：从 `GET /api/analytics/stats` 获取数据，替换 mock
- [x] 4.2 实现 API 请求失败时的降级显示（"加载失败"提示）

**验证**：统计卡片显示真实数据，断开后端时显示降级提示。

## 5. 前端学习日历热力图

- [x] 5.1 创建 `src/components/dashboard/StudyCalendar.tsx`，调用 `GET /api/analytics/calendar` 渲染热力图
- [x] 5.2 实现颜色深浅映射（0 分钟灰色 → 深色表示高时长）和悬浮 tooltip
- [x] 5.3 在 `DashboardPage.tsx` 中添加 StudyCalendar 组件

**验证**：热力图渲染，悬浮显示日期和时长，无数据时全灰。

## 6. 前端成就系统面板

- [x] 6.1 创建 `src/components/dashboard/Achievements.tsx`，调用 `GET /api/analytics/achievements` 渲染徽章列表
- [x] 6.2 实现已解锁/未解锁的视觉区分（已解锁彩色 + 解锁时间，未解锁灰色半透明）
- [x] 6.3 在 `DashboardPage.tsx` 中添加 Achievements 组件

**验证**：成就面板渲染，已解锁和未解锁样式区分正确。

## 7. 部署配置

- [x] 7.1 创建 `backend/Dockerfile`（基于 python:3.9-slim，安装依赖，启动 uvicorn）
- [x] 7.2 在前端 `src/` 中添加 API base URL 配置支持（`VITE_API_BASE` 环境变量）
- [x] 7.3 确认 `npm run build` 和 `npm run deploy` 正常工作

**验证**：Docker build 成功，前端构建无错误，deploy 脚本可执行。

## 8. 集成测试与最终验证

- [x] 8.1 完整走查：登录 → 记录学习 → 查看日历 → 查看统计 → 查看成就 → AI 对话
- [x] 8.2 验证 Sidebar 导航顺序：学习数据 → AI 对话建议 → 学习目标
- [x] 8.3 验证暗色模式下所有新组件样式正确
- [x] 8.4 运行 `npm run build` 确认前端构建无错误
