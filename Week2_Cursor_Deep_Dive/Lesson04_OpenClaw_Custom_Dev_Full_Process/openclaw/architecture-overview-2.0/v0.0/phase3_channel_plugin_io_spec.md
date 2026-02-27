# Phase 3：Plugins / Channels 统一输入输出接口规范（源码版）

## 1. 目标与结论

本文件聚焦第三层：**Plugins 系统中的 Channels 接入层**。
目标是给出可执行的“统一 I/O 契约”，用于你后续接入自定义 Channel。

核心结论：

1. Channel 在 OpenClaw 中没有单独的“Inbound Adapter 类型接口”，但有一套稳定的**事实标准**：
   - 生命周期入口：`ChannelPlugin.gateway.startAccount`（`src/channels/plugins/types.adapters.ts`）
   - 输入消息标准体：`MsgContext`（`src/auto-reply/templating.ts`）
   - 统一分发入口：`dispatchInboundMessage*`（`src/auto-reply/dispatch.ts`）
2. Outbound 有明确类型契约：`ChannelOutboundAdapter`（`src/channels/plugins/types.adapters.ts`），由 Gateway `send/poll` 统一调用。
3. 你做新 Channel 时，只要遵守 `ChannelPlugin` 契约并完成最低限度适配，Gateway 与上层客户端可直接复用。

---

## 2. 第三层模块划分（顶层）

### 2.1 契约层（接口定义）

- `src/channels/plugins/types.plugin.ts`
  - `ChannelPlugin` 总接口（所有 Channel 插件的统一入口）。
- `src/channels/plugins/types.adapters.ts`
  - `config/setup/security/gateway/outbound/status/directory/resolver/...` 各适配器接口。
- `src/channels/plugins/types.core.ts`
  - 公共领域类型：`ChannelCapabilities`、`ChannelAccountSnapshot`、`ChannelPollContext` 等。

### 2.2 运行时注册与发现层

- `src/plugins/discovery.ts`
  - 扫描 `extensions/*`、配置路径、workspace/global/bundled 插件来源。
- `src/plugins/loader.ts`
  - 加载插件、执行 `register(api)`，建立注册表。
- `src/plugins/registry.ts`
  - `api.registerChannel(...)` 落库到 `registry.channels`。
- `src/plugins/runtime.ts`
  - 全局激活插件注册表。
- `src/channels/plugins/index.ts`
  - `listChannelPlugins/getChannelPlugin` 统一读取 Channel 插件。

### 2.3 Gateway 对接层

- `src/gateway/server-channels.ts`
  - Channel 生命周期管理：`startChannels/startChannel/stopChannel`。
- `src/gateway/server-methods/channels.ts`
  - `channels.status/channels.logout` RPC；调用 `plugin.status`/`plugin.gateway`。
- `src/gateway/server-methods/send.ts`
  - `send/poll` RPC；调用 `plugin.outbound`。
- `src/infra/outbound/deliver.ts`
  - 统一出站分发，接入 `sendText/sendMedia/sendPayload/sendPoll`。
- `src/infra/outbound/targets.ts`
  - 统一目标解析（`resolveTarget` + allowFrom + explicit/implicit/heartbeat 模式）。

### 2.4 输入分发与会话层

- `src/auto-reply/templating.ts`
  - 输入消息标准上下文：`MsgContext`。
- `src/auto-reply/reply/inbound-context.ts`
  - `finalizeInboundContext`：归一化输入字段、补齐 `BodyForAgent/BodyForCommands`、强制 `CommandAuthorized`。
- `src/auto-reply/dispatch.ts`
  - 统一把消息送入 AI 回复管道。
- `src/channels/session.ts` + `src/config/sessions.ts`
  - 记录 inbound session 元数据，维持路由连续性。

### 2.5 插件实现层（示例）

- 插件入口注册：`extensions/*/index.ts`
- Channel 实现：`extensions/*/src/channel.ts`
- 运行时桥接：`extensions/*/src/runtime.ts`

---

## 3. 标准接入方式（从插件到运行）

## 3.1 插件声明与注册

1. 提供 `openclaw.plugin.json`（至少包含 `id`、`configSchema`）。
2. 在 `index.ts` 中导出插件对象并调用 `api.registerChannel({ plugin })`。
3. 通过 `setXxxRuntime(api.runtime)` 把核心运行能力注入频道实现（见 `extensions/telegram/index.ts`、`extensions/slack/index.ts`）。

## 3.2 Gateway 启动时加载

