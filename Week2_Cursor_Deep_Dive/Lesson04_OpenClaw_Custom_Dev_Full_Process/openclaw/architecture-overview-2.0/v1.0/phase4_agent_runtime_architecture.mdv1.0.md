# Phase 4：Agent Runtime 架构说明 v1.0（基于最新源码）

## 0. 目标与范围
本文聚焦 OpenClaw 第四层：`Agent Runtime`。  
目标是基于当前仓库最新实现，系统梳理以下内容：

1. 运行主链路与生命周期阶段
2. 新版模型认证、限流冷却、故障切换
3. 工具体系与策略治理管线
4. 会话隔离、会话生命周期与 Gateway 协议变化
5. 子代理（Subagent）与 Memory 体系的新能力

---

## 1. 当前 Runtime 总体架构
当前 OpenClaw 的 Runtime 已形成“接入层 + 编排层 + 执行层 + 能力层”的稳定分层：

1. 接入层（Gateway/CLI）
- `src/gateway/server-methods/agent.ts`
- `src/gateway/server-methods/chat.ts`
- `src/commands/agent.ts`

2. 编排层（Reply Runner）
- `src/auto-reply/reply/agent-runner.ts`
- `src/auto-reply/reply/agent-runner-execution.ts`

3. 执行层（Embedded Runner）
- `src/agents/pi-embedded-runner/run.ts`
- `src/agents/pi-embedded-runner/run/attempt.ts`

4. 能力层（模型/工具/记忆/子代理/会话）
- 模型：`src/agents/model-auth.ts`、`src/agents/model-fallback.ts`、`src/agents/models-config*.ts`
- 工具：`src/agents/pi-tools.ts`、`src/agents/openclaw-tools.ts`、`src/plugins/tools.ts`
- Memory：`src/memory/*`、`src/agents/tools/memory-tool.ts`、`extensions/memory-*`
- 子代理：`src/agents/subagent-*.ts`、`src/agents/tools/subagents-tool.ts`
- 会话：`src/routing/*`、`src/config/sessions/*`、`src/gateway/server-methods/sessions.ts`

---

## 2. 运行主链路（最新版）
核心调用链（从请求到模型执行）：

`agent/chat.send`  
-> `server-methods/agent.ts` 或 `server-methods/chat.ts`  
-> `agent-runner.ts` / `runAgentTurnWithFallback(...)`  
-> `runEmbeddedPiAgent(...)`  
-> `runEmbeddedAttempt(...)`  
-> `createAgentSession + streamSimple`（`pi-coding-agent/pi-ai`）

其中 `runEmbeddedPiAgent` 负责“回合级调度与重试策略”，`runEmbeddedAttempt` 负责“单次尝试的 prompt/工具/会话组装与执行”。

---

## 3. 相比旧版的关键变化（重点）

## 3.1 Hook 生命周期拆分更清晰
旧版主要依赖 `before_agent_start`。新版已明确拆分两个阶段：

1. `before_model_resolve`
- 运行在模型解析前，允许插件覆盖 `provider/model`
- 实现位置：`run.ts`

2. `before_prompt_build`
- 运行在 prompt 构建前，允许追加上下文/系统提示
- 实现位置：`attempt.ts`

同时保留 `before_agent_start` 作为兼容回退路径（legacy fallback），确保旧插件不立即失效。

## 3.2 队列并发模型升级为“双队列”
新版 `runEmbeddedPiAgent` 采用双层排队：

1. 会话队列（session lane）
- `resolveSessionLane(...)`
- 保证同一会话串行，避免 transcript 与上下文冲突

2. 全局队列（global lane）
- `resolveGlobalLane(...)`
- 控制系统级并发，降低资源竞争和过载风险

入队通过 `enqueueCommandInLane(...)` 执行。

## 3.3 上下文溢出恢复链路更完整
新版在上下文溢出场景新增多级恢复：

1. 尝试内自动压缩（SDK compaction）
2. 显式会话压缩 `compactEmbeddedPiSessionDirect(...)`
3. 大工具结果截断 `truncateOversizedToolResultsInSession(...)`
4. 仍失败才升级为 failover/错误返回

这比旧版“失败即返回”的策略更鲁棒，尤其适合工具回合较多的长会话。

