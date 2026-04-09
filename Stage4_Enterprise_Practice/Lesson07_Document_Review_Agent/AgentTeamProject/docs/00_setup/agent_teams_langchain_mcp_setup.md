# Agent Teams & LangChain MCP 环境配置与验证报告

> 日期：2026-03-11
> 项目路径：`F:/AgentTeamProject`

---

## 1. Agent Teams 功能启用验证

### 1.1 验证结果：已启用

| 检查项 | 状态 | 说明 |
|--------|------|------|
| `teammateMode` | `"in-process"` | 配置于 `.claude/settings.local.json` |
| 自定义 Agent 定义 | 4 个 | `researcher` / `implementer` / `reviewer` / `architect` |
| Hooks 脚本 | 2 个 | `check-build.sh` (TeammateIdle) / `verify-task.sh` (TaskCompleted) |
| CLAUDE.md 项目说明 | 已配置 | 包含 Agent Teams 使用说明和团队约定 |

### 1.2 自定义 Agent 角色一览

| Agent | 模型 | 职责 | 定义文件 |
|-------|------|------|----------|
| **researcher** | Sonnet | 探索代码库、阅读文档、收集信息 | `.claude/agents/researcher.md` |
| **implementer** | Sonnet | 根据计划编写和修改代码 | `.claude/agents/implementer.md` |
| **reviewer** | Sonnet | 代码审查、安全检查、运行测试 | `.claude/agents/reviewer.md` |
| **architect** | Opus | 系统架构设计、制定实施计划 | `.claude/agents/architect.md` |

### 1.3 项目目录结构

```
F:/AgentTeamProject/
├── CLAUDE.md                              # 项目级指令文件
├── docs/
│   └── 00_setup/
│       └── agent_teams_langchain_mcp_setup.md  # 本文档
└── .claude/
    ├── settings.local.json                # 本地配置 (teammateMode + permissions)
    ├── agents/                            # 自定义 Agent 定义
    │   ├── architect.md
    │   ├── researcher.md
    │   ├── implementer.md
    │   └── reviewer.md
    └── hooks/                             # 质量门控脚本
        ├── check-build.sh
        └── verify-task.sh
```

---

## 2. LangChain MCP 接入验证

### 2.1 配置方式

通过以下命令将 LangChain 文档 MCP 服务器注册到当前项目：

```bash
claude mcp add --transport http docs-langchain https://docs.langchain.com/mcp
```

配置结果存储于 `~/.claude.json` 的项目级别配置中：

```json
{
  "projects": {
    "F:/AgentTeamProject": {
      "mcpServers": {
        "docs-langchain": {
          "type": "http",
          "url": "https://docs.langchain.com/mcp"
        }
      }
    }
  }
}
```

### 2.2 连通性测试结果：通过

| 测试项 | 结果 |
|--------|------|
| MCP Server 类型 | HTTP transport |
| Server URL | `https://docs.langchain.com/mcp` |
| 提供的工具 | `search_docs_by_lang_chain` |
| 测试查询 | "What is LangChain and how to get started" |
| 返回结果 | 成功返回 10 条文档（含 LangChain 概览、安装指南、v1 特性、集成列表等） |
| 连通状态 | **正常** |

---

## 3. LangChain MCP 的作用

### 3.1 什么是 LangChain MCP

MCP (Model Context Protocol) 是一个开放协议，标准化了应用程序向 LLM 提供工具和上下文的方式。LangChain 提供的 MCP 服务（`https://docs.langchain.com/mcp`）是一个**只读的文档检索服务**，它暴露了一个工具：

- **`search_docs_by_lang_chain`**：搜索 LangChain 官方知识库，返回与查询相关的文档标题、链接和内容摘要。

### 3.2 核心能力

LangChain 文档 MCP 的核心能力是**让 AI 助手能够实时查询 LangChain 官方最新文档**，覆盖范围包括：

