# Phase 4：Agent 运行时架构设计（源码解构）

## 0. 范围与结论

本文聚焦你定义的第四层：**Agent Runtime**。  
分析目标是从源码确认以下五件事：

1. 底层运行时框架（基于 `pi-agent-core` / `pi-coding-agent`）如何落地。
2. 多模型供应商能力（含 OAuth、Failover、Rate Limit / Cooldown）如何实现。
3. 工具三层架构（Coding / OpenClaw / Plugin）如何组合与治理。
4. 记忆系统（短期 Transcript + 长期向量记忆）如何接入。
5. 会话隔离（`sessionKey`）与完整生命周期管理如何实现。

核心结论：

- Agent Runtime 在当前仓库中是一个**可复用、分层清晰**的后端能力层，主入口集中在 `src/agents/pi-embedded*` 与 `src/auto-reply/reply/*`。
- 运行时通过统一的 Gateway 协议面（`agent` / `chat.send` + `agent/chat` 事件）被 WebUI、macOS、移动端等客户端复用。
- 模型层、工具层、记忆层都采用“核心能力 + 配置策略 + 插件扩展”的组合模式。
- `sessionKey` 是跨模块的隔离主键，直接影响路由、并发队列、会话存储、记忆召回与事件分发。

---

## 1. 总体架构与调用主链

## 1.1 顶层分层（逻辑视图）

1. 接入层（Gateway/CLI）
   - `src/gateway/server-methods/agent.ts`
   - `src/gateway/server-methods/chat.ts`
   - `src/commands/agent.ts`
2. 编排层（Auto Reply / Agent Runner）
   - `src/auto-reply/reply/agent-runner.ts`
   - `src/auto-reply/reply/agent-runner-execution.ts`
3. Agent Runtime 核心层（Embedded Runner）
   - `src/agents/pi-embedded.ts`
   - `src/agents/pi-embedded-runner.ts`
   - `src/agents/pi-embedded-runner/run.ts`
   - `src/agents/pi-embedded-runner/run/attempt.ts`
4. 能力子系统层
   - 模型：`src/agents/model-*.ts`、`src/agents/models-config*.ts`
   - 工具：`src/agents/pi-tools.ts`、`src/agents/openclaw-tools.ts`、`src/plugins/tools.ts`
   - 记忆：`src/memory/*`、`src/agents/tools/memory-tool.ts`、`extensions/memory-*`
   - 会话：`src/routing/*`、`src/config/sessions/*`

## 1.2 主调用链（从请求到模型执行）

客户端调用 `agent`/`chat.send`
-> `src/gateway/server-methods/agent.ts` 或 `src/gateway/server-methods/chat.ts`
-> `src/auto-reply/dispatch.ts` / `src/auto-reply/reply/*`
-> `runAgentTurnWithFallback`（`src/auto-reply/reply/agent-runner-execution.ts`）
-> `runEmbeddedPiAgent`（`src/agents/pi-embedded-runner/run.ts`）
-> `runEmbeddedAttempt`（`src/agents/pi-embedded-runner/run/attempt.ts`）
-> `createAgentSession + streamSimple`（`@mariozechner/pi-coding-agent` / `@mariozechner/pi-ai`）

---

## 2. 底层运行时：pi-agent-core / pi-coding-agent 落地方式

## 2.1 运行时入口与封装边界

- 对外入口：
  - `src/agents/pi-embedded.ts`
  - `src/agents/pi-embedded-runner.ts`
- 实际执行入口：
  - `runEmbeddedPiAgent` in `src/agents/pi-embedded-runner/run.ts`
  - `runEmbeddedAttempt` in `src/agents/pi-embedded-runner/run/attempt.ts`

这里的设计思路是：  
OpenClaw 不直接把调用方暴露给 `pi-coding-agent`，而是先经过自身的策略层（会话、模型、工具、路由、事件、记忆、风控）再进入底层 SDK。

## 2.2 并发与队列模型

`runEmbeddedPiAgent` 使用“双队列”策略：

