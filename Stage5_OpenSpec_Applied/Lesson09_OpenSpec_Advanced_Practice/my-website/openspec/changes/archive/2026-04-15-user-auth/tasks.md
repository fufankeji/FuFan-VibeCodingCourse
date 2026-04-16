## 1. 后端项目骨架

- [x] 1.1 清理 `backend/` 中残留的 `__pycache__`、旧 `venv`、旧 `.env`，保留 `data/` 目录
- [x] 1.2 创建 `backend/requirements.txt`（fastapi, uvicorn, sqlalchemy, alembic, pyjwt, passlib[bcrypt], python-multipart, python-dotenv）
- [x] 1.3 创建 Python 虚拟环境并安装依赖（`python -m venv venv && pip install -r requirements.txt`）
- [x] 1.4 创建 `backend/app/__init__.py`, `backend/app/config.py`（读取 SECRET_KEY, DATABASE_URL 环境变量）
- [x] 1.5 创建 `backend/app/database.py`（SQLAlchemy engine + SessionLocal + Base）
- [x] 1.6 创建 `backend/app/main.py`（FastAPI app 实例 + CORS 配置 + router 挂载）
- [x] 1.7 创建 `backend/.env`（SECRET_KEY 和 DATABASE_URL 默认值）

**验证**：`uvicorn app.main:app --reload` 启动成功，`/docs` 返回 Swagger UI。

## 2. 数据库模型与迁移

- [x] 2.1 创建 `backend/app/models/__init__.py` 和 `backend/app/models/user.py`（User ORM：id, email, password_hash, avatar_url, streak_days, level, created_at, updated_at）
- [x] 2.2 初始化 Alembic（`alembic init alembic`），配置 `alembic/env.py` 读取 database URL 和 Base.metadata
- [x] 2.3 生成初始迁移（`alembic revision --autogenerate -m "create users table"`）
- [x] 2.4 执行迁移（`alembic upgrade head`），确认 `data/studypal.db` 中 `users` 表已创建

**验证**：用 SQLite CLI 或 Python 确认 `users` 表结构正确，包含所有字段。

## 3. 用户注册接口

- [x] 3.1 创建 `backend/app/schemas/__init__.py` 和 `backend/app/schemas/auth.py`（RegisterRequest, RegisterResponse）
- [x] 3.2 创建 `backend/app/routers/__init__.py` 和 `backend/app/routers/auth.py`，实现 `POST /api/auth/register`
- [x] 3.3 实现邮箱唯一性校验（409 Conflict）和密码长度校验（≥ 8 字符）
- [x] 3.4 实现密码 bcrypt 哈希存储

**验证**：通过 Swagger UI 测试注册成功、邮箱重复、密码过短三种场景。

## 4. 用户登录与 JWT 签发

- [x] 4.1 在 `backend/app/schemas/auth.py` 添加 LoginRequest, TokenResponse
- [x] 4.2 在 `backend/app/routers/auth.py` 实现 `POST /api/auth/login`（验证凭证 → 签发 access_token + refresh_token）
- [x] 4.3 实现 JWT 工具函数（create_access_token, create_refresh_token, decode_token），access_token 30 分钟有效，refresh_token 7 天有效
- [x] 4.4 实现 `POST /api/auth/refresh`（验证 refresh_token → 签发新 token 对）

**验证**：通过 Swagger UI 测试登录成功、密码错误、邮箱不存在、token 刷新成功、refresh_token 无效五种场景。

## 5. 用户 Profile 接口

- [x] 5.1 创建 `backend/app/schemas/user.py`（UserProfile, UserProfileUpdate）
- [x] 5.2 创建 `backend/app/dependencies.py`（get_db, get_current_user — 从 Bearer token 解析当前用户）
- [x] 5.3 创建 `backend/app/routers/users.py`，实现 `GET /api/users/me`（返回当前用户 Profile）
- [x] 5.4 实现 `PATCH /api/users/me`（部分更新 avatar_url, streak_days, level）

**验证**：通过 Swagger UI 测试获取 Profile、更新单字段、更新多字段、未携带 token 四种场景。

## 6. 前端认证基础设施

- [x] 6.1 更新 `vite.config.ts`，添加 `/api` proxy 指向 `http://localhost:8000`
- [x] 6.2 创建 `src/contexts/AuthContext.tsx`（AuthProvider：user, token, login, register, logout, refreshToken）
- [x] 6.3 创建 `src/components/ProtectedRoute.tsx`（未登录重定向到 /login，token 过期自动刷新）
- [x] 6.4 更新 `src/App.tsx`：包裹 AuthProvider，添加 `/login` 和 `/register` 路由，Dashboard 路由用 ProtectedRoute 守卫

**验证**：确认前端构建无错误，未登录访问 /dashboard 被重定向到 /login。

## 7. 前端登录/注册页面

- [x] 7.1 创建 `src/pages/LoginPage.tsx`（邮箱 + 密码表单，调用 AuthContext.login）
- [x] 7.2 创建 `src/pages/RegisterPage.tsx`（邮箱 + 密码 + 确认密码表单，调用 AuthContext.register）
- [x] 7.3 登录/注册页面之间添加互相跳转链接
- [x] 7.4 登录成功后自动跳转到 /dashboard，注册成功后自动跳转到 /login

**验证**：完整走查注册 → 登录 → 进入 Dashboard 流程。

## 8. Dashboard 认证集成

- [x] 8.1 改造 `src/components/dashboard/Sidebar.tsx`：底部显示当前用户头像、等级徽章和登出按钮
- [x] 8.2 实现登出功能：清除 token + user 状态，重定向到 /login
- [x] 8.3 确认暗色模式下登录/注册页面和用户信息展示样式正确

**验证**：登录后 Sidebar 显示用户信息，点击登出回到登录页，再次访问 /dashboard 被重定向。

## 9. 集成测试与最终验证

- [x] 9.1 完整走查：注册 → 登录 → Dashboard 展示 → Profile 更新 → 登出 → 重定向
- [x] 9.2 验证 token 刷新：手动将 access_token 过期后访问 Dashboard，确认自动刷新
- [x] 9.3 验证错误场景：重复邮箱注册、错误密码登录、无效 token 访问 API
- [x] 9.4 运行 `npm run build` 确认前端构建无错误
- [x] 9.5 确认后端启动和前端构建互不影响（独立流程）
