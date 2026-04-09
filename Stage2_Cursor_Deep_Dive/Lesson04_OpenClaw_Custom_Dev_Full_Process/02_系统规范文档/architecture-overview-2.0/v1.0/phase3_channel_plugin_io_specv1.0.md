# Phase 3：Plugins / Channels 统一输入输出规范（v1.0，源码版）

## 0. 文档目标

本文基于当前 OpenClaw 最新源码，重写 Phase 3 规范，聚焦：

- Plugins 与 Channels 的最新注册/加载/运行时架构
- Inbound / Outbound 的统一 I/O 契约
- Gateway 对 Channel 的复用边界与调用链路
- 相比旧版规范的关键改动与新增能力
- 新增 Channel/Plugin 的落地开发清单

适用对象：渠道插件开发者、Gateway 开发者、协议接入开发者。

---

## 1. 结论先行（最新状态）

1. **Channel 已完全纳入 Plugin Registry 统一治理**，由 `src/plugins/loader.ts` + `src/plugins/registry.ts` 负责发现、验配、注册、诊断。  
2. **Inbound 仍是“事实标准契约”**（`MsgContext` + `finalizeInboundContext` + dispatch），但字段语义与安全默认值明显增强（尤其 `CommandAuthorized` 默认拒绝）。  
3. **Outbound 已是稳定强契约**（`ChannelOutboundAdapter`），并由 `resolveOutboundTarget` + `deliverOutboundPayloads` 统一承载发信、分块、hook、队列与镜像写回。  
4. **Channel 运行时管理升级**：`server-channels` + `channel-health-monitor` 提供按账号启动/停止、自动重启回退、手工停止保护、健康巡检。  
5. 相比旧版，当前规范从“接口定义”升级为“**注册治理 + 生命周期治理 + 安全默认策略**”的完整体系。

---

## 2. 最新架构分层（Phase 3 视角）

## 2.1 插件发现与加载层

核心文件：

- `src/plugins/discovery.ts`
- `src/plugins/manifest-registry.ts`
- `src/plugins/loader.ts`
- `src/plugins/config-state.ts`
- `src/plugins/runtime.ts`

关键机制：

- 发现来源：`workspace/global/bundled/config paths`。
- 配置治理：`plugins.enabled/allow/deny/load.paths/entries/slots.memory`。
- 安全诊断：
  - allowlist 为空且发现非 bundled 插件会告警。
  - 记录 provenance（install/load-path）不完整会告警。
- 校验：manifest config schema + 实际 `entries.<id>.config` JSON schema 验证。
- 缓存：按 `workspaceDir + normalized plugins config` 缓存 registry。
- 激活：`setActivePluginRegistry()` 写入全局活动注册表。

## 2.2 插件注册表层（统一扩展入口）

核心文件：`src/plugins/registry.ts`、`src/plugins/types.ts`

当前 `PluginRegistry` 关键集合：

- `tools`
- `hooks`（legacy internal hooks）
- `typedHooks`（`api.on(...)` 生命周期钩子）
- `channels`
- `providers`
- `gatewayHandlers`
- `httpHandlers` + `httpRoutes`
- `cliRegistrars`
- `services`
- `commands`
- `diagnostics`

关键约束：

- `registerGatewayMethod`：禁止覆盖 core gateway methods。
- `registerHttpRoute`：path 规范化并去重冲突检查。
- `registerChannel`：支持 `ChannelPlugin` 直传或 `{ plugin, dock }` 包装注册。
- `registerCommand`：纳入 plugin command 系统做去重/校验。

## 2.3 Channel 插件契约层

核心文件：

- `src/channels/plugins/types.plugin.ts`
- `src/channels/plugins/types.adapters.ts`
- `src/channels/plugins/types.core.ts`
- `src/channels/plugins/onboarding-types.ts`

`ChannelPlugin` 已从旧版的“基础 adapter 集合”扩展为完整能力面：

- 基础：`id/meta/capabilities/config`
- 生命周期：`gateway/start/stop/login/logout`
- I/O：`outbound/status`
- 运维：`setup/onboarding/security/pairing`
- 路由：`directory/resolver/messaging/threading`
- 扩展：`commands/streaming/actions/heartbeat/agentTools/agentPrompt`
- 治理：`reload/defaults/configSchema/gatewayMethods`

## 2.4 Gateway 复用层

核心文件：

- `src/gateway/server-channels.ts`
- `src/gateway/channel-health-monitor.ts`
- `src/gateway/server-methods/channels.ts`
- `src/gateway/server-methods/send.ts`

职责：