- session lane：`resolveSessionLane`（`src/agents/pi-embedded-runner/lanes.ts`）
- global lane：`resolveGlobalLane`（同文件）
- 入队执行：`enqueueCommandInLane`（`src/process/command-queue.js`）

意义：

- 同一会话串行，避免上下文写冲突。
- 全局可控并发，避免模型调用、工具执行失控。

## 2.3 SDK 会话装配

`runEmbeddedAttempt` 中关键装配点：

- `SessionManager.open(...)`：会话 transcript 管理
- `SettingsManager.create(...)`：运行参数管理
- `createAgentSession(...)`：创建底层 Agent Session
- `activeSession.agent.streamFn = streamSimple`：绑定流式执行函数

对应文件：`src/agents/pi-embedded-runner/run/attempt.ts`。

## 2.4 事件流与生命周期 hook

- 流式订阅：`subscribeEmbeddedPiSession`（`src/agents/pi-embedded-subscribe.ts`）
- 生命周期 hook：
  - `before_agent_start`
  - `agent_end`
  - 调用位置：`src/agents/pi-embedded-runner/run/attempt.ts`

这让插件能够在模型调用前后注入/采集上下文，不侵入主运行链。

---

## 3. 模型系统：供应商、认证、Failover、Rate Limit

## 3.1 供应商模型注册与隐式注入

模型配置核心在：

- `src/agents/models-config.ts`
- `src/agents/models-config.providers.ts`

当前源码可见的隐式 provider 注入包含（非穷举）：

- `minimax`
- `minimax-portal`
- `moonshot`
- `synthetic`
- `venice`
- `qwen-portal`
- `xiaomi`
- `cloudflare-ai-gateway`
- `ollama`
- `together`
- `qianfan`
- `github-copilot`（隐式注入逻辑）
- `amazon-bedrock`（隐式发现逻辑）

此外通过 `ensureOpenClawModelsJson` 在运行前合并显式配置与隐式能力。

## 3.2 认证模式（含 OAuth）

认证核心文件：`src/agents/model-auth.ts`。  
支持模式：

- `api-key`
- `oauth`
- `token`
- `aws-sdk`
- `mixed`

认证来源按优先级组合：

1. 指定 auth profile
2. provider profile 顺序
3. 环境变量
4. models.json
5. AWS 默认链路（bedrock）

## 3.3 Failover 机制

核心文件：

- `src/agents/model-fallback.ts`
- `src/agents/failover-error.ts`
- `src/agents/pi-embedded-runner/run.ts`

机制要点：

1. 构造候选模型列表（主模型 + fallbacks）。
2. 逐个尝试运行，失败则记录原因。
3. 当 provider 下所有 profile 进入 cooldown 时，会跳过该候选。
4. 通过 `FailoverError` 归一失败原因（`billing`/`rate_limit`/`auth`/`timeout`/`format`/`unknown`）。

## 3.4 限流与账号冷却（Rate Limit / Billing）

核心文件：`src/agents/auth-profiles/usage.ts`。

- `isProfileInCooldown(...)`
- `markAuthProfileFailure(...)`
- `markAuthProfileUsed(...)`
- 指数退避冷却策略
- billing 失败采用更长禁用窗口（`disabledUntil`）

这部分与 failover 形成闭环：先尝试 profile 轮换，再模型降级。

---

## 4. 工具系统：三层架构与策略治理

## 4.1 第一层：Coding Tools（底层编码工具）

核心文件：`src/agents/pi-tools.ts`。

由 `@mariozechner/pi-coding-agent` 的 `codingTools` 作为基础，结合 OpenClaw 包装注入：

- `exec`
- `process`
- `read/write/edit`
- `apply_patch`
- sandbox 变体（只读/可写分流）

## 4.2 第二层：OpenClaw Tools（平台能力工具）

核心文件：`src/agents/openclaw-tools.ts`。

包含平台级工具（示例）：