## 3.4 工具调用协议增加 `tool_calls` 停止语义
当存在客户端托管工具调用时，运行结果可返回：

1. `stopReason: "tool_calls"`
2. `pendingToolCalls`

用于驱动外部客户端继续执行工具调用回路（而非直接结束回答）。

## 3.5 Agent RPC 变更为“先 accepted，再 final”
`server-methods/agent.ts` 现在先返回：

1. accepted 帧（避免重试造成重复启动）
2. 后续 ok/error final 帧（同 runId）

配合 `idempotencyKey` + `dedupe`，提升网络抖动场景下的一致性与幂等性。

---

## 4. 模型/认证/Failover（最新版）

## 4.1 认证模式
`model-auth.ts` 现支持：

1. `api-key`
2. `oauth`
3. `token`
4. `aws-sdk`
5. `mixed`

并扩展了大量 provider 的环境变量映射与 profile 优先级解析。

## 4.2 冷却与故障切换闭环
`run.ts` + `model-fallback.ts` + `auth-profiles` 形成闭环：

1. profile 按优先级尝试
2. 失败按原因分类（auth/rate_limit/billing/timeout/context 等）
3. 写入 profile 冷却窗口
4. 自动切 profile / 切模型候选继续尝试

新增“主模型冷却探测节流”和“候选模型去重+显式 fallback 保留”逻辑，减少抖动。

## 4.3 上下文窗口防线
在模型解析后增加 `evaluateContextWindowGuard(...)`：

1. `warn`：低于告警阈值仅告警
2. `block`：低于硬阈值直接阻断并触发 failover

防止错误模型配置导致运行时无意义重试。

---

## 5. 工具体系与策略管线

## 5.1 三层工具结构保持，但治理更强
仍是三层组合：

1. Coding tools（底层执行）
2. OpenClaw tools（平台能力）
3. Plugin tools（扩展能力）

关键变化是策略治理显著增强。

## 5.2 策略管线化
新版 `pi-tools.ts` + `tool-policy-pipeline.ts` 将工具可见性从“配置判断”升级为“可组合管线”：

1. profile policy
2. provider profile policy
3. global policy
4. agent policy
5. group policy
6. sandbox policy
7. subagent policy

并叠加：

1. `owner-only` 限制
2. `group:plugins`/allowlist 插件组控制
3. 插件工具冲突检测（同名冲突即拒绝）

## 5.3 Hook 介入工具调用
Hook 体系已覆盖工具调用前后：

1. `before_tool_call`
2. `after_tool_call`
3. `tool_result_persist`

可实现拦截、审计、结果改写、持久化策略注入。

---

## 6. 会话与协议层变化

## 6.1 SessionKey 语义加强
`session-key.ts` 现在对 DM scope 支持更完整：

1. `main`
2. `per-peer`
3. `per-channel-peer`
4. `per-account-channel-peer`

并支持 thread/topic 后缀（如 `:thread:`），使会话隔离粒度更细。

## 6.2 路由决策更细粒度
`resolve-route.ts` 引入多层级匹配：

1. peer 精确匹配
2. parent peer 继承（线程父级）
3. guild + roles
4. guild / team
5. account / channel
6. default

输出稳定包含 `agentId`、`sessionKey`、`mainSessionKey`。

## 6.3 Session RPC 生命周期更完整
`server-methods/sessions.ts` 覆盖：

1. `sessions.list/preview/resolve/patch`
2. `sessions.reset/delete/compact`

并在 reset/delete 时执行运行态清理：

1. 终止活跃 run
2. 清理会话队列
3. 处理子代理收尾
4. transcript 归档

---

## 7. Agent/Chat 事件总线与可观测性

## 7.1 运行上下文注册
`registerAgentRunContext(...)` 将 `runId` 与 `sessionKey` 等上下文绑定，供事件广播和工具事件过滤使用。

## 7.2 事件桥接增强
`server-chat.ts` 将 agent 流映射为 chat 流，并支持：

1. 工具事件按订阅 recipient 定向分发
2. heartbeat 噪声在交互界面侧抑制
3. verbose 模式差异化输出

## 7.3 chat.* 协议增强
`server-methods/chat.ts` 已支持：

