# Phase 3：Plugins / Channels 统一输入输出规范（v1.1，源码版）

## 0. 文档目标

本文基于当前 OpenClaw 最新源码，重写 Phase 3 规范，聚焦：

- Plugins 与 Channels 的最新注册/加载/运行时架构
- Inbound / Outbound 的统一 I/O 契约
- Gateway 对 Channel 的复用边界与调用链路
- **Channel 自定义 Agent Tools / Skills / Commands 的接入规范**
- 相比旧版规范的关键改动与新增能力
- 新增 Channel/Plugin 的落地开发清单（含 Agent 扩展能力）

适用对象：渠道插件开发者、Gateway 开发者、协议接入开发者、**Agent 工具开发者**。

---

## 1. 结论先行（最新状态）

1. **Channel 已完全纳入 Plugin Registry 统一治理**，由 `src/plugins/loader.ts` + `src/plugins/registry.ts` 负责发现、验配、注册、诊断。  
2. **Inbound 仍是“事实标准契约”**（`MsgContext` + `finalizeInboundContext` + dispatch），但字段语义与安全默认值明显增强（尤其 `CommandAuthorized` 默认拒绝）。  
3. **Outbound 已是稳定强契约**（`ChannelOutboundAdapter`），并由 `resolveOutboundTarget` + `deliverOutboundPayloads` 统一承载发信、分块、hook、队列与镜像写回。  
4. **Channel 运行时管理升级**：`server-channels` + `channel-health-monitor` 提供按账号启动/停止、自动重启回退、手工停止保护、健康巡检。  
5. **Channel 可通过三种机制扩展 Agent 能力**：`api.registerTool()`（Agent 工具）、manifest `skills` 字段（Skill 提示词注入）、`api.registerCommand()`（用户命令），三者协同构成完整的 Channel Agent 扩展面。
6. 相比旧版，当前规范从”接口定义”升级为”**注册治理 + 生命周期治理 + 安全默认策略 + Agent 扩展治理**”的完整体系。

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

## 2.7 Agent 扩展层（Tools / Skills / Commands）

Channel 插件不仅处理消息收发，还可以向 Agent 注入工具、提示词和用户命令。这一层由三种互补机制构成：

### 2.7.1 Agent Tools（AI 可调用工具）

核心文件：

- `src/plugins/types.ts`（`registerTool` API）
- `src/plugins/tools.ts`（工具解析与冲突检查）
- `src/agents/channel-tools.ts`（Channel 专属工具收集）

**两种注册方式**：

| 方式 | 注册位置 | 作用域 | 适用场景 |
|------|----------|--------|----------|
| `api.registerTool()` | `register(api)` 中 | 全局（跨 Channel） | 通用工具，如联网搜索、翻译 |
| `ChannelPlugin.agentTools` | Channel 插件定义内 | 仅限该 Channel | 平台专属工具，如飞书文档操作 |

**工具注册契约**：

```typescript
api.registerTool(
  {
    name: "tool_name",           // 全局唯一，不可与 core tools 冲突
    label: "Display Label",      // UI 展示名
    description: "...",          // Agent 可见的工具描述
    parameters: TypeBoxSchema,   // @sinclair/typebox 参数定义
    execute(toolCallId, params) { ... },  // 执行函数
  },
  { name: "tool_name" },         // 注册选项
);
```

**关键约束**：
- 工具名 `name` 全局唯一，不可覆盖 core tools。
- 可通过 `tools.allow` 配置白名单限制可用工具。
- 工具工厂模式：`registerTool` 可接受 `(ctx) => Tool | Tool[] | null` 形式的工厂函数，运行时按需创建。

### 2.7.2 Skills（Agent 提示词注入）

核心文件：

- `src/agents/skills/plugin-skills.ts`（`resolvePluginSkillDirs()`）
- `src/agents/skills/types.ts`（Skill 元数据类型）

**发现机制**：通过 `openclaw.plugin.json` 的 `skills` 字段声明相对路径，插件加载时自动扫描。

```json
{
  "id": "feishu",
  "skills": ["./skills"]
}
```

**Skill 目录结构**：

```
extensions/<channel>/skills/
└── <skill-name>/
    ├── SKILL.md          # Skill 提示词（注入 agent system prompt）
    └── references/       # 可选参考资料（大模型可按需读取）
```

