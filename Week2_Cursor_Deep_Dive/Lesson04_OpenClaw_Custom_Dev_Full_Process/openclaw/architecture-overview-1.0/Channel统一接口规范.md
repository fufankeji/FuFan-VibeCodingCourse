# Channel 统一接口规范说明

## 核心结论

**是的，存在统一的输入输出接口规范！**

虽然每个 Channel（Telegram、WhatsApp、Discord 等）的内部实现完全不同，但它们都必须实现相同的 `ChannelPlugin` 接口，确保 Gateway 可以用统一的方式调用它们。

---

## 一、ChannelPlugin 统一接口

### 完整接口定义

**文件**：`src/channels/plugins/types.plugin.ts`

```typescript
export type ChannelPlugin<ResolvedAccount = any, Probe = unknown, Audit = unknown> = {
  // ============ 基础信息（必需） ============
  id: ChannelId;                    // Channel 唯一标识
  meta: ChannelMeta;                // 元数据（名称、图标、文档等）
  capabilities: ChannelCapabilities; // 能力声明（支持的功能）

  // ============ 核心适配器（必需） ============
  config: ChannelConfigAdapter<ResolvedAccount>;  // 配置管理

  // ============ 可选适配器 ============
  setup?: ChannelSetupAdapter;           // 设置向导
  pairing?: ChannelPairingAdapter;       // 设备配对
  security?: ChannelSecurityAdapter;     // 安全策略
  groups?: ChannelGroupAdapter;          // 群组管理
  mentions?: ChannelMentionAdapter;      // @提及处理
  outbound?: ChannelOutboundAdapter;     // 消息发送（输出）
  status?: ChannelStatusAdapter;         // 状态查询
  gateway?: ChannelGatewayAdapter;       // Gateway 集成（输入）
  auth?: ChannelAuthAdapter;             // 认证
  elevated?: ChannelElevatedAdapter;     // 提升权限
  commands?: ChannelCommandAdapter;      // 命令处理
  streaming?: ChannelStreamingAdapter;   // 流式输出
  threading?: ChannelThreadingAdapter;   // 线程/回复
  messaging?: ChannelMessagingAdapter;   // 消息处理
  agentPrompt?: ChannelAgentPromptAdapter; // Agent 提示词
  directory?: ChannelDirectoryAdapter;   // 联系人/群组目录
  resolver?: ChannelResolverAdapter;     // 目标解析
  actions?: ChannelMessageActionAdapter; // 消息操作
  heartbeat?: ChannelHeartbeatAdapter;   // 心跳检测
  agentTools?: ChannelAgentToolFactory;  // Channel 专用工具
};
```

---

## 二、输入接口规范（消息接收）

### 1. Gateway 集成适配器（ChannelGatewayAdapter）

**文件**：`src/channels/plugins/types.adapters.ts`（第 194-208 行）

```typescript
export type ChannelGatewayAdapter<ResolvedAccount = unknown> = {
  // 启动 Channel 账号（开始接收消息）
  startAccount?: (ctx: ChannelGatewayContext<ResolvedAccount>) => Promise<unknown>;

  // 停止 Channel 账号（停止接收消息）
  stopAccount?: (ctx: ChannelGatewayContext<ResolvedAccount>) => Promise<void>;

  // QR Code 登录（如 WhatsApp）
  loginWithQrStart?: (params: {
    accountId?: string;
    force?: boolean;
    timeoutMs?: number;
    verbose?: boolean;
  }) => Promise<ChannelLoginWithQrStartResult>;

  loginWithQrWait?: (params: {
    accountId?: string;
    timeoutMs?: number;
  }) => Promise<ChannelLoginWithQrWaitResult>;

  // 登出
  logoutAccount?: (ctx: ChannelLogoutContext<ResolvedAccount>) => Promise<ChannelLogoutResult>;
};
```

**输入上下文**：

```typescript
export type ChannelGatewayContext<ResolvedAccount = unknown> = {
  cfg: OpenClawConfig;           // 配置
  accountId: string;             // 账号 ID
  account: ResolvedAccount;      // 解析后的账号信息
  runtime: RuntimeEnv;           // 运行时环境
  abortSignal: AbortSignal;      // 中止信号
  log?: ChannelLogSink;          // 日志输出
  getStatus: () => ChannelAccountSnapshot;  // 获取状态
  setStatus: (next: ChannelAccountSnapshot) => void;  // 设置状态
};
```

**关键点**：
- 所有 Channel 都通过 `startAccount()` 启动消息接收
- 接收到的消息必须转换为统一格式后传递给 Gateway
- Gateway 不关心消息的原始格式