1. `chat.send` 控制字符清理
2. `chat.abort` 中断并持久化 partial
3. `chat.inject` 注入 assistant 消息
4. `chat.history` 字节/长度上限与过大占位处理

---

## 8. 子代理 Runtime（新增能力核心）

## 8.1 生成模式
`subagent-spawn.ts` 支持：

1. `run` 模式：执行后可清理
2. `session` 模式：线程绑定持续会话

并支持 model/thinking/runTimeout 覆盖。

## 8.2 安全与配额控制
生成前执行：

1. 深度限制（`maxSpawnDepth`）
2. 每会话并发子代理数限制（`maxChildrenPerAgent`）
3. agent allowlist 检查
4. thread binding hook 检查（无 hook 则拒绝 session 模式）

## 8.3 注册表与恢复
`subagent-registry.ts` 提供：

1. 运行中子代理注册
2. 重启后的磁盘恢复
3. announce 重试与过期清理
4. ended hook 一次性触发保障
5. steer 重启场景的通知抑制

`subagents-tool.ts` 提供 `list/kill/steer` 并支持级联终止子树。

---

## 9. Memory 架构（最新版）

## 9.1 管理器选择策略
`search-manager.ts` 采用：

1. QMD manager 优先
2. 失败自动降级 builtin index manager

且对失败实例做缓存驱逐，下一次可重新探测 QMD。

## 9.2 Builtin Memory Index 能力增强
`manager.ts` 支持：

1. hybrid/vector/FTS 组合查询
2. query keyword expansion
3. watcher + interval + session-start/sync 触发机制
4. embedding provider fallback 与状态回传

## 9.3 Agent Tool 层可用性治理
`memory-tool.ts` 中：

1. `memory_search`/`memory_get` 在不可用时返回 `disabled/unavailable` 结构
2. citation 支持 `on/off/auto`
3. `auto` 默认直聊开启、群聊抑制

---

## 10. 与旧版文档对齐时应更新的结论

1. Hook 设计已从单阶段转向“模型阶段+Prompt阶段”的双阶段，`before_agent_start` 仅兼容。
2. Runtime 已形成“会话队列 + 全局队列”双队列并发控制。
3. 上下文溢出恢复不再只有 compaction，新增工具结果截断兜底链路。
4. Agent RPC 已采用 accepted/final 双响应模型，幂等语义更强。
5. 会话管理已具备 reset/delete 全链路清理（run/queue/subagent/transcript）。
6. 子代理已是完整子系统（spawn/registry/tool/cleanup/hook），不是轻量附属功能。
7. Memory 已形成“QMD 优先 + builtin fallback + tool 级不可用语义”的可降级架构。

---

## 11. 关键源码索引（建议从这里继续深入）

- 执行主链
  - `src/agents/pi-embedded-runner/run.ts`
  - `src/agents/pi-embedded-runner/run/attempt.ts`
- 编排层
  - `src/auto-reply/reply/agent-runner.ts`
  - `src/auto-reply/reply/agent-runner-execution.ts`
- Gateway Agent/Chat
  - `src/gateway/server-methods/agent.ts`
  - `src/gateway/server-methods/chat.ts`
  - `src/gateway/server-chat.ts`
- 协议
  - `src/gateway/protocol/schema/agent.ts`
  - `src/gateway/protocol/schema/logs-chat.ts`
- 模型与认证
  - `src/agents/model-auth.ts`
  - `src/agents/model-fallback.ts`
  - `src/agents/models-config.ts`
  - `src/agents/models-config.providers.ts`
- 工具与策略
  - `src/agents/pi-tools.ts`
  - `src/agents/tool-policy-pipeline.ts`
  - `src/agents/openclaw-tools.ts`
  - `src/plugins/tools.ts`
- 会话与路由
  - `src/routing/session-key.ts`
  - `src/routing/resolve-route.ts`
  - `src/gateway/server-methods/sessions.ts`
- 子代理
  - `src/agents/subagent-spawn.ts`
  - `src/agents/subagent-registry.ts`
  - `src/agents/tools/subagents-tool.ts`
- Memory
  - `src/memory/search-manager.ts`
  - `src/memory/manager.ts`
  - `src/agents/tools/memory-tool.ts`
  - `extensions/memory-core/index.ts`
  - `extensions/memory-lancedb/index.ts`
