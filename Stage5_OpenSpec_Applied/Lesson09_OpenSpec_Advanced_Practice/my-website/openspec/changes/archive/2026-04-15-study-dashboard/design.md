## Context

当前项目是一个纯前端个人品牌站，使用 React 19 + Vite 7 + Tailwind CSS v4，无路由系统（锚点跳转），所有内容在 App.tsx 线性堆叠。需要在不破坏品牌站的前提下，新增 StudyPal 学习 Dashboard 页面，使用 mock 数据驱动全部 UI。

现有可复用资产：
- ThemeContext / ThemeToggle — 主题切换系统
- Navbar — 需从锚点导航改造为 router Link
- Tailwind + dark mode 配置 — 直接沿用

## Goals / Non-Goals

**Goals:**
- 引入路由系统，支持品牌站（`/`）和 Dashboard（`/dashboard`）双页面
- 搭建 Dashboard 布局骨架（Sidebar + 主内容区）
- 实现 5 个 Dashboard 功能面板（统计卡片、每日目标、AI 建议、趋势图）
- 所有数据使用集中管理的 mock 数据
- 完整支持亮/暗色模式

**Non-Goals:**
- 后端 API、AI 功能、用户认证（见 proposal out-of-scope）
- 数据持久化（不接数据库、不做 localStorage 缓存）
- 图表库的自定义主题深度定制

## Decisions

### Decision 1: 路由方案 — react-router-dom v7

**选择**：`react-router-dom` v7 + `createBrowserRouter`

**替代方案**：
- TanStack Router：类型安全更强，但生态较新，对 GitHub Pages 静态部署兼容性不如 react-router
- 手写 hash router：太简陋，不支持嵌套路由

**理由**：react-router 是 React 生态标准路由库，v7 支持 data loader，与后续添加 API 时的数据获取模式兼容。GitHub Pages 需要 404.html fallback 处理 SPA 路由。

### Decision 2: 图表库 — Recharts

**选择**：`recharts`（基于 D3 + React 的声明式图表库）

**替代方案**：
- Chart.js + react-chartjs-2：命令式 API，与 React 声明式风格不匹配
- Visx：过于底层，需大量自定义代码
- ECharts：体积过大（~800KB），品牌站不需要这么重

**理由**：Recharts 是纯 React 组件式 API（`<LineChart>`, `<BarChart>`），天然支持响应式和主题切换，gzipped ~45KB，适合 Dashboard 场景。

### Decision 3: 页面与组件组织结构

```
src/
├── App.tsx                      ← 路由配置层
├── main.tsx
├── index.css
├── mock/                        ← mock 数据集中管理
│   └── dashboard.ts               统计、目标、建议、趋势数据
├── contexts/
│   └── ThemeContext.tsx          ← 复用
├── components/                  ← 共享组件（跨页面）
│   ├── Navbar.tsx               ← 改造：router Link
│   ├── ThemeToggle.tsx          ← 复用
│   └── ParticleBackground.tsx   ← 复用（仅品牌站）
├── pages/
│   ├── Home.tsx                 ← 品牌站（原 Hero + Projects + About）
│   └── dashboard/
│       └── DashboardPage.tsx    ← Dashboard 主页面
└── components/dashboard/        ← Dashboard 专属组件
    ├── Sidebar.tsx                 左侧导航栏
    ├── StatsCards.tsx              数据统计卡片
    ├── DailyGoals.tsx             每日目标清单
    ├── AiSuggestions.tsx          AI 建议面板
    └── StudyTrends.tsx            趋势图
```

### Decision 4: 组件层级图

```
<ThemeProvider>                          ← 复用（全局）
└── <BrowserRouter>                      ← 新增
    ├── Route path="/"
    │   └── <Home>                       ← 新增（包装层）
    │       ├── <Navbar />               ← 改造（Link 替代锚点）
    │       ├── <HeroSection />          ← 复用
    │       ├── <ProjectSection />       ← 复用
    │       └── <AboutSection />         ← 复用
    │
    └── Route path="/dashboard"
        └── <DashboardPage>              ← 新增
            ├── <Sidebar />              ← 新增（左侧导航）
            └── <main>                   ← 主内容区
                ├── <StatsCards />       ← 新增（4 张统计卡片）
                ├── <DailyGoals />       ← 新增（目标清单）
                ├── <AiSuggestions />    ← 新增（AI 建议）
                └── <StudyTrends />      ← 新增（趋势图）
```

### Decision 5: Dashboard 布局方案

**选择**：CSS Grid 两栏布局（Sidebar 固定宽度 + 主内容区自适应）

```
┌──────────────────────────────────────────────────┐
│  DashboardPage (grid grid-cols-[256px_1fr])       │
│                                                    │
│  ┌────────┐  ┌──────────────────────────────────┐ │
│  │Sidebar │  │  主内容区 (overflow-y-auto)        │ │
│  │        │  │                                    │ │
│  │ • 概览  │  │  ┌──────┐┌──────┐┌──────┐┌──────┐│ │
│  │ • 目标  │  │  │ Stat ││ Stat ││ Stat ││ Stat ││ │
│  │ • AI   │  │  └──────┘└──────┘└──────┘└──────┘│ │
│  │ • 趋势  │  │                                    │ │
│  │        │  │  ┌─────────────┐ ┌──────────────┐ │ │
│  │        │  │  │ DailyGoals  │ │AiSuggestions │ │ │
│  │        │  │  │             │ │              │ │ │
│  │        │  │  └─────────────┘ └──────────────┘ │ │
│  │        │  │                                    │ │
│  │        │  │  ┌────────────────────────────────┐│ │
│  │        │  │  │       StudyTrends              ││ │
│  │        │  │  │   (周/月切换的折线图)            ││ │
│  │        │  │  └────────────────────────────────┘│ │
│  └────────┘  └──────────────────────────────────┘ │
└──────────────────────────────────────────────────┘

移动端 (<md): Sidebar 折叠为顶部汉堡菜单，主内容区全宽
```

### Decision 6: API 端点规范（本次均为 mock，预留接口形状）

本次不实现后端，但 mock 数据结构预留与未来 API 对齐的形状：

| 未来端点 | Mock 函数 | 返回类型 |
|---------|----------|---------|
| `GET /api/stats/today` | `getMockStats()` | `{ studyMinutes, tasksCompleted, streakDays, efficiency }` |
| `GET /api/goals/today` | `getMockGoals()` | `Goal[]` — `{ id, title, completed }` |
| `GET /api/suggestions` | `getMockSuggestions()` | `Suggestion[]` — `{ id, title, description, tag }` |
| `GET /api/trends?period=week\|month` | `getMockTrends(period)` | `TrendPoint[]` — `{ date, minutes }` |

## Risks / Trade-offs

- **[GitHub Pages SPA 路由]** → GitHub Pages 不原生支持 SPA fallback。Mitigation：构建时复制 `index.html` 为 `404.html`，或使用 hash router 作为 fallback。
- **[Recharts 体积]** → 增加 ~45KB gzipped。Mitigation：仅在 Dashboard 路由 lazy load，不影响品牌站首屏。
- **[Mock 数据与真实 API 形状偏移]** → 后续接 API 时 mock 结构可能不匹配。Mitigation：mock 数据结构已按 RESTful 接口形状设计，减少偏移风险。