---

### 2. 消息接收的统一流程

```
外部平台消息（原始格式）
  ↓
Channel Plugin 的 startAccount() 接收
  ↓
Channel Plugin 内部解析（各自实现）
  ↓
转换为统一的消息上下文（MsgContext）
  ↓
调用 Gateway 的统一处理接口
  ↓
Gateway 路由到 Agent
```

**统一的消息上下文**（`MsgContext`）：

```typescript
// 从 src/auto-reply/templating.ts 推断
export type MsgContext = {
  Channel: string;              // 渠道名称（"telegram", "whatsapp", "discord"）
  From: string;                 // 发送者 ID
  To: string;                   // 接收者 ID（Bot ID）
  ChatType: string;             // 聊天类型（"direct", "group", "channel"）
  Text: string;                 // 消息文本
  ReplyToId?: string;           // 回复的消息 ID
  MessageThreadId?: string | number;  // 线程 ID
  SenderId?: string;            // 发送者 ID（群组场景）
  SenderName?: string;          // 发送者名称
  SenderUsername?: string;      // 发送者用户名
  // ... 更多字段
};
```

---

### 3. 实际示例：Telegram vs WhatsApp

#### Telegram 接收消息

```typescript
// Telegram 原始消息格式
{
  "update_id": 123,
  "message": {
    "message_id": 456,
    "chat": {
      "id": -1001234567890,
      "type": "supergroup"
    },
    "from": {
      "id": 123456,
      "username": "user"
    },
    "text": "Hello"
  }
}

// Telegram Channel Plugin 转换为统一格式
{
  Channel: "telegram",
  From: "123456",
  To: "-1001234567890",
  ChatType: "group",
  Text: "Hello",
  SenderId: "123456",
  SenderUsername: "user"
}
```

#### WhatsApp 接收消息

```typescript
// WhatsApp 原始消息格式
{
  "key": {
    "remoteJid": "1234567890@s.whatsapp.net",
    "fromMe": false,
    "id": "3EB0..."
  },
  "message": {
    "conversation": "Hello"
  },
  "messageTimestamp": 1234567890
}

// WhatsApp Channel Plugin 转换为统一格式
{
  Channel: "whatsapp",
  From: "1234567890@s.whatsapp.net",
  To: "default",
  ChatType: "direct",
  Text: "Hello",
  SenderId: "1234567890@s.whatsapp.net"
}
```

**关键**：虽然原始格式完全不同，但转换后的格式完全相同！

---

## 三、输出接口规范（消息发送）

### 1. Outbound 适配器（ChannelOutboundAdapter）

**文件**：`src/channels/plugins/types.adapters.ts`（第 89-106 行）

```typescript
export type ChannelOutboundAdapter = {
  // 发送模式
  deliveryMode: "direct" | "gateway" | "hybrid";

  // 文本分块器（处理长消息）
  chunker?: ((text: string, limit: number) => string[]) | null;
  chunkerMode?: "text" | "markdown";
  textChunkLimit?: number;

  // 投票选项限制
  pollMaxOptions?: number;

  // 目标解析
  resolveTarget?: (params: {
    cfg?: OpenClawConfig;
    to?: string;
    allowFrom?: string[];
    accountId?: string | null;
    mode?: ChannelOutboundTargetMode;
  }) => { ok: true; to: string } | { ok: false; error: Error };

  // 发送完整 Payload（推荐）
  sendPayload?: (ctx: ChannelOutboundPayloadContext) => Promise<OutboundDeliveryResult>;

  // 发送纯文本
  sendText?: (ctx: ChannelOutboundContext) => Promise<OutboundDeliveryResult>;

  // 发送媒体
  sendMedia?: (ctx: ChannelOutboundContext) => Promise<OutboundDeliveryResult>;

  // 发送投票
  sendPoll?: (ctx: ChannelPollContext) => Promise<ChannelPollResult>;
};
```

---

### 2. 统一的输出上下文

**发送上下文**（`ChannelOutboundContext`）：

```typescript
export type ChannelOutboundContext = {
  cfg: OpenClawConfig;           // 配置
  to: string;                    // 目标 ID（群组/用户）
  text: string;                  // 消息文本
  mediaUrl?: string;             // 媒体 URL
  gifPlayback?: boolean;         // GIF 播放
  replyToId?: string | null;     // 回复的消息 ID
  threadId?: string | number | null;  // 线程 ID
  accountId?: string | null;     // 账号 ID
  deps?: OutboundSendDeps;       // 依赖项
};
```

**发送 Payload**（`ReplyPayload`）：

**文件**：`src/auto-reply/types.ts`（第 46-59 行）

