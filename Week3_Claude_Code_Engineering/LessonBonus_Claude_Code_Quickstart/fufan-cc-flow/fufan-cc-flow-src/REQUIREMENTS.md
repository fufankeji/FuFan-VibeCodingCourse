# Fufan-CC Flow — 产品需求文档

> 版本：1.0 | 状态：功能完整，持续迭代

---

## 1. 产品定位

### 1.1 背景

Claude Code 是 Anthropic 推出的 AI 编程 CLI 工具，功能强大但对初学者不够直观：纯命令行界面、Tool Call 过程不可见、HIL 权限确认需要切换终端窗口、会话历史难以管理。

### 1.2 目标

**Fufan-CC Flow** 在不改变 Claude Code 核心能力的前提下，为其提供一个：

- **可视化**的工具调用过程
- **Web 化**的会话管理和权限交互
- **IDE 化**的文件/终端/代码查看体验
- **可扩展**的 MCP / Plugin / Memory 管理面板

### 1.3 目标用户

| 用户类型 | 核心诉求 |
|----------|----------|
| AI 编程初学者 | 直观看到 Claude "在干什么"，降低 CLI 学习门槛 |
| 个人开发者 | 在 Web 界面中完整替代终端 Claude Code 工作流 |
| 团队/教学场景 | 演示 AI Agent 执行流程，Screen Share 友好 |

---

## 2. 功能需求

### 2.1 Phase 1 — 核心对话功能（已完成）

#### F1.1 实时对话流

- **流式输出**：Token 级逐字显示，响应延迟可感知
- **Thinking 块**：Extended Thinking 内容可折叠展开
- **Markdown 渲染**：支持代码块（语法高亮）、表格、列表、GFM
- **状态提示**：输入框上方显示当前 Claude 状态（正在思考 / 正在执行命令 / 等待确认…）

#### F1.2 工具调用可视化（Tool Call Cards）

每次工具调用展示为独立卡片，包含：

| 字段 | 说明 |
|------|------|
| 工具名称 | 如 Bash / Read / Write / Glob / Agent |
| 输入参数 | 折叠展示，支持展开查看完整 JSON |
| 执行状态 | running / done / error / awaiting_permission |
| 执行结果 | 可折叠的输出内容（截断超长内容） |

支持的工具：Bash、Read、Write、Edit、Glob、Grep、WebFetch、WebSearch、Agent、Task、TodoWrite、NotebookEdit 等。

#### F1.3 HIL 权限确认

当 Claude Code 执行需要用户授权的操作时（如写入文件、执行危险命令），触发权限确认流：

- 弹出权限确认弹窗，显示工具名、操作路径、拒绝原因
- 用户选项：**允许一次** / **永久允许此工具** / **拒绝**
- 超时（60 秒）自动拒绝，UI 显示超时提示
- 通过 WebSocket 双向传递权限决策

#### F1.4 会话管理

- **历史会话列表**：从 Claude Code CLI 数据目录读取，支持按项目筛选
- **会话恢复**：点击历史会话可继续对话
- **会话分支（Fork）**：从当前会话的任意 Checkpoint 派生新会话
- **会话重命名**：支持自定义会话标题

#### F1.5 上下文压缩感知

- **Token 用量条**：实时显示当前上下文使用量 / 最大窗口（200K / 1M）
- **压缩事件标记**：上下文压缩时在消息流中插入分隔线，显示压缩前后 Token 数
- **任务结果摘要**：对话结束后显示本次调用费用、Token 消耗、耗时

#### F1.6 模型切换

- 支持在输入栏切换 Claude 模型：Opus 4.5 / Sonnet 4.5 / Haiku 4.5 及更新版本
- 支持自定义 Base URL（国产基座或中转服务）
- 模型选择实时生效，新对话使用新模型

---

### 2.2 Phase 2 — IDE / 扩展功能（已完成）

#### F2.1 文件树

- 左侧面板展示项目文件树（可折叠/展开）
- 支持创建文件/文件夹、重命名、删除（含项目目录安全校验）
- 文件类型图标区分（代码 / 图片 / JSON / Markdown 等）
- 实时刷新（对话后可手动刷新）

#### F2.2 代码查看器

