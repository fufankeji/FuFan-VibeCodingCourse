# 项目规范文档

> 版本：v1.0
> 日期：2026-03-11
> 状态：生效中

---

## 1. 项目目录结构

```
AgentTeamProject/
│
├── frontend/                          # 前端工程
│   ├── public/                        #   静态资源
│   ├── src/                           #   源码
│   │   ├── components/                #     UI 组件
│   │   ├── pages/                     #     页面
│   │   ├── hooks/                     #     自定义 hooks
│   │   ├── services/                  #     API 调用层
│   │   ├── stores/                    #     状态管理
│   │   ├── utils/                     #     工具函数
│   │   └── types/                     #     类型定义
│   ├── package.json
│   └── tsconfig.json
│
├── backend/                           # 后端工程
│   ├── app/                           #   应用主目录
│   │   ├── api/                       #     路由/接口层
│   │   ├── core/                      #     核心配置（settings, security）
│   │   ├── models/                    #     数据模型
│   │   ├── schemas/                   #     请求/响应 Schema
│   │   ├── services/                  #     业务逻辑层
│   │   └── utils/                     #     工具函数
│   ├── tests/                         #   测试
│   ├── .env                           #   环境变量（不提交）
│   ├── .env.example                   #   环境变量模板（提交）
│   └── pyproject.toml                 #   项目配置（uv 管理）
│
├── docs/                              # 项目文档（全生命周期）
│   ├── 00_setup/                      #   项目初始化与环境搭建
│   ├── 01_business_research/          #   业务调研
│   ├── 02_competitive_analysis/       #   竞品分析
│   ├── 03_problem_modeling/           #   业务问题建模
│   ├── 04_interaction_design/         #   核心交互链路设计
│   ├── 05_prototype_spec/             #   产品原型规范
│   ├── 06_architecture/               #   系统架构设计
│   ├── 07_data_model/                 #   数据模型
│   ├── 08_api_spec/                   #   API 规范
│   ├── 09_frontend_plan/              #   前端实现计划
│   ├── 10_backend_plan/               #   后端实现计划
│   ├── 11_integration_testing/        #   联调与测试
│   └── 12_release_deployment/         #   发布与部署
│
├── .claude/                           # Claude Code 配置
│   ├── agents/                        #   自定义 Agent 定义
│   ├── hooks/                         #   质量门控脚本
│   ├── settings.json                  #   共享配置
│   └── settings.local.json            #   本地配置（不提交）
│
├── .gitignore
└── CLAUDE.md                          # 项目级指令文件
```

---

## 2. 职责边界定义

### 2.1 frontend — 前端工程

| 维度 | 规则 |
|------|------|
| **负责** | 用户界面渲染、交互逻辑、页面路由、前端状态管理、API 请求发起 |
| **不负责** | 业务规则计算、数据持久化、鉴权校验、密钥管理 |
| **与后端的边界** | 仅通过 `docs/08_api_spec/` 中定义的 HTTP API 通信 |
| **技术栈约束** | 待架构设计阶段确定（`docs/06_architecture/`） |

### 2.2 backend — 后端工程

| 维度 | 规则 |
|------|------|
| **负责** | 业务逻辑、数据持久化、鉴权授权、API 服务、后台任务调度 |
| **不负责** | 页面渲染、CSS 样式、前端交互 |
| **包管理** | 统一使用 `uv` 管理 Python 虚拟环境和依赖 |
| **环境变量** | 统一使用 `.env` 文件，禁止硬编码密钥 |
| **技术栈约束** | 待架构设计阶段确定（`docs/06_architecture/`） |

### 2.3 docs — 项目文档

| 维度 | 规则 |
|------|------|
| **负责** | 承载项目全生命周期的设计文档、规范文档、计划文档 |
| **格式** | 统一使用 Markdown（`.md`）格式 |
| **归属** | 每个编号目录对应一个项目阶段，文档归属到对应阶段目录 |
| **交付标准** | 每个阶段至少产出一份核心文档，文档即交付物 |

---

## 3. 后端工程规范

### 3.1 环境变量管理

```
backend/
├── .env              # 实际环境变量（包含密钥，不提交 git）
├── .env.example      # 模板文件（不含真实值，提交 git）
```

**规则：**
- 所有配置项（数据库连接、API 密钥、第三方服务凭证）统一写入 `.env`
- 代码中通过 `python-dotenv` 或框架内置方式加载，禁止 `os.environ` 硬编码默认值
- `.env` 必须在 `.gitignore` 中排除
- `.env.example` 列出所有必需的环境变量名和说明，但不包含真实值