- 管理 channel account 生命周期（运行态快照、启动/停止、重启）。
- 暴露统一 RPC：`channels.status`、`channels.logout`、`send`、`poll`。
- 将平台差异下沉到 `ChannelPlugin` adapters，不污染 Gateway 主干。

## 2.5 Outbound 基础设施层

核心文件：

- `src/infra/outbound/targets.ts`
- `src/infra/outbound/deliver.ts`
- `src/channels/plugins/outbound/load.ts`

职责：

- 统一 target 解析（显式/隐式/heartbeat）。
- 统一 payload 投递、分块、队列、hook、镜像 transcript。
- 通过轻量 loader 按需加载 `plugin.outbound`，降低核心链路耦合。

## 2.6 Inbound 上下文归一化层

核心文件：

- `src/auto-reply/templating.ts`
- `src/auto-reply/reply/inbound-context.ts`
- `src/auto-reply/dispatch.ts`

职责：

- 承载统一消息上下文模型 `MsgContext`。
- 归一化文本、媒体、会话字段并补齐默认值。
- 将各 Channel 输入统一汇入 reply/agent 流程。

---

## 3. Channel/Plugin 注册与运行时链路（端到端）

1. `discoverOpenClawPlugins` 扫描候选插件。  
2. `loadPluginManifestRegistry` 建立 manifest 视图并做基础校验。  
3. `loadOpenClawPlugins`：
   - 评估 allow/deny/entries/slots
   - 校验 config schema
   - `register(api)` 执行注册
   - 产出 `PluginRegistry` + `diagnostics`
4. `setActivePluginRegistry` 激活 registry。  
5. `listChannelPlugins` 从活动 registry 读取 channels，去重并按 `meta.order` 排序。  
6. Gateway 启动阶段通过 `startChannels` -> `plugin.gateway.startAccount` 拉起运行。  
7. 运行期间 health monitor 按快照巡检并触发受控重启。

---

## 4. Inbound 统一 I/O 契约（最新）

## 4.1 事实标准入口

虽然仍无独立 `ChannelInboundAdapter` 类型，但当前统一入口已固定为：

1. Channel 侧将外部事件映射为 `MsgContext`。  
2. 调用 `finalizeInboundContext(ctx)` 做归一化。  
3. 进入 dispatch/reply 主流程。

## 4.2 `MsgContext` 关键字段（最新）

核心必备建议：

- `Body` / `BodyForAgent` / `BodyForCommands`
- `From` / `To`
- `SessionKey` / `AccountId`
- `OriginatingChannel` / `OriginatingTo`
- `ChatType`
- `CommandAuthorized`

高价值增强字段：

- `SenderId/SenderName/SenderUsername/SenderE164`
- `MessageSid/ReplyToId/MessageThreadId`
- `MediaPath/MediaUrl/MediaPaths/MediaUrls/MediaType/MediaTypes`
- `ConversationLabel/WasMentioned/UntrustedContext`

## 4.3 `finalizeInboundContext` 最新规范行为

关键标准化动作：

- 统一换行与文本字段规范化（Body/RawBody/CommandBody 等）。
- 自动回填 `BodyForAgent`、`BodyForCommands`。
- `ChatType` 规范化。
- `ConversationLabel` 兜底解析。
- `MediaType` 与 `MediaTypes` 对齐补齐。
- **安全默认：`CommandAuthorized` 强制布尔化，缺失即 `false`（default-deny）**。

---

## 5. Outbound 统一 I/O 契约（最新）

## 5.1 `ChannelOutboundAdapter` 标准面

- 必需：`sendText`、`sendMedia`
- 可选：`sendPayload`、`sendPoll`、`resolveTarget`
- 发送模式：`deliveryMode = direct | gateway | hybrid`
- 文本能力：`chunker/chunkerMode/textChunkLimit`
- poll 能力：`pollMaxOptions`

## 5.2 标准调用链路

1. Gateway `send/poll` 参数校验与幂等去重。  
2. `resolveOutboundTarget` 解析目标：
   - 优先 `plugin.outbound.resolveTarget`
   - 否则使用 `to` 或 `config.resolveDefaultTo`
3. `deliverOutboundPayloads` 执行投递：
   - 队列写前日志（enqueue/ack/fail）
   - 分块发送（含 markdown/newline 模式）
   - plugin hooks：`message_sending` / `message_sent`
   - 可选镜像写回 session transcript

## 5.3 当前关键约束

- Channel 未实现 `sendText/sendMedia` 会被视为不可投递。
- `send` 显式拒绝 `webchat`（internal-only，需走 `chat.send`）。
- `poll` 由 `outbound.sendPoll` 决定能力，未实现即不支持。

---

## 6. Gateway 与 Channel 生命周期契约