- 点击文件树节点在右侧打开文件内容
- CodeMirror 6 语法高亮（支持 50+ 语言）
- Tab 式多文件切换
- Diff 视图：对比文件修改前后内容

#### F2.3 集成终端

- 右侧面板嵌入完整 Shell（xterm.js + node-pty）
- 支持 macOS/Linux（Bash/Zsh）和 Windows（Git Bash / PowerShell）
- 终端与对话共享工作目录上下文

#### F2.4 MCP 管理

- 列出当前项目和用户级别的 MCP Server
- 图形化添加 MCP Server（stdio / HTTP / SSE / OAuth）
- 支持 JSON 方式直接导入 MCP 配置
- 支持一键导入 Claude Desktop 的 MCP 配置
- 删除、查看单个 Server 的详细配置

#### F2.5 Memory 管理

- **Auto Memory**：查看、编辑 Claude Code 自动记忆内容（`~/.claude/CLAUDE.md`）
- **Project Memory**：编辑当前项目的 `CLAUDE.md`
- 支持新建、删除 Memory 文件

#### F2.6 用量统计

- 展示历史会话的 Token 消耗和费用统计
- 按日期/项目维度聚合

#### F2.7 Settings 向导

两步式配置流程：

- **Step 1 环境检测**：自动检测 Claude CLI 安装状态、认证状态、代理配置
- **Step 2 认证配置**：
  - Anthropic 官方：API Key 输入和验证
  - 国产基座兼容：自定义 Base URL + API Key + 模型名
- 底部内嵌 MiniTerminal，用于执行 `claude auth login` 等命令

---

### 2.3 Phase 3 — Agent 可视化（已完成）

#### F3.1 Sub-Agent 执行树

- 实时追踪 Agent / Task 工具调用链路
- 树状图展示父子 Agent 关系
- 每个节点显示：Agent 类型、描述、状态、耗时

#### F3.2 后台任务管理

- 追踪 `run_in_background: true` 的 Agent 任务
- 显示任务状态、开始时间、执行结果

#### F3.3 Checkpoint / Rewind（设计中）

- 在会话时间线上标记 Checkpoint
- 支持回滚到指定 Checkpoint

---

## 3. 非功能需求

### 3.1 性能

| 指标 | 目标 |
|------|------|
| 对话流延迟 | 首 Token 显示 ≤ 1s（网络正常情况） |
| 文件树加载 | 1000 个节点以内 ≤ 500ms |
| 终端响应延迟 | ≤ 50ms |
| 前端构建体积 | JS Bundle < 2MB（gzip 后） |

### 3.2 跨平台兼容性

- **操作系统**：macOS 12+、Windows 10+、Linux（Ubuntu 20.04+）
- **浏览器**：Chrome 100+、Firefox 100+、Safari 16+、Edge 100+
- **Node.js**：18.x LTS 及以上

### 3.3 安全性

| 项 | 实现方式 |
|----|----------|
| API Key 保护 | 仅存 `~/.claude/settings.json`，不写日志，不传前端 |
| 路径安全 | 文件写操作校验目标路径在项目目录内（isSubPath），拒绝目录穿越 |
| 费用控制 | `maxBudgetUsd` 限制单次任务最大费用（可在 Settings 配置） |
| 本地部署 | 后端仅监听 localhost，不对外暴露 |

### 3.4 可维护性

- TypeScript 严格模式，完整类型覆盖
- 后端分层架构（routes → services → utils）
- 前端 Zustand Store 按功能域拆分，无跨 Store 直接调用

---

## 4. 系统架构

### 4.1 整体架构

```
Browser
  │
  ├─ HTTP (REST)  ────→  Express Server (:3001)
  │                          │
  └─ WebSocket    ────→  WS Handler
                             │
                             ├─ claudeAgentService
                             │       │
                             │       └─ Claude Agent SDK → claude CLI
                             │
                             └─ PtyService → node-pty → Shell
```

### 4.2 核心数据流（对话）

```
用户输入
  → InputBar.tsx
  → wsService.send("chat", { message, sessionId, model })
  → chatHandler.ts (WebSocket)
  → claudeAgentService.query()
  → Agent SDK stream
  → dispatch events (assistant_text / tool_use_start / permission_request …)
  → wsService emit → useWebSocket.ts handler
  → chatStore.setState()
  → React re-render
```