- browser / canvas
- nodes / gateway
- message / tts
- cron
- sessions（list/history/send/spawn/status）
- web_search / web_fetch / image

## 4.3 第三层：Plugin Tools（扩展工具）

核心文件：`src/plugins/tools.ts`。

`resolvePluginTools(...)` 负责：

- 加载插件工具
- 可选工具 allowlist 控制
- 与核心工具冲突检测
- 插件工具元信息挂载（pluginId / optional）

## 4.4 工具策略治理（关键差异化能力）

`src/agents/pi-tools.ts` 会把工具策略按层叠加：

- profile policy
- provider profile policy
- global policy
- global by-provider policy
- agent policy
- agent by-provider policy
- group policy
- sandbox policy
- subagent policy

再叠加：

- owner-only 过滤
- before-tool-call hook 包装
- abort signal 包装

这意味着工具系统并非“静态清单”，而是**动态可裁剪的策略化工具面**。

## 4.5 与 MCP 的源码边界（按仓内证据）

你给的目标里提到 “支持 MCP”。从当前仓内代码可直接确认的是：

- ACP 协议层声明了 `mcpCapabilities`，但 `mcpServers` 当前在 translator 中被显式忽略：
  - `src/acp/translator.ts`
- `--strict-mcp-config` / `--mcp-config` 主要出现在 CLI backend live test：
  - `src/gateway/gateway-cli-backend.live.test.ts`

因此高置信结论是：  
**MCP 的主要实现路径更可能在外部 CLI/runtime 侧，仓内可见部分更多是能力声明与参数透传/测试验证，而非完整内核实现。**

---

## 5. 记忆系统：短期 Transcript + 长期向量记忆

## 5.1 短期记忆（Session Transcript）

核心模块：

- 路径与存储：`src/config/sessions/paths.ts`、`src/config/sessions/store.ts`
- transcript 追加：`src/config/sessions/transcript.ts`
- 更新事件：`src/sessions/transcript-events.ts`
- 执行链使用：`src/auto-reply/reply/agent-runner.ts`

短期记忆本质上是会话级 JSONL transcript，和 `sessionId/sessionKey` 强绑定。

## 5.2 结构化检索记忆（memory_search / memory_get）

工具定义：

- `src/agents/tools/memory-tool.ts`

检索管理：

- `src/agents/memory-search.ts`
- `src/memory/search-manager.ts`
- `src/memory/manager.ts`

要点：

- 支持 memory 文件与 session transcript 作为源。
- `search-manager` 支持 qmd 优先、builtin fallback。
- `MemoryIndexManager` 支持增量同步、watch、warmSession。

## 5.3 长期记忆插件（LanceDB）

核心插件：

- `extensions/memory-core/index.ts`（核心 memory 工具注册）
- `extensions/memory-lancedb/index.ts`（向量长期记忆）

`memory-lancedb` 在生命周期上的集成方式：

- `before_agent_start`：自动召回并 prepend context
- `agent_end`：自动捕获并写入向量库
- 工具面：`memory_recall` / `memory_store` / `memory_forget`

---

## 6. 会话隔离与生命周期：sessionKey 驱动

## 6.1 sessionKey 规范与生成

核心文件：`src/routing/session-key.ts`、`src/sessions/session-key-utils.ts`。

关键机制：

- 规范形态：`agent:{agentId}:{rest}`
- DM 作用域：`main` / `per-peer` / `per-channel-peer` / `per-account-channel-peer`
- thread/topic 后缀支持：`:thread:{id}` 等

## 6.2 路由到 Agent 与会话

核心文件：`src/routing/resolve-route.ts`。

路由优先级（简化）：

1. peer 精确绑定
2. parent peer 继承
3. guild/team
4. account/channel
5. default

输出包含：

- `agentId`
- `sessionKey`
- `mainSessionKey`

## 6.3 会话实体与持久化

核心文件：

- `src/config/sessions/types.ts`（`SessionEntry`）
- `src/config/sessions/store.ts`（读写、缓存、维护）
- `src/config/sessions/main-session.ts`（main/global 归一）