**SKILL.md 规范**：

```markdown
---
name: skill-name
description: |
  简短描述，用于 Agent 判断是否激活该 Skill。
---

# Skill 标题

工具使用说明、参数示例、注意事项。
```

**关键约束**：
- SKILL.md 的 frontmatter `name` 必须全局唯一。
- Skill 内容在 Agent 启动时自动加载到 system prompt，无需手动调用。
- 一个 Skill 通常对应一个或多个 `registerTool` 注册的工具，提供使用指导。

### 2.7.3 Commands（用户命令，绕过 LLM）

核心文件：

- `src/plugins/types.ts`（`OpenClawPluginCommandDefinition`）
- `src/plugins/commands.ts`（命令注册、校验、分发）

**注册契约**：

```typescript
api.registerCommand({
  name: "command_name",         // 不含前缀斜杠，^[a-z][a-z0-9_-]*$
  description: "...",           // /help 中展示
  acceptsArgs: true,            // 是否接受参数
  requireAuth: true,            // 是否仅授权用户可用（默认 true）
  handler: async (ctx) => {     // 返回 ReplyPayload
    return { text: "result" };
  },
});
```

**关键约束**：
- 命名规则：`^[a-z][a-z0-9_-]*$`。
- 约 30 个保留命令不可覆盖：`help/status/stop/reset/config/debug/send/model/models` 等。
- 命令在 LLM 处理之前执行，匹配即短路。
- 同名命令重复注册会被拒绝并记录 diagnostic。

### 2.7.4 Agent Prompt Hints（上下文提示）

通过 `ChannelPlugin.agentPrompt.messageToolHints` 在每次 prompt 构建时注入 Channel 专属提示：

```typescript
agentPrompt: {
  messageToolHints: (params) => [
    "When using feishu, documents can be read/written via feishu_doc tool.",
  ],
},
```

### 2.7.5 三种机制的协同关系

```
用户消息 ──→ Command 匹配? ──Yes──→ handler 直接返回（不经 LLM）
                │
                No
                ↓
           Agent 启动
                │
                ├── Skills (SKILL.md) 注入 system prompt → Agent 理解可用能力
                ├── Agent Prompt Hints → 补充 Channel 特定提示
                └── Agent Tools → Agent 按需调用注册工具
```

### 2.7.6 工具配置开关模式

Channel 工具通常支持按配置开关，遵循以下标准模式：

1. **类型定义** — `FeishuToolsConfig` 中声明 `toolName?: boolean`。
2. **Schema 校验** — Zod schema 中添加 `.optional()` 字段。
3. **默认值** — `DEFAULT_TOOLS_CONFIG` 中声明默认开关状态。
4. **条件注册** — `registerXxxTools(api)` 中检查 `toolsCfg.toolName` 后再注册。
5. **UI 同步** — 配置界面 Tools 区域添加对应开关。

```typescript
// tools-config.ts
export const DEFAULT_TOOLS_CONFIG = {
  doc: true,     // 默认启用
  perm: false,   // 敏感操作默认关闭
  search: true,  // 联网搜索默认启用
};

// register 函数中
if (toolsCfg.search) {
  api.registerTool({ ... }, { name: "feishu_search" });
}
```

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
8. **Agent 扩展体系成型**：`registerTool` + manifest `skills` + `registerCommand` 三种机制完备，Channel 可同时提供 AI 工具、提示词注入和用户命令。
9. **工具配置开关标准化**：`FeishuToolsConfig` 模式（类型 → Schema → 默认值 → 条件注册 → UI）成为 Channel 工具开关的参考范式。

---

## 8. 新增 Channel/Plugin 开发清单（v1.0）

## 8.1 最小可运行（P0）

1. 提供 `openclaw.plugin.json`（含 id/configSchema）。  
2. 在 `register(api)` 中执行 `api.registerChannel(...)`。  
3. 实现 `plugin.config`：`listAccountIds`、`resolveAccount`。  
4. 实现 `plugin.gateway.startAccount`（拉起 inbound 监听）。  
5. 实现 `plugin.outbound.sendText/sendMedia`（打通 outbound）。  
6. inbound 映射到 `MsgContext` 并调用 `finalizeInboundContext` + dispatch。

## 8.2 Agent 扩展（P0.5）