| 文档范围 | 说明 |
|----------|------|
| **LangChain** | 核心框架：Agent 创建、工具集成、MCP 适配器、中间件等 |
| **LangGraph** | 低层级 Agent 编排框架：状态管理、检查点、中断/恢复等 |
| **LangSmith** | 可观测性平台：追踪、数据集、实验、Agent 服务器等 |
| **Deep Agents** | 高级 Agent：子代理、沙盒、虚拟文件系统等 |
| **集成生态** | 1000+ 集成：各种 LLM 提供商、向量数据库、工具包等 |

### 3.3 与其他 MCP 服务的区别

| MCP 服务 | 用途 |
|----------|------|
| **LangChain Docs MCP**（本项目使用） | 检索 LangChain/LangGraph/LangSmith 官方文档 |
| LangSmith MCP Server | 读取 LangSmith 工作区的对话历史、Prompt、运行记录、数据集等 |
| Agent Server MCP Endpoint | 将 LangGraph Agent 暴露为 MCP 工具，供其他 MCP 客户端调用 |

---

## 4. LangChain Code Interpreter（代码解释器）

### 4.1 概述

Code Interpreter 是 LangChain 集成的一类工具，允许 Agent 在**安全沙盒环境**中编写并执行代码。不同的 LLM 提供商提供了各自的实现：

| 提供商 | 工具名称 | 能力 |
|--------|----------|------|
| **OpenAI** | `tools.codeInterpreter()` | 在沙盒中运行 Python，支持 1GB/4GB/16GB/64GB 内存配置 |
| **Anthropic** | `tools.codeExecution_20250825()` | 运行 Bash 命令和文件操作，支持容器复用 |
| **AWS Bedrock** | `create_code_interpreter_toolkit()` | 在托管沙盒中执行 Python/JS/TS |
| **第三方沙盒** | E2B / Daytona / Runloop / Modal | 独立的沙盒后端，提供完整的文件系统和 Shell 访问 |

### 4.2 典型使用场景

- **数据分析**：处理文件、统计计算
- **文件生成**：创建图表、报告
- **迭代编码**：编写并运行代码解决问题
- **图像处理**：裁剪、缩放、旋转、变换

### 4.3 沙盒架构

```
┌─────────────┐                      ┌─────────────────────┐
│    Agent     │                      │      Sandbox        │
│  ┌───────┐   │   backend protocol   │  ┌──────────────┐   │
│  │  LLM  │◄─►│◄────────────────────►│  │  Filesystem   │   │
│  └───┬───┘   │                      │  ├──────────────┤   │
│  ┌───▼───┐   │                      │  │    Bash       │   │
│  │ Tools │   │                      │  ├──────────────┤   │
│  └───────┘   │                      │  │ Dependencies  │   │
└─────────────┘                      └─────────────────────┘
```

沙盒提供隔离环境，确保 Agent 的代码执行不会影响宿主系统的凭证、文件或网络。

---

## 5. Human-in-the-Loop（人机协作流程）

### 5.1 概述

Human-in-the-Loop (HITL) 是 LangChain/LangGraph 提供的中间件机制，用于在 Agent 执行敏感操作前**暂停执行并等待人类审批**。

### 5.2 工作流程

```
┌─────────┐      ┌──────────────┐      ┌──────────┐
│  Agent   │─────►│  需要中断？   │──No──►│   执行    │──────┐
│ 提出操作  │      └──────────────┘      │  工具调用  │      │
└─────────┘              │              └──────────┘      │
                        Yes                                │
                         │                                 │
                         ▼                                 │
                  ┌──────────────┐                         │
                  │   人类审查    │                         │
                  │              │                         │
                  ├──────────────┤                         │
                  │ ● Approve    │──批准──► 执行工具 ───────┤
                  │   (批准)      │                         │
                  │ ● Edit       │──编辑──► 修改参数后执行 ──┤
                  │   (编辑参数)  │                         │
                  │ ● Reject     │──拒绝──► 取消执行 ───────┤
                  │   (拒绝)      │                         │
                  └──────────────┘                         │
                                                           ▼
                                                   ┌──────────┐
                                                   │ Agent 继续│
                                                   └──────────┘
```

### 5.3 三种决策类型