### 3.2 虚拟环境管理（uv）

```bash
# 初始化项目
cd backend && uv init

# 添加依赖
uv add fastapi uvicorn

# 安装所有依赖
uv sync

# 运行项目
uv run python -m app.main
```

**规则：**
- 不使用 pip / pipenv / poetry，统一使用 `uv`
- 依赖声明在 `pyproject.toml` 中
- `uv.lock` 文件提交到 git 以确保环境一致性

---

## 4. Agent Team 工作规范

### 4.1 阶段输出要求

**每个 Agent Team 阶段必须有明确的输出文件：**

| 阶段 | 输出目录 | 最低要求 |
|------|----------|----------|
| 00 项目初始化 | `docs/00_setup/` | 环境配置文档、项目规范文档 |
| 01 业务调研 | `docs/01_business_research/` | 调研报告（含用户画像、需求清单） |
| 02 竞品分析 | `docs/02_competitive_analysis/` | 竞品对比矩阵 |
| 03 问题建模 | `docs/03_problem_modeling/` | 领域模型、业务流程定义 |
| 04 交互设计 | `docs/04_interaction_design/` | 核心用户旅程、交互流程图 |
| 05 原型规范 | `docs/05_prototype_spec/` | 页面清单、交互标注 |
| 06 架构设计 | `docs/06_architecture/` | 系统架构图、技术选型文档 |
| 07 数据模型 | `docs/07_data_model/` | ER 图、表结构定义 |
| 08 API 规范 | `docs/08_api_spec/` | 接口清单、请求/响应格式 |
| 09 前端计划 | `docs/09_frontend_plan/` | 组件拆分、路由设计 |
| 10 后端计划 | `docs/10_backend_plan/` | 模块划分、服务分层 |
| 11 联调测试 | `docs/11_integration_testing/` | 联调清单、测试用例 |
| 12 发布部署 | `docs/12_release_deployment/` | 部署方案、发布清单 |

### 4.2 Plan 优先原则

**复杂任务必须先 Plan 再实施：**

```
判断标准 → 是否为复杂任务？
│
├── 涉及 3 个以上文件的修改         → 是
├── 新增模块或子系统                 → 是
├── 架构层面的变更                   → 是
├── 跨 frontend/backend 的联动改动   → 是
└── 单文件 bug 修复或小调整          → 否
```

**Plan 流程：**

1. **architect** Agent 产出计划文档（`plan_*.md`），存放在对应阶段目录
2. 计划文档包含：目标、方案、文件清单、风险点、验收标准
3. 用户确认计划后，**implementer** Agent 按计划执行
4. 执行完成后，**reviewer** Agent 检查实现与计划的一致性

### 4.3 文件所有权

| Agent 角色 | 可修改范围 |
|------------|-----------|
| **architect** | `docs/` 下的计划文档（`plan_*.md`） |
| **researcher** | `docs/` 下的调研和分析文档 |
| **implementer** | `frontend/` 或 `backend/` 的代码文件（按任务分配） |
| **reviewer** | 不直接修改文件，仅输出审查意见到 `docs/` |

**铁律：** 两个 implementer 不得同时修改同一个文件。

---

## 5. 版本控制规范

### 5.1 .gitignore 核心规则

```gitignore
# 环境变量（含密钥）
backend/.env

# Python 虚拟环境
.venv/
__pycache__/

# Node 依赖
node_modules/

# IDE 配置
.idea/
.vscode/

# Claude Code 本地配置
.claude/settings.local.json

# 系统文件
.DS_Store
Thumbs.db
```

### 5.2 提交规范

- 提交前必须经过 reviewer 检查
- Commit message 使用英文，格式：`<type>: <description>`
- type 可选值：`feat` / `fix` / `docs` / `refactor` / `test` / `chore`

---

## 6. 阶段推进流程

```
00_setup  →  01_business_research  →  02_competitive_analysis
                                              ↓
            04_interaction_design  ←  03_problem_modeling
                    ↓
            05_prototype_spec
                    ↓
            06_architecture
                    ↓
         ┌──────────┴──────────┐
   07_data_model          08_api_spec
         └──────────┬──────────┘
                    ↓
         ┌──────────┴──────────┐
   09_frontend_plan      10_backend_plan
         └──────────┬──────────┘
                    ↓
         11_integration_testing
                    ↓
         12_release_deployment
```

**原则：**
- 每个阶段的输出是下一个阶段的输入
- 不跳阶段：未完成当前阶段的文档交付物，不进入下一阶段
- 允许在后续阶段回溯更新前序文档，但需注明修订原因
