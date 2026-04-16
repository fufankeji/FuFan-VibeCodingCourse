## Why

StudyPal 当前是纯前端应用，所有数据使用 mock。要实现真正的学习数据持久化和个性化体验，需要用户认证系统作为基础设施。这是后端 API 的第一个 change，为后续功能（AI 对话、学习记录同步）提供认证基座。

## What Changes

- 新建 `backend/` FastAPI 项目骨架（项目结构、依赖管理、启动配置）
- 使用 SQLite3 作为数据库，Alembic 管理数据库迁移
- 实现用户注册接口（邮箱 + 密码）
- 实现用户登录接口（返回 JWT access_token + refresh_token）
- 实现 JWT token 刷新接口
- 实现用户 Profile 接口（获取 / 更新头像、连续学习天数、用户等级）
- 前端添加登录/注册页面，接入认证 API
- Dashboard 接入认证状态，未登录时重定向到登录页

## Capabilities

### New Capabilities
- `auth-registration`: 用户注册（邮箱唯一性校验、密码哈希存储）
- `auth-login`: 用户登录（凭证验证、JWT 签发、refresh token 机制）
- `user-profile`: 用户 Profile CRUD（头像 URL、连续学习天数、用户等级）
- `backend-setup`: FastAPI 项目骨架（目录结构、数据库连接、Alembic 配置、CORS）

### Modified Capabilities
- `dashboard-layout`: Dashboard 增加认证守卫，未登录用户重定向到登录页；Sidebar 显示当前用户信息

## Impact

- **新增目录**：`backend/`（FastAPI 项目，独立于前端构建）
- **新增依赖**：`fastapi`, `uvicorn`, `sqlalchemy`, `alembic`, `pyjwt`, `passlib[bcrypt]`, `python-multipart`
- **前端新增依赖**：无（使用原生 fetch）
- **前端新增文件**：登录/注册页面组件、auth context、受保护路由组件
- **前端改动文件**：`App.tsx`（新增 auth 路由）、`vite.config.ts`（添加 `/api` proxy）、`DashboardPage.tsx`（认证守卫）、`Sidebar.tsx`（用户信息展示）
- **数据库**：新增 `users` 表（id, email, password_hash, avatar_url, streak_days, level, created_at, updated_at）

## Out-of-Scope（不做）

- 后台管理面板
- 第三方 OAuth（GitHub / Google 登录）
- 邮箱验证 / 密码重置流程
- 角色权限系统（RBAC）
- 前端表单验证库（使用原生 HTML5 validation）

## 回滚方案

后端为独立目录，回滚只需：
1. 删除 `backend/` 目录
2. 前端移除 auth 相关路由和组件
3. Dashboard 移除认证守卫，恢复为直接访问