### 4.3 权限确认流（HIL）

```
Claude SDK 触发 permission callback
  → claudeAgentService.emit("permission_request")
  → WebSocket → 前端 useWebSocket
  → chatStore.addPermissionRequest()
  → PermissionModal 弹出
  → 用户点击允许/拒绝
  → wsService.send("permission_response", { requestId, behavior })
  → chatHandler → claudeAgentService.resolvePermission()
  → SDK permission callback resolve
  → Claude 继续执行
```

### 4.4 WebSocket 事件协议

#### 前端 → 后端（action）

| action | payload | 说明 |
|--------|---------|------|
| `chat` | `{ message, sessionId?, model?, runMode?, maxBudgetUsd? }` | 发送用户消息 |
| `abort` | `{ sessionId }` | 中止当前任务 |
| `permission_response` | `{ requestId, behavior, updatedInput? }` | 响应权限请求 |
| `fork_session` | `{ fromSessionId, checkpointId? }` | 创建会话分支 |

#### 后端 → 前端（event）

| event | payload | 说明 |
|-------|---------|------|
| `session_init` | `{ sessionId, model }` | 会话初始化 |
| `assistant_text` | `{ text, isPartial }` | 文本流增量 |
| `assistant_thinking` | `{ thinking, isPartial }` | Thinking 增量 |
| `tool_use_start` | `{ toolCallId, toolName, toolInput }` | 工具调用开始 |
| `tool_input_complete` | `{ toolCallId, toolInput }` | 工具输入完整版 |
| `tool_use_result` | `{ toolCallId, result, isError }` | 工具执行结果 |
| `permission_request` | `{ requestId, toolName, toolInput, decisionReason }` | 权限请求 |
| `permission_timeout` | `{ requestId, sessionId }` | 权限超时通知 |
| `context_usage` | `{ usage }` | Token 用量更新 |
| `context_compact` | `{ compact_metadata }` | 上下文压缩事件 |
| `task_complete` | `{ costUsd, durationMs, numTurns, usage }` | 任务完成 |
| `error` | `{ code, message }` | 错误通知 |

---

## 5. REST API

### 5.1 会话管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/sessions` | 获取会话列表（按项目路径筛选） |
| GET | `/api/sessions/:id` | 获取单个会话详情 |
| DELETE | `/api/sessions/:id` | 删除会话 |

### 5.2 文件操作

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/files/tree` | 获取文件树 |
| GET | `/api/files/content` | 获取文件内容 |
| GET | `/api/files/browse` | 浏览目录（含盘符枚举） |
| POST | `/api/files/mkdir` | 创建目录（需 projectRoot 校验） |
| POST | `/api/files/create` | 创建文件（需 projectRoot 校验） |
| POST | `/api/files/rename` | 重命名（需 projectRoot 校验） |
| DELETE | `/api/files/delete` | 删除文件/目录（需 projectRoot 校验） |
| GET | `/api/files/search` | 全文搜索 |

### 5.3 MCP 管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/mcp/servers` | 列出 MCP Server |
| POST | `/api/mcp/servers` | 添加 MCP Server |
| POST | `/api/mcp/servers/json` | JSON 方式添加 |
| DELETE | `/api/mcp/servers/:name` | 删除 MCP Server |
| POST | `/api/mcp/import-desktop` | 从 Claude Desktop 导入 |

### 5.4 Memory 管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/memory` | 获取 Memory 文件列表 |
| GET | `/api/memory/:type/:name` | 读取 Memory 文件内容 |
| PUT | `/api/memory/:type/:name` | 更新 Memory 文件 |
| DELETE | `/api/memory/:type/:name` | 删除 Memory 文件 |