1. `loadOpenClawPlugins()` 扫描并加载插件（`src/plugins/loader.ts`）。
2. `registerChannel` 将 ChannelPlugin 放入 registry（`src/plugins/registry.ts`）。
3. `listChannelPlugins()` 提供给 Gateway 生命周期和 RPC 层使用（`src/channels/plugins/index.ts`）。
4. Gateway 启动 sidecar 时调用 `startChannels()`，逐个执行 `plugin.gateway.startAccount(...)`（`src/gateway/server-startup.ts` + `src/gateway/server-channels.ts`）。

---

## 4. Channels 统一输入接口规范（Inbound）

## 4.1 统一“入口契约”

虽然没有 `ChannelInboundAdapter` 类型，但实际统一入口是：

1. **生命周期输入入口**：`plugin.gateway.startAccount(ctx)`
2. **消息输入标准体**：`MsgContext`
3. **消息分发入口**：`dispatchInboundMessage*`

也就是说，任何 Channel 只要把外部事件转成 `MsgContext` 并走 dispatch，系统即可统一处理。

## 4.2 Inbound 最小字段规范（建议按此作为强约束）

来源：`src/auto-reply/templating.ts` + `test/helpers/inbound-contract.ts` + `src/channels/sender-identity.ts`

推荐最小集合：

- `Body`
- `RawBody`
- `CommandBody`
- `From`
- `To`
- `SessionKey`
- `AccountId`
- `ChatType`（`direct/group/channel`）
- `Provider`
- `Surface`
- `CommandAuthorized`

强烈建议同时提供：

- `SenderId` / `SenderName` / `SenderUsername` / `SenderE164`（群聊场景至少有一个）
- `ConversationLabel`
- `MessageSid`
- `Timestamp`
- `OriginatingChannel`
- `OriginatingTo`
- `WasMentioned`
- `ReplyToId` / `MessageThreadId`（若渠道支持）

## 4.3 Inbound 处理标准流程（建议模板）

1. 外部平台 webhook/socket/poll 收到原始事件。
2. 在 Channel monitor 中做鉴权、allowlist、group policy、mention gating。
3. 通过 `resolveAgentRoute` 决定 `agentId/sessionKey/accountId`。
4. 组装 `MsgContext`。
5. 调用 `finalizeInboundContext(ctx)` 做归一化。
6. 调用 `recordInboundSession(...)` 更新会话路由元数据。
7. 调用 `dispatchReplyWithBufferedBlockDispatcher(...)` 或 `dispatchInboundMessage(...)`。

对应示例源码：

- `extensions/irc/src/inbound.ts`
- `extensions/nextcloud-talk/src/inbound.ts`
- `extensions/zalo/src/monitor.ts`

---

## 5. Channels 统一输出接口规范（Outbound）

## 5.1 Outbound 统一接口

`ChannelOutboundAdapter`（`src/channels/plugins/types.adapters.ts`）：

- `deliveryMode: "direct" | "gateway" | "hybrid"`
- `resolveTarget(...)`（可选）
- `sendPayload(...)`（可选，完整 payload）
- `sendText(...)`（核心）
- `sendMedia(...)`（核心）
- `sendPoll(...)`（可选）
- `chunker/chunkerMode/textChunkLimit`（长文本控制）

当前系统里，`deliverOutboundPayloads` 要求通道至少具备：

- `sendText`
- `sendMedia`

否则会被判定为该 channel 不可投递（`src/infra/outbound/deliver.ts`）。

## 5.2 Outbound 调用链

1. 客户端调用 Gateway `send` / `poll`。
2. `src/gateway/server-methods/send.ts` 验参、幂等、解析 channel/accountId。
3. `resolveOutboundTarget(...)` 执行目标归一（`src/infra/outbound/targets.ts`）。
4. `deliverOutboundPayloads(...)` 调用通道适配器发送（`src/infra/outbound/deliver.ts`）。
5. 返回统一结果结构：`OutboundDeliveryResult` / `ChannelPollResult`。

## 5.3 目标解析规范

`resolveTarget` 接收参数中有 `mode`：

- `explicit`：显式目标（用户主动指定）
- `implicit`：从 session/上下文推导
- `heartbeat`：心跳/保活消息

如果不实现 `resolveTarget`，系统默认使用 `to.trim()`；若 `to` 为空会抛缺失目标错误。

---

## 6. Gateway 可复用前提下的 Channel 标准模块

为保证 WebUI/MacOS/其他客户端都能复用同一 Gateway，Channel 建议至少实现以下模块：