1. 创建 `skills/<skill-name>/SKILL.md`，frontmatter 含 `name` + `description`。
2. 在 manifest `skills` 字段声明 skill 目录路径。
3. 实现工具逻辑（TypeBox schema + execute 函数），通过 `api.registerTool()` 注册。
4. 在 `FeishuToolsConfig`（或等效类型）中添加工具开关字段。
5. 在 Zod config schema 中添加对应 `.optional()` 字段。
6. 在 `DEFAULT_TOOLS_CONFIG` 中设定默认值。
7. 在 `registerXxxTools(api)` 中检查开关后条件注册。
8. 在 UI 配置页面 Tools 区域添加开关。
9. （可选）通过 `api.registerCommand()` 注册用户命令。
10. （可选）通过 `agentPrompt.messageToolHints` 补充上下文提示。

## 8.3 可运维（P1）

1. `status`：`probeAccount/buildAccountSnapshot/collectStatusIssues`。
2. `setup/onboarding`：统一 CLI 接入体验。
3. `security/pairing`：DM 策略、allowlist 与审批提示。
4. `directory/resolver/messaging`：目标解析与地址补全。
5. `threading/actions`：线程语义和消息动作能力。
6. `reload.configPrefixes`：配置热重载最小重启。

## 8.4 易踩坑注意项

1. `AccountId` 在 inbound/session/outbound 三处必须一致。
2. `resolveTarget` 与 `normalizeTarget` 规则必须稳定，避免 DM/群组串路由。
3. 群聊必须尽量提供 sender identity 字段，避免命令授权/审计不准。
4. 不要绕开 `deliverOutboundPayloads` 私发消息，否则会丢失 queue/hook/mirror 能力。
5. 没有显式 `to` 时，务必设计 `resolveDefaultTo` 或可靠 hint，避免”无目标”错误。
6. **工具命名不可与 core tools 冲突**（如 `send_message`、`search` 等），建议加 channel 前缀（如 `feishu_search`）。
7. **Command 命名不可与保留命令冲突**（约 30 个），注册前务必查阅 `src/plugins/commands.ts` 中的 `RESERVED_COMMANDS`。
8. **SKILL.md 的 `name` 必须全局唯一**，建议使用 `<channel>-<功能>` 命名格式。
9. **API Key 等敏感凭据**不应硬编码在源码中，应通过 config 或环境变量传入。

---

## 9. 实例：Feishu Channel 接入联网搜索工具（feishu_search）

以 Feishu Channel 接入 Tavily 联网搜索工具为例，展示完整的 Agent 工具接入流程。

### 9.1 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `extensions/feishu/src/search-schema.ts` | 新增 | TypeBox 参数 schema（search / extract 两个 action） |
| `extensions/feishu/src/search.ts` | 新增 | 工具实现 + `registerFeishuSearchTools(api)` 注册函数 |
| `extensions/feishu/skills/feishu-search/SKILL.md` | 新增 | Skill 提示词，描述工具能力和使用方法 |
| `extensions/feishu/src/types.ts` | 修改 | `FeishuToolsConfig` 新增 `search?: boolean` |
| `extensions/feishu/src/config-schema.ts` | 修改 | Zod schema 新增 `search` 字段 |
| `extensions/feishu/src/tools-config.ts` | 修改 | `DEFAULT_TOOLS_CONFIG` 新增 `search: true` |
| `extensions/feishu/index.ts` | 修改 | 导入并调用 `registerFeishuSearchTools(api)` |
| `ui/src/ui/views/channels.feishu.ts` | 修改 | UI Tools 区域新增 "Web Search (Tavily)" 开关 |

### 9.2 工具设计模式

采用与 `feishu_doc` / `feishu_wiki` / `feishu_drive` 一致的 **Action 分发模式**：

```
feishu_search
├── action: "search"   → 联网搜索，返回 AI 摘要 + 来源列表
└── action: "extract"  → URL 内容提取，返回页面原始内容
```

**Schema 定义**（TypeBox Union 模式）：

```typescript
const FeishuSearchSchema = Type.Union([
  Type.Object({
    action: Type.Literal("search"),
    query: Type.String(),
    max_results: Type.Optional(Type.Number({ minimum: 1, maximum: 20 })),
    search_depth: Type.Optional(Type.Union([Type.Literal("basic"), Type.Literal("advanced")])),
    topic: Type.Optional(Type.Union([Type.Literal("general"), Type.Literal("news")])),
    days: Type.Optional(Type.Number()),
  }),
  Type.Object({
    action: Type.Literal("extract"),
    urls: Type.Array(Type.String(), { minItems: 1 }),
  }),
]);
```