### 5.5 系统信息

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/system/info` | Claude 版本、平台、Git Bash 状态 |
| GET | `/api/system/auth-status` | 认证状态（installed/authenticated/authMethod） |
| POST | `/api/system/proxy-test` | 测试代理连通性 |
| POST | `/api/system/claude-test` | 完整链路测试 |
| GET | `/api/system/doctor` | 运行 claude doctor |

---

## 6. 目录结构详解

```
client/src/
├── components/
│   ├── layout/
│   │   ├── AppLayout.tsx        # 三栏布局入口（左 Sidebar + 中 Chat + 右 Panel）
│   │   ├── Sidebar.tsx          # 左栏：文件树 / 搜索 / Git（可折叠拖拽）
│   │   ├── ChatPanel.tsx        # 中栏：消息流 + 输入栏
│   │   ├── RightPanel.tsx       # 右栏：终端 / Agent 树 / 扩展
│   │   └── LearningPanel.tsx    # 学习模式侧边面板（可选）
│   ├── chat/
│   │   ├── MessageBubble.tsx    # 消息气泡（user / assistant）
│   │   ├── ToolCallCard.tsx     # 工具调用卡片
│   │   ├── InputBar.tsx         # 输入栏（模型切换 / Run Mode）
│   │   └── PermissionModal.tsx  # HIL 权限确认弹窗
│   ├── ide/
│   │   ├── FileTree.tsx         # 文件树（含创建/重命名/删除）
│   │   ├── CodeViewer.tsx       # CodeMirror 6 代码查看器
│   │   └── DiffViewer.tsx       # Diff 对比视图
│   └── manage/
│       ├── McpPanel.tsx         # MCP 管理面板
│       ├── MemoryPanel.tsx      # Memory 管理
│       ├── UsageDashboard.tsx   # 用量统计
│       └── SettingsPage.tsx     # Settings 全页向导
├── stores/
│   ├── chatStore.ts             # 消息 / 会话 / 流式状态
│   ├── uiStore.ts               # 全局 UI 状态（面板开关 / 项目路径）
│   ├── agentStore.ts            # Sub-Agent 树 / 后台任务
│   ├── memoryStore.ts           # Memory 文件状态
│   └── learningStore.ts         # 学习模式课程数据
├── hooks/
│   ├── useWebSocket.ts          # WS 事件订阅与 Store 更新
│   └── useFileTree.ts           # 文件树数据管理
└── services/
    ├── api.ts                   # REST API 封装
    └── websocket.ts             # WebSocket 服务（含指数退避重连）

server/src/
├── routes/
│   ├── files.ts                 # 文件操作 API（含路径安全校验）
│   ├── sessions.ts              # 会话管理 API
│   ├── mcp.ts                   # MCP 管理 API
│   ├── memory.ts                # Memory API
│   └── system.ts                # 系统信息 / 认证 API
├── services/
│   ├── claudeAgentService.ts    # Agent SDK 集成（核心）
│   ├── sessionManager.ts        # 会话文件读写（JSONL 解析）
│   ├── ptyService.ts            # node-pty 终端管理
│   ├── fileService.ts           # 文件树 / 搜索服务
│   ├── mcpService.ts            # MCP 配置读写
│   ├── memoryService.ts         # Memory 文件管理
│   ├── systemService.ts         # claude CLI 调用（版本/doctor/update）
│   ├── claudeSettingsService.ts # ~/.claude/settings.json 读写
│   └── claudeTestService.ts     # 全链路测试
├── websocket/
│   ├── chatHandler.ts           # 聊天 WebSocket 处理
│   └── terminalHandler.ts       # 终端 WebSocket 处理
└── utils/
    ├── pathUtils.ts             # isSubPath / normalizePath / getClaudeHome
    ├── logger.ts                # 日志工具
    └── proxyConfig.ts           # HTTP 代理配置
```

---

## 7. 已知限制与后续计划

### 7.1 当前限制

| 限制 | 说明 |
|------|------|
| 单用户 | 后端无多用户隔离，适合个人或小团队使用 |
| 本地运行 | 需要在与 Claude Code CLI 同一机器运行 |
| 无持久化 DB | 会话数据完全依赖 Claude Code CLI 的 JSONL 文件 |
| node-pty 编译 | 需要本机 C++ 环境，部分云环境/容器可能受限 |

### 7.2 后续计划

- [ ] Checkpoint / Rewind 完整实现（时间线 UI + 文件快照）
- [ ] 多项目快速切换（顶部 Project Picker）
- [ ] 图片附件上传（Base64 → Claude Vision）
- [ ] 插件系统（自定义面板 / 工具扩展）
- [ ] Docker 一键部署方案
- [ ] 国际化（i18n）支持

---

*文档最后更新：2026-03*