- 必需：
  - `config`（账号列举与解析）
  - `gateway.startAccount`（接入外部平台消息）
  - `outbound.sendText/sendMedia`（回包能力）
- 强建议：
  - `status`（`probe/buildAccountSnapshot/collectStatusIssues`）
  - `setup`（CLI onboarding 一致性）
  - `security`（dm policy + warning 收敛）
  - `pairing`（配对审批流程）
  - `directory/resolver`（目标补全与歧义解析）
  - `threading/messaging`（线程回复与 target 规范化）

这些模块都已在 `ChannelPlugin` 中标准化，Gateway 不需要知道具体平台细节。

---

## 7. 新增自定义 Channel 的二次开发清单

## 7.1 代码骨架

1. 新建 `extensions/<your-channel>/`。
2. 提供 `openclaw.plugin.json`（`id`、`configSchema`）。
3. `package.json` 增加 `openclaw.extensions` 与 `openclaw.channel` 元数据。
4. 新建 `index.ts`：在 `register(api)` 中注入 runtime 并 `registerChannel`。
5. 新建 `src/channel.ts`：实现 `ChannelPlugin`。

## 7.2 配置接入

需要关注 `plugins` 配置（`src/plugins/config-state.ts`）：

- `plugins.enabled`
- `plugins.allow` / `plugins.deny`
- `plugins.load.paths`（自定义路径加载）
- `plugins.entries.<pluginId>.enabled`

另外，Channel 自身账号配置建议统一走 `channels.<id>.accounts.<accountId>` 结构，并实现：

- `config.listAccountIds`
- `config.resolveAccount`
- `config.defaultAccountId`
- `config.isConfigured`

## 7.3 关键技术细节（最容易踩坑）

1. **账号与路由一致性**
   - Inbound `AccountId`、Outbound `accountId`、session route 必须一致。
2. **目标 ID 规范化**
   - 明确你自己的 `normalizeTarget` 与 `resolveTarget` 规则，避免 DM/群 target 混淆。
3. **群聊发送者身份**
   - 群消息务必给出 sender identity 字段，否则会触发 contract 问题。
4. **Thread / Reply 语义**
   - 平台若支持 thread，需稳定填充 `ReplyToId/MessageThreadId` 并实现 `threading`。
5. **状态可观测性**
   - 推荐维护 `lastInboundAt/lastOutboundAt/lastError/running/connected`，便于 `channels.status --probe` 可诊断。
6. **出站分块与格式**
   - 长文本渠道要实现 `chunker` 与 `textChunkLimit`，否则易触发平台长度限制。
7. **命令授权与 mention gating**
   - 复用 `runtime.channel.commands` 与 `runtime.channel.groups`，不要在各 Channel 自行发散实现。

---

## 8. 最小实现建议（可落地）

如果你要快速打通一个新 Channel，最小可运行版本建议分两步：

1. **P0（先跑通）**
   - `config` + `gateway.startAccount` + `outbound.sendText/sendMedia`
   - Inbound 能构建 `MsgContext` 并 dispatch
2. **P1（可运营）**
   - `status` + `security` + `pairing` + `directory/resolver`
   - 完整支持 `channels.status`、目标解析、审批链路和故障诊断

这样可以在不改 Gateway 主干的前提下完成插件化接入。

---

## 9. 参考源码索引

- Channel 总契约：`src/channels/plugins/types.plugin.ts`
- Channel 适配器：`src/channels/plugins/types.adapters.ts`
- Channel 核心类型：`src/channels/plugins/types.core.ts`
- Plugin 注册 API：`src/plugins/types.ts`
- Plugin 注册实现：`src/plugins/registry.ts`
- Plugin 发现/加载：`src/plugins/discovery.ts`、`src/plugins/loader.ts`
- Channel 生命周期管理：`src/gateway/server-channels.ts`
- Gateway Channels RPC：`src/gateway/server-methods/channels.ts`
- Gateway Send RPC：`src/gateway/server-methods/send.ts`
- Outbound 统一分发：`src/infra/outbound/deliver.ts`
- Outbound 目标解析：`src/infra/outbound/targets.ts`
- Inbound 消息模型：`src/auto-reply/templating.ts`
- Inbound 归一化：`src/auto-reply/reply/inbound-context.ts`
- Inbound 分发：`src/auto-reply/dispatch.ts`
- Contract 测试：`test/helpers/inbound-contract.ts`
- 示例实现：`extensions/telegram/src/channel.ts`、`extensions/slack/src/channel.ts`、`extensions/matrix/src/channel.ts`

