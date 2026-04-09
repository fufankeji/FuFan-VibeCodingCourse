# GraphRAG Studio — Project Conventions

## 1. 目录结构

- **前端代码** 统一放在 `frontend/` 目录下
- **后端代码** 统一放在 `backend/` 目录下

```
GraphRAGAgent/
├── frontend/   # 所有前端代码（HTML/CSS/JS）
├── backend/    # 所有后端代码（FastAPI 服务）
└── docs/       # 规范文档
```

## 2. 环境变量与敏感配置

- 所有外部配置（API Key、Base URL、Token 等）统一在 `backend/.env` 中管理
- `.env` 文件**禁止提交到 Git**，必须在 `.gitignore` 中忽略
- 提供 `backend/.env.example` 作为配置模板（不含真实值）

## 3. 后端虚拟环境

- 后端服务必须使用 `uv` 创建独立虚拟环境：

```bash
cd backend
uv venv
uv pip install -r requirements.txt
```

- 虚拟环境目录 `.venv/` 不提交到 Git
