# Agent Team Project

## 项目结构与职责边界

```
AgentTeamProject/
├── frontend/          # 前端工程
├── backend/           # 后端工程
├── docs/              # 项目文档（全生命周期）
├── .claude/           # Claude Code 配置
└── CLAUDE.md          # 本文件 — 项目级指令
```

### frontend/

- 职责：用户界面、交互逻辑、页面路由、状态管理、API 调用
- 不包含：业务规则计算、数据持久化、鉴权校验逻辑
- 与 backend 的唯一交互方式是 HTTP API（定义在 `docs/08_api_spec/`）
- **包管理**：使用 `npm`（注意：package.json 含 pnpm 配置，但在本机环境下 pnpm 因内存不足会崩溃，统一改用 npm）

#### 前端启动方式

```bash
# 工作目录
cd F:/AgentTeamProject/frontend

# 首次安装依赖（仅需执行一次）
npm install --legacy-peer-deps

# 启动开发服务器（默认端口 5173，被占用时自动顺延）
npm run dev

# 构建生产产物
npm run build
```

> 访问地址：http://localhost:5173（若端口被占用则为 5174 等）

### backend/

- 职责：业务逻辑、数据持久化、鉴权授权、API 服务、后台任务
- 不包含：页面渲染、CSS 样式、前端路由
- **环境变量**：统一使用 `.env` 文件管理，禁止在代码中硬编码密钥或连接串
- **包管理**：使用 `uv` 管理 Python 虚拟环境和依赖
- `.env` 文件不得提交到版本控制（已在 `.gitignore` 中排除）

### docs/

- 职责：承载项目全生命周期文档，从业务调研到发布部署
- 每个阶段对应一个编号目录（`00_setup` ~ `12_release_deployment`）
- 文档是各阶段的核心交付物，所有 Agent Team 工作必须产出对应文档

---

## Agent Teams 配置

本项目启用了 Agent Teams，自定义 Agent 角色如下：

| Agent | 模型 | 职责 | 定义文件 |
|-------|------|------|----------|
| **researcher** | Sonnet | 探索代码库、阅读文档、收集信息 | `.claude/agents/researcher.md` |
| **implementer** | Sonnet | 根据计划编写和修改代码 | `.claude/agents/implementer.md` |
| **reviewer** | Sonnet | 代码审查、安全检查、运行测试 | `.claude/agents/reviewer.md` |
| **architect** | Opus | 系统架构设计、制定实施计划 | `.claude/agents/architect.md` |

### 使用方式

用自然语言创建团队即可：
- "Create an agent team with a researcher and two implementers to build the auth module"
- "Spawn a reviewer teammate to check the latest changes"

---

## 工作规范（所有 Agent 必须遵守）

### 规范 1：每个阶段必须有明确的输出文件

- 每个 Agent Team 阶段都必须在对应的 `docs/` 子目录下产出 Markdown 文档
- 文档是阶段完成的唯一标志，无文档 = 未完成
- 输出文件命名格式：`{目录名}/{主题}.md`

### 规范 2：复杂任务必须先 Plan 再实施

- 涉及多文件修改、架构变更、新模块开发的任务，必须先使用 architect Agent 产出计划
- 计划文档存放在对应阶段目录，文件名带 `plan_` 前缀
- 计划经确认后，再由 implementer 执行

### 规范 3：职责分离，避免文件冲突

- 每个 teammate 只修改自己负责的文件
- frontend 和 backend 代码不得交叉修改
- 文档目录下的文件按阶段归属，不同阶段的 Agent 不应修改其他阶段的文档

### 规范 4：后端工程约定

- Python 虚拟环境和依赖管理统一使用 `uv`
- 环境变量统一使用 `.env` 文件，通过 `python-dotenv` 或框架内置方式加载
- 禁止在代码中硬编码任何密钥、Token、数据库连接串

### 规范 5：代码提交前必须经过 reviewer 检查

- 所有代码变更在合并前必须经过 reviewer Agent 审查
- reviewer 检查项包括：正确性、安全性、规范一致性

---

## Docs 目录阶段说明

| 编号 | 目录 | 阶段 | 核心交付物 |
|------|------|------|-----------|
| 00 | `00_setup` | 项目初始化与环境搭建 | 环境配置文档、项目规范 |
| 01 | `01_business_research` | 业务调研 | 行业分析、用户画像、需求清单 |
| 02 | `02_competitive_analysis` | 竞品分析 | 竞品对比矩阵、差异化策略 |
| 03 | `03_problem_modeling` | 业务问题建模 | 问题定义、领域模型、业务流程图 |
| 04 | `04_interaction_design` | 核心交互链路设计 | 用户旅程图、核心流程图、状态机 |
| 05 | `05_prototype_spec` | 产品原型规范 | 页面清单、交互规范、UI 标注 |
| 06 | `06_architecture` | 系统架构设计 | 架构图、技术选型、部署拓扑 |
| 07 | `07_data_model` | 数据模型 | ER 图、表结构定义、索引策略 |
| 08 | `08_api_spec` | API 规范 | OpenAPI/Swagger 文档、接口清单 |
| 09 | `09_frontend_plan` | 前端实现计划 | 组件拆分、路由设计、状态管理方案 |
| 10 | `10_backend_plan` | 后端实现计划 | 模块划分、服务分层、任务排期 |
| 11 | `11_integration_testing` | 联调与测试 | 联调清单、测试用例、缺陷记录 |
| 12 | `12_release_deployment` | 发布与部署 | 部署方案、发布清单、回滚策略 |

---

## MCP 集成

| MCP Server | 用途 |
|------------|------|
| `docs-langchain` | 实时检索 LangChain/LangGraph/LangSmith 官方最新文档 |