```typescript
export type ReplyPayload = {
  text?: string;                 // 消息文本
  mediaUrl?: string;             // 单个媒体 URL
  mediaUrls?: string[];          // 多个媒体 URL
  replyToId?: string;            // 回复的消息 ID
  replyToTag?: boolean;          // 是否标记回复
  replyToCurrent?: boolean;      // 回复当前消息
  audioAsVoice?: boolean;        // 音频作为语音消息
  isError?: boolean;             // 是否为错误消息
  channelData?: Record<string, unknown>;  // Channel 特定数据
};
```

---

### 3. 消息发送的统一流程

```
Agent 生成响应（ReplyPayload）
  ↓
Gateway 获取对应的 Channel Plugin
  ↓
调用 Channel Plugin 的 outbound.sendPayload()
  ↓
Channel Plugin 转换为平台特定格式
  ↓
调用平台 API 发送消息
  ↓
返回统一的发送结果（OutboundDeliveryResult）
```

---

### 4. 实际示例：Telegram vs WhatsApp

#### 统一的输入（ReplyPayload）

```typescript
// Gateway 传递给所有 Channel 的统一格式
const payload: ReplyPayload = {
  text: "Hello from AI",
  replyToId: "456",
  mediaUrl: "https://example.com/image.jpg"
};
```

#### Telegram 发送消息

```typescript
// Telegram Channel Plugin 转换为 Telegram API 格式
POST https://api.telegram.org/bot{token}/sendMessage
{
  "chat_id": -1001234567890,
  "text": "Hello from AI",
  "reply_to_message_id": 456
}

// 如果有媒体
POST https://api.telegram.org/bot{token}/sendPhoto
{
  "chat_id": -1001234567890,
  "photo": "https://example.com/image.jpg",
  "caption": "Hello from AI",
  "reply_to_message_id": 456
}
```

#### WhatsApp 发送消息

```typescript
// WhatsApp Channel Plugin 转换为 WhatsApp Web 格式
await client.sendMessage(
  "1234567890@s.whatsapp.net",
  "Hello from AI",
  {
    quotedMessageId: "3EB0...",  // 回复的消息 ID
    media: await MessageMedia.fromUrl("https://example.com/image.jpg")
  }
);
```

**关键**：输入格式相同（ReplyPayload），但输出到平台的格式完全不同！

---

## 四、统一接口的关键组件

### 1. 能力声明（ChannelCapabilities）

**文件**：`src/channels/plugins/types.core.ts`（第 169-182 行）

```typescript
export type ChannelCapabilities = {
  chatTypes: Array<ChatType | "thread">;  // 支持的聊天类型
  polls?: boolean;                        // 是否支持投票
  reactions?: boolean;                    // 是否支持表情回应
  edit?: boolean;                         // 是否支持编辑消息
  unsend?: boolean;                       // 是否支持撤回消息
  reply?: boolean;                        // 是否支持回复
  effects?: boolean;                      // 是否支持特效
  groupManagement?: boolean;              // 是否支持群组管理
  threads?: boolean;                      // 是否支持线程
  media?: boolean;                        // 是否支持媒体
  nativeCommands?: boolean;               // 是否支持原生命令
  blockStreaming?: boolean;               // 是否支持块流式输出
};
```

**作用**：
- 声明 Channel 支持的功能
- Gateway 根据能力决定如何处理消息
- 例如：如果 Channel 不支持 `threads`，Gateway 不会尝试发送线程消息

---

### 2. 配置适配器（ChannelConfigAdapter）

**文件**：`src/channels/plugins/types.adapters.ts`（第 41-65 行）

```typescript
export type ChannelConfigAdapter<ResolvedAccount> = {
  // 列出所有账号 ID
  listAccountIds: (cfg: OpenClawConfig) => string[];

  // 解析账号配置
  resolveAccount: (cfg: OpenClawConfig, accountId?: string | null) => ResolvedAccount;

  // 默认账号 ID
  defaultAccountId?: (cfg: OpenClawConfig) => string;

  // 设置账号启用状态
  setAccountEnabled?: (params: {
    cfg: OpenClawConfig;
    accountId: string;
    enabled: boolean;
  }) => OpenClawConfig;

  // 删除账号
  deleteAccount?: (params: { cfg: OpenClawConfig; accountId: string }) => OpenClawConfig;

  // 检查是否启用
  isEnabled?: (account: ResolvedAccount, cfg: OpenClawConfig) => boolean;

  // 检查是否已配置
  isConfigured?: (account: ResolvedAccount, cfg: OpenClawConfig) => boolean | Promise<boolean>;

  // 解析 allowFrom 列表
  resolveAllowFrom?: (params: {
    cfg: OpenClawConfig;
    accountId?: string | null;
  }) => string[] | undefined;

  // 格式化 allowFrom 列表
  formatAllowFrom?: (params: {
    cfg: OpenClawConfig;
    accountId?: string | null;
    allowFrom: Array<string | number>;
  }) => string[];
};
```