核心由 `createChannelManager` 管理：

- 按 channel/account 启停
- 运行态快照维护（`running/connected/lastError/lastStartAt/...`）
- 崩溃后指数退避自动重启（上限 10 次）
- 手工 stop 标记，避免被自动拉起
- `channels.logout` 后 runtime 状态标记 logged out

健康巡检 `channel-health-monitor` 提供：

- 启动宽限期
- 巡检周期
- 冷却窗口
- 每小时最大重启次数限制

---

## 7. 相比旧版 Phase3 文档的关键改动

1. **插件注册表能力扩展明显**：不仅有 channel，还统一纳管 typed hooks、http routes、commands、services、providers。  
2. **插件加载治理增强**：allowlist 开放告警、provenance 追踪、schema 校验、memory slot 决策、registry 缓存。  
3. **ChannelPlugin 契约面大幅扩展**：新增 onboarding/configSchema/reload/actions/heartbeat/agentTools 等。  
4. **Outbound 基础设施成熟**：统一队列、分块策略、message hooks、镜像 transcript 回写。  
5. **Inbound 安全语义增强**：`CommandAuthorized` 明确 default-deny。  
6. **运行时稳定性提升**：Channel manager + health monitor 提供自动恢复与防抖治理。  
7. **Gateway 侧方法细化**：`channels.status` 支持 probe/audit 聚合快照，`send/poll` 内置幂等与目标解析规范。

---

## 8. 新增 Channel/Plugin 开发清单（v1.0）

## 8.1 最小可运行（P0）

1. 提供 `openclaw.plugin.json`（含 id/configSchema）。  
2. 在 `register(api)` 中执行 `api.registerChannel(...)`。  
3. 实现 `plugin.config`：`listAccountIds`、`resolveAccount`。  
4. 实现 `plugin.gateway.startAccount`（拉起 inbound 监听）。  
5. 实现 `plugin.outbound.sendText/sendMedia`（打通 outbound）。  
6. inbound 映射到 `MsgContext` 并调用 `finalizeInboundContext` + dispatch。

## 8.2 可运维（P1）

1. `status`：`probeAccount/buildAccountSnapshot/collectStatusIssues`。  
2. `setup/onboarding`：统一 CLI 接入体验。  
3. `security/pairing`：DM 策略、allowlist 与审批提示。  
4. `directory/resolver/messaging`：目标解析与地址补全。  
5. `threading/actions`：线程语义和消息动作能力。  
6. `reload.configPrefixes`：配置热重载最小重启。

## 8.3 易踩坑注意项

1. `AccountId` 在 inbound/session/outbound 三处必须一致。  
2. `resolveTarget` 与 `normalizeTarget` 规则必须稳定，避免 DM/群组串路由。  
3. 群聊必须尽量提供 sender identity 字段，避免命令授权/审计不准。  
4. 不要绕开 `deliverOutboundPayloads` 私发消息，否则会丢失 queue/hook/mirror 能力。  
5. 没有显式 `to` 时，务必设计 `resolveDefaultTo` 或可靠 hint，避免“无目标”错误。

---

## 9. 关键源码索引

- Plugin API/类型：`src/plugins/types.ts`
- Plugin Registry：`src/plugins/registry.ts`
- Plugin Loader：`src/plugins/loader.ts`
- Plugin Runtime State：`src/plugins/runtime.ts`
- Channel Plugin 总契约：`src/channels/plugins/types.plugin.ts`
- Channel Adapters：`src/channels/plugins/types.adapters.ts`
- Channel Core Types：`src/channels/plugins/types.core.ts`
- Channel 列表/读取：`src/channels/plugins/index.ts`
- Channel Outbound Loader：`src/channels/plugins/outbound/load.ts`
- Gateway Channel Manager：`src/gateway/server-channels.ts`
- Gateway Health Monitor：`src/gateway/channel-health-monitor.ts`
- Gateway Channels Methods：`src/gateway/server-methods/channels.ts`
- Gateway Send/Poll：`src/gateway/server-methods/send.ts`
- Outbound Target 解析：`src/infra/outbound/targets.ts`
- Outbound 投递：`src/infra/outbound/deliver.ts`
- Inbound 上下文模型：`src/auto-reply/templating.ts`
- Inbound 归一化：`src/auto-reply/reply/inbound-context.ts`

---

## 10. 一句话总结

当前 OpenClaw 的 Phase 3 已从“Channel 接口定义”演进为“**Plugin 统一治理 + Channel 运行时治理 + 标准化 I/O 管道**”三位一体架构：  
**新 Channel 开发不再只是实现发送/接收函数，而是对齐一整套可复用、可观测、可治理的系统契约。**
