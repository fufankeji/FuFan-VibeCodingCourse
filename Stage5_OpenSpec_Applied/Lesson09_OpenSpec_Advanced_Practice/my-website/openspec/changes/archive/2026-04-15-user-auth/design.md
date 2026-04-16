## Context

StudyPal 当前为纯前端 React SPA，已有 Dashboard 布局（Sidebar + 统计卡片 + 目标清单 + AI 建议 + 趋势图），全部使用 mock 数据。本次引入 FastAPI 后端 + JWT 用户认证，是后端的第一个 change，为数据持久化和个性化体验奠定基础。

现有前端已具备：
- react-router-dom 路由系统（`/` 品牌站、`/dashboard` 学习仪表盘）
- ThemeContext 全局主题切换
- Vite 构建配置（可通过 `server.proxy` 转发 API 请求）

## Goals / Non-Goals

**Goals:**
- 搭建独立的 FastAPI 后端项目骨架（与前端构建完全解耦）
- 实现用户注册、登录、JWT 刷新的完整认证链路
- 实现用户 Profile 的 CRUD（头像、连续学习天数、用户等级）
- 前端添加登录/注册页面并接入 API
- Dashboard 增加认证守卫

**Non-Goals:**
- 后台管理面板
- 第三方 OAuth
- 邮箱验证 / 密码重置
- 角色权限系统

## Decisions

### Decision 1: 后端项目结构

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              ← FastAPI 入口 + CORS 配置
│   ├── config.py             ← 环境变量（SECRET_KEY, DATABASE_URL）
│   ├── database.py           ← SQLAlchemy engine + session
│   ├── dependencies.py       ← get_db, get_current_user 依赖
│   ├── models/
│   │   ├── __init__.py
│   │   └── user.py           ← User ORM model
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── auth.py           ← RegisterRequest, LoginRequest, TokenResponse
│   │   └── user.py           ← UserProfile, UserProfileUpdate
│   └── routers/
│       ├── __init__.py
│       ├── auth.py           ← POST /register, POST /login, POST /refresh
│       └── users.py          ← GET /me, PATCH /me
├── alembic/
│   ├── env.py
│   └── versions/
├── alembic.ini
├── requirements.txt
└── .env
```

**理由**：遵循 FastAPI 标准分层（routers / schemas / models），与之前 backend/ 残留结构的 `__pycache__` 暗示的模式一致。Alembic 做迁移管理，避免手动 DDL。

### Decision 2: 数据库 — SQLite3 + SQLAlchemy

**选择**：SQLite3（单文件 `backend/data/studypal.db`）

**替代方案**：
- PostgreSQL：生产级更强，但本阶段单用户学习工具无需分布式数据库
- 裸 SQL：不利于迁移管理和 ORM 集成

**User 表结构**：

```sql
CREATE TABLE users (
    id          TEXT PRIMARY KEY,  -- UUID
    email       TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    avatar_url  TEXT DEFAULT '',
    streak_days INTEGER DEFAULT 0,
    level       INTEGER DEFAULT 1,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Decision 3: JWT 认证方案

**选择**：双 token 模式（access_token + refresh_token）

- `access_token`：短期有效（30 分钟），Bearer header 传递
- `refresh_token`：长期有效（7 天），仅用于 `/api/auth/refresh` 接口
- 签名算法：HS256，密钥从环境变量 `SECRET_KEY` 读取
- 密码哈希：`passlib[bcrypt]`

**替代方案**：
- Session + Cookie：不适合前后端分离的 SPA 架构
- OAuth2 Password Flow（FastAPI 内置）：过于复杂，本阶段只需简单 JWT

### Decision 4: API 端点规范

| Method | Path | Auth | Request Body | Response |
|--------|------|------|-------------|----------|
| POST | `/api/auth/register` | 无 | `{ email, password }` | `{ id, email }` |
| POST | `/api/auth/login` | 无 | `{ email, password }` | `{ access_token, refresh_token, token_type }` |
| POST | `/api/auth/refresh` | 无 | `{ refresh_token }` | `{ access_token, refresh_token, token_type }` |
| GET | `/api/users/me` | Bearer | — | `{ id, email, avatar_url, streak_days, level }` |
| PATCH | `/api/users/me` | Bearer | `{ avatar_url?, streak_days?, level? }` | `{ id, email, avatar_url, streak_days, level }` |

### Decision 5: 前端认证架构

**组件层级图**：

```
<ThemeProvider>
└── <BrowserRouter>
    └── <AuthProvider>                    ← 新增：管理 token + user 状态
        ├── Route path="/"
        │   └── <Home />                  ← 不变
        │
        ├── Route path="/login"
        │   └── <LoginPage />             ← 新增
        │
        ├── Route path="/register"
        │   └── <RegisterPage />          ← 新增
        │
        └── Route path="/dashboard"
            └── <ProtectedRoute>          ← 新增：未登录重定向 /login
                └── <DashboardPage>
                    ├── <Sidebar />       ← 改造：显示用户头像 + 等级
                    └── <main> ...
```

**AuthContext 设计**：
- 状态：`user | null`, `token | null`, `loading`
- 方法：`login(email, password)`, `register(email, password)`, `logout()`, `refreshToken()`
- Token 存储：`localStorage`（access_token + refresh_token）
- 初始化时自动尝试用 refresh_token 恢复登录状态

### Decision 6: Vite Proxy 配置

```ts
// vite.config.ts
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8000',
      changeOrigin: true,
    }
  }
}
```

开发时前端 `fetch('/api/auth/login')` 自动转发到 FastAPI。

## Risks / Trade-offs

- **[SQLite 并发限制]** → SQLite 不支持高并发写入。Mitigation：本阶段为单用户学习工具，足够使用。后续可无缝迁移到 PostgreSQL（SQLAlchemy ORM 层抽象了数据库差异）。
- **[JWT 无法主动失效]** → access_token 签发后无法服务端撤销。Mitigation：设置短有效期（30 分钟），配合 refresh_token 机制减少风险。
- **[Token 存储在 localStorage]** → 易受 XSS 攻击。Mitigation：本阶段为学习工具，无敏感数据。后续可改用 httpOnly cookie。
- **[前后端部署分离]** → GitHub Pages 只能部署前端，后端需另行部署。Mitigation：开发阶段用 Vite proxy，后续可部署后端到 Railway/Fly.io。