**作用**：
- 统一的配置管理接口
- Gateway 通过这个接口读取和修改 Channel 配置
- 每个 Channel 的配置格式可以不同，但接口相同

---

### 3. 线程/回复适配器（ChannelThreadingAdapter）

**文件**：`src/channels/plugins/types.core.ts`（第 220-233 行）

```typescript
export type ChannelThreadingAdapter = {
  // 解析回复模式
  resolveReplyToMode?: (params: {
    cfg: OpenClawConfig;
    accountId?: string | null;
    chatType?: string | null;
  }) => "off" | "first" | "all";

  // 是否允许标签（当回复模式为 off 时）
  allowTagsWhenOff?: boolean;

  // 构建工具上下文
  buildToolContext?: (params: {
    cfg: OpenClawConfig;
    accountId?: string | null;
    context: ChannelThreadingContext;
    hasRepliedRef?: { value: boolean };
  }) => ChannelThreadingToolContext | undefined;
};
```

**作用**：
- 统一的线程/回复处理
- 不同 Channel 的线程机制不同（Telegram 的 thread vs Slack 的 thread）
- 通过适配器统一处理

---

## 五、Gateway 如何使用统一接口

### 1. 消息接收流程

```typescript
// Gateway 启动所有 Channel
for (const channelEntry of registry.channels) {
  const plugin = channelEntry.plugin;
  const account = plugin.config.resolveAccount(cfg, accountId);

  // 统一的启动接口
  if (plugin.gateway?.startAccount) {
    await plugin.gateway.startAccount({
      cfg,
      accountId,
      account,
      runtime,
      abortSignal,
      log,
      getStatus,
      setStatus
    });
  }
}

// Channel Plugin 内部接收消息后，转换为统一格式
const msgContext: MsgContext = {
  Channel: "telegram",  // 或 "whatsapp", "discord"
  From: senderId,
  To: botId,
  ChatType: "group",
  Text: messageText,
  // ... 更多字段
};

// 调用 Gateway 的统一处理接口
await gateway.handleInboundMessage(msgContext);
```

---

### 2. 消息发送流程

```typescript
// Agent 生成响应
const payload: ReplyPayload = {
  text: "Hello from AI",
  mediaUrl: "https://example.com/image.jpg",
  replyToId: "456"
};

// Gateway 获取对应的 Channel Plugin
const channelPlugin = getChannelPlugin(msgContext.Channel);

// 统一的发送接口
if (channelPlugin.outbound?.sendPayload) {
  const result = await channelPlugin.outbound.sendPayload({
    cfg,
    to: msgContext.From,
    text: payload.text,
    mediaUrl: payload.mediaUrl,
    replyToId: payload.replyToId,
    accountId,
    payload
  });

  // 统一的返回结果
  if (result.ok) {
    console.log("Message sent successfully");
  } else {
    console.error("Failed to send message:", result.error);
  }
}
```

---

### 3. 能力检查

```typescript
// Gateway 检查 Channel 是否支持某个功能
const channelPlugin = getChannelPlugin("telegram");

if (channelPlugin.capabilities.threads) {
  // Telegram 支持线程，可以发送线程消息
  await sendThreadMessage(...);
} else {
  // 不支持线程，使用普通回复
  await sendReplyMessage(...);
}

if (channelPlugin.capabilities.polls) {
  // 支持投票，可以发送投票
  await sendPoll(...);
}
```

---

## 六、统一接口的优势

### 1. Gateway 代码简洁

```typescript
// Gateway 不需要知道具体是哪个 Channel
// 所有 Channel 都用相同的方式调用

// 发送消息（适用于所有 Channel）
async function sendMessage(channel: string, to: string, text: string) {
  const plugin = getChannelPlugin(channel);
  return await plugin.outbound.sendText({ cfg, to, text, accountId });
}

// 不需要写：
// if (channel === "telegram") { sendTelegramMessage(...) }
// else if (channel === "whatsapp") { sendWhatsAppMessage(...) }
// else if (channel === "discord") { sendDiscordMessage(...) }
```

---

### 2. 易于扩展