| 决策 | 说明 | 示例 |
|------|------|------|
| **Approve（批准）** | 按原样执行工具调用 | 批准 SQL 查询执行 |
| **Edit（编辑）** | 修改工具调用参数后执行 | 修改 SQL 查询语句再执行 |
| **Reject（拒绝）** | 拒绝执行并返回反馈 | 拒绝删除数据库记录的操作 |

### 5.4 核心实现机制

1. **配置中断策略**：通过 `interrupt_on` 参数指定哪些工具需要人工审批
2. **状态持久化**：使用 LangGraph 的 Checkpointer 保存执行状态，支持无限期暂停和恢复
3. **中断触发**：当 Agent 调用匹配策略的工具时，自动暂停执行并发出 `interrupt`
4. **人类决策**：审查工具调用的名称和参数，做出 approve / edit / reject 决策
5. **恢复执行**：通过 `Command(resume={"decisions": [...]})` 恢复执行

### 5.5 Python 代码示例

```python
from langchain.agents import create_agent
from langchain.agents.middleware import HumanInTheLoopMiddleware
from langgraph.checkpoint.memory import InMemorySaver

agent = create_agent(
    model="claude-sonnet-4-6",
    tools=[read_email_tool, send_email_tool],
    checkpointer=InMemorySaver(),
    middleware=[
        HumanInTheLoopMiddleware(
            interrupt_on={
                "send_email_tool": {                      # 发邮件需要审批
                    "allowed_decisions": ["approve", "edit", "reject"],
                },
                "read_email_tool": False,                  # 读邮件不需要审批
            }
        ),
    ],
)
```

### 5.6 典型应用场景

- **高风险操作**：数据库写入、金融交易、文件删除
- **合规工作流**：需要人工监督的强制审批流程
- **SQL Agent**：在执行 SQL 查询前暂停等待人类审查
- **邮件发送**：发送邮件前需要人工确认收件人和内容

---

## 6. 结论

### LangChain 的文档 MCP 主要负责获取官方最新的文档规范

LangChain 提供的 MCP 服务（`https://docs.langchain.com/mcp`）**本质上是一个官方文档实时检索接口**，其核心定位和作用如下：

1. **它不是一个执行工具**：不能运行代码、不能操作数据库、不能调用 API，仅提供文档搜索能力
2. **它是一个知识获取通道**：让 AI 助手能够检索 LangChain / LangGraph / LangSmith / Deep Agents 的最新官方文档
3. **它解决的是信息时效性问题**：AI 模型的训练数据有截止日期，而 LangChain 生态迭代迅速（如 v1 的 `create_agent` 替代了旧的 `create_react_agent`），通过 MCP 可以获取到最新的 API 参考、最佳实践和代码示例
4. **它的唯一工具是 `search_docs_by_lang_chain`**：接受一个查询字符串，返回匹配的文档标题、链接和内容摘要

**简而言之：LangChain MCP = LangChain 官方文档的实时搜索引擎，确保 AI 助手始终基于最新的官方规范提供准确的技术指导。**

---

## 附录：配置清单

### A. Agent Teams 配置文件

| 文件 | 用途 |
|------|------|
| `.claude/settings.local.json` | 本地设置：teammateMode、permissions |
| `.claude/agents/researcher.md` | 研究员 Agent 定义 |
| `.claude/agents/implementer.md` | 实现者 Agent 定义 |
| `.claude/agents/reviewer.md` | 审查员 Agent 定义 |
| `.claude/agents/architect.md` | 架构师 Agent 定义 |
| `.claude/hooks/check-build.sh` | TeammateIdle 质量门控 |
| `.claude/hooks/verify-task.sh` | TaskCompleted 质量门控 |

### B. LangChain MCP 配置

| 配置项 | 值 |
|--------|-----|
| Server 名称 | `docs-langchain` |
| 传输协议 | HTTP |
| Server URL | `https://docs.langchain.com/mcp` |
| 配置存储位置 | `~/.claude.json` (项目级) |
| 提供的工具 | `search_docs_by_lang_chain` |