### 9.3 注册链路

```
extensions/feishu/index.ts
  → register(api)
    → registerFeishuSearchTools(api)
      → 检查 accounts 是否配置
      → 读取 toolsCfg.search 开关
      → api.registerTool({ name: "feishu_search", ... })
      → 写入 registry.tools[]

openclaw.plugin.json { "skills": ["./skills"] }
  → resolvePluginSkillDirs()
    → 发现 skills/feishu-search/SKILL.md
    → 注入 agent system prompt
```

### 9.4 关键设计决策

1. **Channel 前缀命名**：使用 `feishu_search` 而非 `search`，避免与 core tools 或其他 Channel 冲突。
2. **Action 分发而非多工具**：单一工具 + action 参数，减少工具注册数量，Agent 决策更集中。
3. **条件注册**：未配置 Feishu 账号或 `tools.search: false` 时不注册，避免无效工具暴露给 Agent。
4. **返回格式化文本**：搜索结果不仅返回 JSON details，还返回人类可读的 Markdown 格式，Agent 可直接转发给用户。

---

## 10. 关键源码索引

**插件核心**：

- Plugin API/类型：`src/plugins/types.ts`
- Plugin Registry：`src/plugins/registry.ts`
- Plugin Loader：`src/plugins/loader.ts`
- Plugin Runtime State：`src/plugins/runtime.ts`
- Plugin Commands：`src/plugins/commands.ts`
- Plugin Tools 解析：`src/plugins/tools.ts`

**Channel 契约**：

- Channel Plugin 总契约：`src/channels/plugins/types.plugin.ts`
- Channel Adapters：`src/channels/plugins/types.adapters.ts`
- Channel Core Types：`src/channels/plugins/types.core.ts`
- Channel 列表/读取：`src/channels/plugins/index.ts`
- Channel Outbound Loader：`src/channels/plugins/outbound/load.ts`

**Gateway**：

- Gateway Channel Manager：`src/gateway/server-channels.ts`
- Gateway Health Monitor：`src/gateway/channel-health-monitor.ts`
- Gateway Channels Methods：`src/gateway/server-methods/channels.ts`
- Gateway Send/Poll：`src/gateway/server-methods/send.ts`

**I/O 管道**：

- Outbound Target 解析：`src/infra/outbound/targets.ts`
- Outbound 投递：`src/infra/outbound/deliver.ts`
- Inbound 上下文模型：`src/auto-reply/templating.ts`
- Inbound 归一化：`src/auto-reply/reply/inbound-context.ts`

**Agent 扩展**：

- Agent Channel Tools 收集：`src/agents/channel-tools.ts`
- Plugin Skills 发现：`src/agents/skills/plugin-skills.ts`
- Skill 元数据类型：`src/agents/skills/types.ts`

**Feishu Channel（参考实现）**：

- 插件入口：`extensions/feishu/index.ts`
- 插件清单：`extensions/feishu/openclaw.plugin.json`
- Channel 定义：`extensions/feishu/src/channel.ts`
- 工具配置类型：`extensions/feishu/src/types.ts`（`FeishuToolsConfig`）
- 工具配置 Schema：`extensions/feishu/src/config-schema.ts`
- 工具默认值：`extensions/feishu/src/tools-config.ts`
- 文档工具：`extensions/feishu/src/docx.ts`（action 分发模式参考）
- 搜索工具：`extensions/feishu/src/search.ts`（外部 API 集成参考）
- Skills 目录：`extensions/feishu/skills/`（feishu-doc / feishu-wiki / feishu-drive / feishu-search）

---

## 11. 一句话总结

当前 OpenClaw 的 Phase 3 已从”Channel 接口定义”演进为”**Plugin 统一治理 + Channel 运行时治理 + 标准化 I/O 管道 + Agent 扩展治理**”四位一体架构：
**新 Channel 开发不仅是实现发送/接收函数，更是对齐一整套可复用、可观测、可治理、可扩展的系统契约——包括向 Agent 注入工具、提示词和用户命令的标准化能力面。**