```typescript
// 添加新 Channel 只需实现接口
export const newChannelPlugin: ChannelPlugin = {
  id: "new-channel",
  meta: { /* ... */ },
  capabilities: { /* ... */ },
  config: { /* ... */ },
  outbound: {
    deliveryMode: "direct",
    sendPayload: async (ctx) => {
      // 实现发送逻辑
      return { ok: true };
    }
  },
  gateway: {
    startAccount: async (ctx) => {
      // 实现接收逻辑
    }
  }
};

// Gateway 自动支持新 Channel，无需修改代码
```

---

### 3. 类型安全

```typescript
// TypeScript 确保所有 Channel 都实现了必需的接口
const plugin: ChannelPlugin = {
  id: "my-channel",
  meta: { /* ... */ },
  capabilities: { /* ... */ },
  config: {
    // 必须实现这两个方法，否则编译错误
    listAccountIds: (cfg) => [],
    resolveAccount: (cfg, accountId) => ({ /* ... */ })
  }
};
```

---

## 七、对比表：统一接口 vs 各自实现

| 方面 | 统一接口 | 各自实现 |
|------|----------|----------|
| **输入格式** | ✅ 统一的 `MsgContext` | ❌ 每个 Channel 不同 |
| **输出格式** | ✅ 统一的 `ReplyPayload` | ❌ 每个 Channel 不同 |
| **发送方法** | ✅ 统一的 `sendPayload()` | ❌ 每个 Channel 不同 |
| **配置管理** | ✅ 统一的 `ChannelConfigAdapter` | ❌ 每个 Channel 不同 |
| **能力声明** | ✅ 统一的 `ChannelCapabilities` | ❌ 每个 Channel 不同 |
| **Gateway 代码** | ✅ 简洁，无需 if-else | ❌ 复杂，需要大量 if-else |
| **扩展性** | ✅ 添加新 Channel 无需修改 Gateway | ❌ 添加新 Channel 需要修改 Gateway |
| **类型安全** | ✅ TypeScript 编译时检查 | ❌ 运行时才能发现错误 |

---

## 八、总结

### 核心要点

1. **存在统一的输入输出接口规范**：
   - 输入：`ChannelGatewayAdapter` + `MsgContext`
   - 输出：`ChannelOutboundAdapter` + `ReplyPayload`

2. **所有 Channel 都实现相同的接口**：
   - `ChannelPlugin` 接口定义了所有必需和可选的适配器
   - 每个 Channel 必须实现核心适配器（config, outbound, gateway）

3. **内部实现完全独立**：
   - Telegram 用 Bot API
   - WhatsApp 用 Web Protocol
   - Discord 用 Bot API（但格式不同）
   - 但对外接口完全相同

4. **Gateway 通过统一接口调用**：
   - Gateway 不关心 Channel 的内部实现
   - 只通过统一接口调用
   - 所有 Channel 对 Gateway 来说是"透明"的

5. **适配器模式的完美应用**：
   - 每个 Channel 是一个"适配器"
   - 将不同的平台 API 适配为统一接口
   - Gateway 只需要理解统一接口

---

### 类比理解

**Channel Plugin 就像"电源适配器"**：

```
美国插座（110V）
  ↓
美国电源适配器（统一接口：USB-C）
  ↓
笔记本电脑（只需要 USB-C）

中国插座（220V）
  ↓
中国电源适配器（统一接口：USB-C）
  ↓
笔记本电脑（只需要 USB-C）

欧洲插座（230V）
  ↓
欧洲电源适配器（统一接口：USB-C）
  ↓
笔记本电脑（只需要 USB-C）
```

**关键**：
- 不同国家的插座（不同的平台 API）
- 不同的电源适配器（不同的 Channel Plugin）
- 但输出接口相同（USB-C = 统一接口）
- 笔记本电脑不需要知道插座是哪个国家的（Gateway 不需要知道是哪个 Channel）

---

### 回答你的问题

**问题**：不同的 Channel，是否有相同的输入和输出接口？

**答案**：**是的，完全正确！**

**证据**：
1. **统一的输入接口**：`ChannelGatewayAdapter` + `MsgContext`
2. **统一的输出接口**：`ChannelOutboundAdapter` + `ReplyPayload`
3. **统一的配置接口**：`ChannelConfigAdapter`
4. **统一的能力声明**：`ChannelCapabilities`
5. **所有 Channel 都实现 `ChannelPlugin` 接口**

**你的理解完全正确**：
> "每一个不同的 channel，内部执行的流程可以不同，但是既然都可以接入到相同的 Agent 架构中，以及 Agent 都是通过同一个 Gateway 接入，那么肯定是用相同的输入和输出。"

这就是 OpenClaw 架构的精髓：**统一接口，独立实现，完美解耦！**