`SessionEntry` 除基础字段外，还持久化模型覆盖、工具/队列/usage/上下文信息，支撑完整生命周期。

## 6.4 Gateway 生命周期接口

统一会话管理 RPC：

- `sessions.list`
- `sessions.preview`
- `sessions.resolve`
- `sessions.patch`
- `sessions.reset`
- `sessions.delete`
- `sessions.compact`

实现文件：`src/gateway/server-methods/sessions.ts`。

## 6.5 运行事件生命周期

运行时事件桥：

- `src/infra/agent-events.ts`
- `src/agents/pi-embedded-subscribe.ts`
- `src/gateway/server-chat.ts`
- 协议 schema：`src/gateway/protocol/schema/agent.ts`、`src/gateway/protocol/schema/logs-chat.ts`

形成 `runId + seq + sessionKey` 的可追踪事件流（delta/final/error/tool/lifecycle）。

---

## 7. 对接新客户端或二次开发时的技术关注点

## 7.1 若复用现有 Gateway + Agent Runtime（推荐路径）

新客户端只需稳定对接：

1. 输入接口：
   - `agent`（`src/gateway/protocol/schema/agent.ts`）
   - `chat.send`（`src/gateway/protocol/schema/logs-chat.ts`）
2. 输出事件：
   - `agent` 事件流
   - `chat` 事件流
3. 会话标识：
   - 必须显式管理 `sessionKey`，否则会影响上下文隔离与记忆召回。

## 7.2 新增模型/鉴权策略

应优先扩展：

- `src/agents/models-config.providers.ts`
- `src/agents/model-auth.ts`
- `src/agents/model-fallback.ts`
- `src/agents/auth-profiles/usage.ts`

并确保：

- auth mode 可判定
- cooldown 与 failover 路径完整
- provider/model alias 能被 `model-selection` 解析

## 7.3 新增工具/插件

应遵循三层工具体系：

1. Coding 层：`src/agents/pi-tools.ts`
2. OpenClaw 层：`src/agents/openclaw-tools.ts`
3. Plugin 层：`src/plugins/tools.ts`

并落实策略治理（allow/deny、group、sandbox、subagent）而不是直接硬编码工具可见性。

## 7.4 新增记忆后端

建议以插件形式接入（参考 `extensions/memory-lancedb`），通过：

- tool API（store/recall/forget）
- lifecycle hooks（before_agent_start/agent_end）

避免侵入 `run.ts` 主执行链。

---

## 8. 关键源码索引（便于后续深入）

- Agent Runtime 入口：
  - `src/agents/pi-embedded.ts`
  - `src/agents/pi-embedded-runner.ts`
- 执行主链：
  - `src/agents/pi-embedded-runner/run.ts`
  - `src/agents/pi-embedded-runner/run/attempt.ts`
- 模型与认证：
  - `src/agents/models-config.ts`
  - `src/agents/models-config.providers.ts`
  - `src/agents/model-auth.ts`
  - `src/agents/model-fallback.ts`
  - `src/agents/auth-profiles/usage.ts`
- 工具系统：
  - `src/agents/pi-tools.ts`
  - `src/agents/openclaw-tools.ts`
  - `src/plugins/tools.ts`
- 记忆系统：
  - `src/agents/tools/memory-tool.ts`
  - `src/memory/search-manager.ts`
  - `src/memory/manager.ts`
  - `extensions/memory-core/index.ts`
  - `extensions/memory-lancedb/index.ts`
- 会话与路由：
  - `src/routing/session-key.ts`
  - `src/routing/resolve-route.ts`
  - `src/config/sessions/types.ts`
  - `src/gateway/server-methods/sessions.ts`
- Agent/Chat 对外协议：
  - `src/gateway/protocol/schema/agent.ts`
  - `src/gateway/protocol/schema/logs-chat.ts`
  - `src/gateway/protocol/schema/frames.ts`
  - `src/gateway/server-methods-list.ts`

