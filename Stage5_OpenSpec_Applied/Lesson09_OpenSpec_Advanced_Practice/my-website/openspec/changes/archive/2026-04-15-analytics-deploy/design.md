## Context

StudyPal 已有完整的用户认证（JWT）、Dashboard 布局（Sidebar + 面板）、AI 对话功能。当前统计卡片使用 mock 数据。需要引入真实的学习数据追踪、分析可视化、成就系统，并完成部署。

## Goals / Non-Goals

**Goals:**
- 后端新增学习记录和成就的数据模型 + API
- 前端学习日历热力图和成就徽章面板
- Sidebar 导航重构
- 统计卡片接入真实数据
- 部署上线配置

**Non-Goals:**
- 实时通知、数据导出、自动计时器、CI/CD

## Decisions

### Decision 1: 数据模型

```sql
CREATE TABLE study_sessions (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES users(id),
    duration_minutes INTEGER NOT NULL,
    date            DATE NOT NULL,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_achievements (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id),
    type        TEXT NOT NULL,
    unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, type)
);
```

**成就类型定义**（硬编码在后端）：

| type | 名称 | 条件 |
|------|------|------|
| `first-session` | 初次学习 | 完成第 1 次学习记录 |
| `streak-7` | 坚持一周 | 连续学习 7 天 |
| `streak-30` | 月度达人 | 连续学习 30 天 |
| `hours-10` | 学习 10 小时 | 累计学习 ≥ 600 分钟 |
| `hours-100` | 百小时达人 | 累计学习 ≥ 6000 分钟 |

### Decision 2: API 端点规范

| Method | Path | Auth | 说明 |
|--------|------|------|------|
| POST | `/api/analytics/sessions` | Bearer | 记录学习时段 |
| GET | `/api/analytics/calendar?year=2026` | Bearer | 日历热力图数据（每日学习分钟数） |
| GET | `/api/analytics/stats` | Bearer | 聚合统计（总时长、streak、效率） |
| GET | `/api/analytics/achievements` | Bearer | 用户已解锁成就列表 |
| POST | `/api/analytics/achievements/check` | Bearer | 检查并解锁新成就 |

### Decision 3: 日历热力图数据格式

```json
{
  "year": 2026,
  "data": {
    "2026-01-15": 120,
    "2026-01-16": 45,
    "2026-01-17": 0
  }
}
```

前端渲染为 12×31 网格，颜色深浅表示当日学习时长。

### Decision 4: 前端组件层级图

```
<DashboardPage>
├── <Sidebar />                    ← 修改：导航项重新排序
│   ├── 学习数据    → /dashboard         (index)
│   ├── AI 对话建议 → /dashboard/chat
│   └── 学习目标    → /dashboard (scroll to #goals)
└── <main>
    └── Route /dashboard (index)
        ├── <StatsCards />         ← 修改：接入真实 API
        ├── <StudyCalendar />      ← 新增：热力图
        ├── <Achievements />       ← 新增：成就徽章
        ├── <DailyGoals />
        ├── <AiSuggestions />
        └── <StudyTrends />        ← 修改：接入真实 API
```

### Decision 5: 部署方案

**前端**：GitHub Pages（已有 `npm run deploy` 脚本 → `gh-pages -d dist`）
- `build` 脚本已配置 `cp dist/index.html dist/404.html` 支持 SPA 路由
- `base: '/my-website/'` 已在 vite.config.ts 配置

**后端**：文档化部署到免费平台（Railway / Render / Fly.io）
- 生成 `backend/Dockerfile` 和 `backend/fly.toml`（或 `render.yaml`）
- 前端生产环境需通过环境变量配置 API base URL

### Decision 6: 前端 API Base URL 配置

开发环境通过 Vite proxy（`/api` → `localhost:8000`），生产环境通过环境变量：

```ts
const API_BASE = import.meta.env.VITE_API_BASE || ''
// 开发：fetch('/api/...') → Vite proxy
// 生产：fetch('https://api.studypal.com/api/...')
```

## Risks / Trade-offs

- **[Study session 手动记录]** → 没有自动计时器，依赖用户手动提交。Mitigation：后续可添加 Pomodoro 计时器。
- **[成就条件硬编码]** → 新增成就需改后端代码。Mitigation：本阶段足够，后续可改为配置驱动。
- **[后端部署成本]** → 免费平台有冷启动和限额。Mitigation：学习工具流量低，免费额度足够。
