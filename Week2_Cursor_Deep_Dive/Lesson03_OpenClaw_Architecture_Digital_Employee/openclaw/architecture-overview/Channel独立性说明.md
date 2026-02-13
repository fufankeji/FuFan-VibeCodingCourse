# Channel 独立性说明：每个外部服务都有独立的 Channel

## 核心结论

**每个外部服务（Telegram、WhatsApp、Discord、Slack 等）都有自己独立的 Channel Plugin！**

它们**不是**共用同一个 Channel，而是：
- 每个服务有独立的实现
- 每个服务有独立的配置
- 每个服务有独立的能力声明
- 每个服务有独立的消息处理逻辑

---

## 一、源码证据

### 1. 独立的 Channel Plugin 实现

#### Telegram Channel Plugin

**文件**：`extensions/telegram/index.ts`

```typescript
// extensions/telegram/index.ts
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { telegramPlugin } from "./src/channel.js";

const plugin = {
  id: "telegram",                    // 独立的 ID
  name: "Telegram",                  // 独立的名称
  description: "Telegram channel plugin",
  register(api: OpenClawPluginApi) {
    api.registerChannel({ plugin: telegramPlugin });  // 注册 Telegram 专用的 Channel
  }
};

export default plugin;
```

**文件**：`extensions/telegram/src/channel.ts`（前 150 行）

```typescript
export const telegramPlugin: ChannelPlugin<ResolvedTelegramAccount, TelegramProbe> = {
  id: "telegram",                    // Channel ID

  // Telegram 特有的元数据
  meta: {
    ...meta,
    quickstartAllowFrom: true,
  },

  // Telegram 特有的配对设置
  pairing: {
    idLabel: "telegramUserId",
    normalizeAllowEntry: (entry) => entry.replace(/^(telegram|tg):/i, ""),
    notifyApproval: async ({ cfg, id }) => {
      // Telegram 特有的审批通知逻辑
      await getTelegramRuntime().channel.telegram.sendMessageTelegram(
        id,
        PAIRING_APPROVED_MESSAGE,
        { token }
      );
    },
  },

  // Telegram 特有的能力声明
  capabilities: {
    chatTypes: ["direct", "group", "channel", "thread"],  // 支持 4 种聊天类型
    reactions: true,
    threads: true,
    media: true,
    nativeCommands: true,
    blockStreaming: true,
  },

  // Telegram 特有的配置处理
  config: {
    listAccountIds: (cfg) => listTelegramAccountIds(cfg),
    resolveAccount: (cfg, accountId) => resolveTelegramAccount({ cfg, accountId }),
    // ... 更多 Telegram 特有的配置逻辑
  },

  // ... 更多 Telegram 特有的适配器
};
```

---

#### WhatsApp Channel Plugin

**文件**：`extensions/whatsapp/index.ts`

```typescript
// extensions/whatsapp/index.ts
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { whatsappPlugin } from "./src/channel.js";

const plugin = {
  id: "whatsapp",                    // 独立的 ID（不同于 Telegram）
  name: "WhatsApp",                  // 独立的名称
  description: "WhatsApp channel plugin",
  register(api: OpenClawPluginApi) {
    api.registerChannel({ plugin: whatsappPlugin });  // 注册 WhatsApp 专用的 Channel
  }
};

export default plugin;
```

**文件**：`extensions/whatsapp/src/channel.ts`（前 150 行）

```typescript
export const whatsappPlugin: ChannelPlugin<ResolvedWhatsAppAccount> = {
  id: "whatsapp",                    // Channel ID（不同于 Telegram）

  // WhatsApp 特有的元数据
  meta: {
    ...meta,
    showConfigured: false,
    quickstartAllowFrom: true,
    forceAccountBinding: true,
    preferSessionLookupForAnnounceTarget: true,
  },

  // WhatsApp 特有的配对设置
  pairing: {
    idLabel: "whatsappSenderId",     // 不同于 Telegram 的 "telegramUserId"
  },

  // WhatsApp 特有的能力声明
  capabilities: {
    chatTypes: ["direct", "group"],  // 只支持 2 种聊天类型（不同于 Telegram）
    polls: true,
    reactions: true,
    media: true,
    // 注意：没有 nativeCommands、threads、blockStreaming
  },

  // WhatsApp 特有的配置处理
  config: {
    listAccountIds: (cfg) => listWhatsAppAccountIds(cfg),
    resolveAccount: (cfg, accountId) => resolveWhatsAppAccount({ cfg, accountId }),
    // ... 更多 WhatsApp 特有的配置逻辑
  },

  // WhatsApp 特有的安全策略
  security: {
    resolveDmPolicy: ({ cfg, accountId, account }) => {
      // WhatsApp 特有的 DM 策略处理
      return {
        policy: account.dmPolicy ?? "pairing",
        allowFrom: account.allowFrom ?? [],
        normalizeEntry: (raw) => normalizeE164(raw),  // WhatsApp 特有的电话号码格式化
      };
    },
  },

  // ... 更多 WhatsApp 特有的适配器
};
```

---

### 2. Channel 注册表管理

**文件**：`src/channels/registry.ts`（前 100 行）

```typescript
// 核心 Channel 列表（按优先级排序）
export const CHAT_CHANNEL_ORDER = [
  "telegram",      // 独立的 Telegram Channel
  "whatsapp",      // 独立的 WhatsApp Channel
  "discord",       // 独立的 Discord Channel
  "irc",           // 独立的 IRC Channel
  "googlechat",    // 独立的 Google Chat Channel
  "slack",         // 独立的 Slack Channel
  "signal",        // 独立的 Signal Channel
  "imessage",      // 独立的 iMessage Channel
] as const;

// 每个 Channel 的元数据（完全独立）
const CHAT_CHANNEL_META: Record<ChatChannelId, ChannelMeta> = {
  telegram: {
    id: "telegram",
    label: "Telegram",
    selectionLabel: "Telegram (Bot API)",
    detailLabel: "Telegram Bot",
    docsPath: "/channels/telegram",
    blurb: "simplest way to get started — register a bot with @BotFather and get going.",
    systemImage: "paperplane",
  },
  whatsapp: {
    id: "whatsapp",
    label: "WhatsApp",
    selectionLabel: "WhatsApp (QR link)",
    detailLabel: "WhatsApp Web",
    docsPath: "/channels/whatsapp",
    blurb: "works with your own number; recommend a separate phone + eSIM.",
    systemImage: "message",
  },
  discord: {
    id: "discord",
    label: "Discord",
    selectionLabel: "Discord (Bot API)",
    detailLabel: "Discord Bot",
    docsPath: "/channels/discord",
    blurb: "very well supported right now.",
    systemImage: "bubble.left.and.bubble.right",
  },
  // ... 更多独立的 Channel 元数据
};
```

---

**文件**：`src/channels/plugins/index.ts`

```typescript
// 从 PluginRegistry 获取所有注册的 Channel Plugins
function listPluginChannels(): ChannelPlugin[] {
  const registry = requireActivePluginRegistry();
  return registry.channels.map((entry) => entry.plugin);
}

// 去重并排序所有 Channel Plugins
function dedupeChannels(channels: ChannelPlugin[]): ChannelPlugin[] {
  const seen = new Set<string>();
  const resolved: ChannelPlugin[] = [];
  for (const plugin of channels) {
    const id = String(plugin.id).trim();
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    resolved.push(plugin);
  }
  return resolved;
}

// 列出所有可用的 Channel Plugins
export function listChannelPlugins(): ChannelPlugin[] {
  const combined = dedupeChannels(listPluginChannels());
  return combined.toSorted((a, b) => {
    // 按优先级排序
    const indexA = CHAT_CHANNEL_ORDER.indexOf(a.id as ChatChannelId);
    const indexB = CHAT_CHANNEL_ORDER.indexOf(b.id as ChatChannelId);
    const orderA = a.meta.order ?? (indexA === -1 ? 999 : indexA);
    const orderB = b.meta.order ?? (indexB === -1 ? 999 : indexB);
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    return a.id.localeCompare(b.id);
  });
}

// 根据 ID 获取特定的 Channel Plugin
export function getChannelPlugin(id: ChannelId): ChannelPlugin | undefined {
  const resolvedId = String(id).trim();
  if (!resolvedId) {
    return undefined;
  }
  return listChannelPlugins().find((plugin) => plugin.id === resolvedId);
}
```

---

### 3. Channel Dock（轻量级元数据）

**文件**：`src/channels/dock.ts`（部分代码）

```typescript
// Channel Docks: 每个 Channel 的轻量级元数据
const DOCKS: Record<ChatChannelId, ChannelDock> = {
  // Telegram 的 Dock
  telegram: {
    id: "telegram",
    capabilities: {
      chatTypes: ["direct", "group", "channel", "thread"],
      nativeCommands: true,
      blockStreaming: true,
    },
    outbound: { textChunkLimit: 4000 },
    config: {
      resolveAllowFrom: ({ cfg, accountId }) =>
        (resolveTelegramAccount({ cfg, accountId }).config.allowFrom ?? []).map((entry) =>
          String(entry),
        ),
      formatAllowFrom: ({ allowFrom }) =>
        allowFrom
          .map((entry) => String(entry).trim())
          .filter(Boolean)
          .map((entry) => entry.replace(/^(telegram|tg):/i, ""))
          .map((entry) => entry.toLowerCase()),
    },
    // ... 更多 Telegram 特有的配置
  },

  // WhatsApp 的 Dock
  whatsapp: {
    id: "whatsapp",
    capabilities: {
      chatTypes: ["direct", "group"],  // 不同于 Telegram
      polls: true,
      reactions: true,
      media: true,
    },
    commands: {
      enforceOwnerForCommands: true,
      skipWhenConfigEmpty: true,
    },
    outbound: { textChunkLimit: 4000 },
    config: {
      resolveAllowFrom: ({ cfg, accountId }) =>
        resolveWhatsAppAccount({ cfg, accountId }).allowFrom ?? [],
      formatAllowFrom: ({ allowFrom }) =>
        allowFrom
          .map((entry) => String(entry).trim())
          .filter((entry): entry is string => Boolean(entry))
          .map((entry) => (entry === "*" ? entry : normalizeWhatsAppTarget(entry)))
          .filter((entry): entry is string => Boolean(entry)),
    },
    // ... 更多 WhatsApp 特有的配置
  },

  // Discord 的 Dock
  discord: {
    id: "discord",
    capabilities: {
      chatTypes: ["direct", "channel", "thread"],  // 不同于 Telegram 和 WhatsApp
      polls: true,
      reactions: true,
      media: true,
      nativeCommands: true,
      threads: true,
    },
    outbound: { textChunkLimit: 2000 },  // 不同于 Telegram/WhatsApp 的 4000
    streaming: {
      blockStreamingCoalesceDefaults: { minChars: 1500, idleMs: 1000 },
    },
    // ... 更多 Discord 特有的配置
  },

  // ... 更多独立的 Channel Docks
};
```

---

## 二、关键差异对比

### 对比表：Telegram vs WhatsApp vs Discord

| 特性 | Telegram | WhatsApp | Discord |
|------|----------|----------|---------|
| **Channel ID** | `"telegram"` | `"whatsapp"` | `"discord"` |
| **插件文件** | `extensions/telegram/` | `extensions/whatsapp/` | `extensions/discord/` |
| **聊天类型** | direct, group, channel, thread | direct, group | direct, channel, thread |
| **原生命令** | ✅ 支持 | ❌ 不支持 | ✅ 支持 |
| **线程支持** | ✅ 支持 | ❌ 不支持 | ✅ 支持 |
| **流式输出** | ✅ 支持（blockStreaming） | ❌ 不支持 | ✅ 支持（coalesce） |
| **投票功能** | ❌ 不支持 | ✅ 支持 | ✅ 支持 |
| **文本限制** | 4000 字符 | 4000 字符 | 2000 字符 |
| **配对 ID 标签** | `telegramUserId` | `whatsappSenderId` | Discord User ID |
| **认证方式** | Bot Token | QR Code (Web) | Bot Token |
| **配置路径** | `channels.telegram` | `channels.whatsapp` | `channels.discord` |
| **账号格式化** | 移除 `telegram:` 前缀 | E.164 电话号码格式 | 小写用户 ID |

---

### 能力声明对比

```typescript
// Telegram 的能力
capabilities: {
  chatTypes: ["direct", "group", "channel", "thread"],
  reactions: true,
  threads: true,
  media: true,
  nativeCommands: true,
  blockStreaming: true,
}

// WhatsApp 的能力
capabilities: {
  chatTypes: ["direct", "group"],
  polls: true,
  reactions: true,
  media: true,
}

// Discord 的能力
capabilities: {
  chatTypes: ["direct", "channel", "thread"],
  polls: true,
  reactions: true,
  media: true,
  nativeCommands: true,
  threads: true,
}
```

**关键差异**：
- Telegram 支持 `channel` 类型（频道），WhatsApp 不支持
- WhatsApp 支持 `polls`（投票），Telegram 不支持
- Discord 不支持 `group` 类型，但支持 `channel` 和 `thread`
- 每个 Channel 的能力完全独立定义

---

## 三、为什么每个服务需要独立的 Channel？

### 1. 协议差异

**Telegram Bot API**：
```typescript
// Telegram 消息格式
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
```

**WhatsApp Web Protocol**：
```typescript
// WhatsApp 消息格式（完全不同）
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
```

**Discord Bot API**：
```typescript
// Discord 消息格式（又是完全不同）
{
  "id": "123456789012345678",
  "channel_id": "987654321098765432",
  "author": {
    "id": "111111111111111111",
    "username": "user"
  },
  "content": "Hello",
  "timestamp": "2024-01-01T00:00:00.000000+00:00"
}
```

**结论**：每个服务的消息格式完全不同，必须有独立的解析逻辑。

---

### 2. 认证方式差异

| 服务 | 认证方式 | 配置示例 |
|------|----------|----------|
| **Telegram** | Bot Token | `botToken: "123456:ABC-DEF..."` |
| **WhatsApp** | QR Code 扫码 | 扫码后自动保存 session |
| **Discord** | Bot Token + Application ID | `token: "...", applicationId: "..."` |
| **Slack** | OAuth + Socket Mode | `token: "xoxb-...", appToken: "xapp-..."` |
| **Signal** | signal-cli 链接设备 | 需要外部 signal-cli 服务 |

**结论**：每个服务的认证流程完全不同，必须有独立的认证逻辑。

---

### 3. 功能特性差异

| 功能 | Telegram | WhatsApp | Discord | Slack |
|------|----------|----------|---------|-------|
| **频道（Channel）** | ✅ | ❌ | ✅ | ✅ |
| **线程（Thread）** | ✅ | ❌ | ✅ | ✅ |
| **投票（Poll）** | ❌ | ✅ | ✅ | ✅ |
| **表情回应** | ✅ | ✅ | ✅ | ✅ |
| **原生命令** | ✅ | ❌ | ✅ | ✅ |
| **文件上传** | ✅ | ✅ | ✅ | ✅ |
| **语音消息** | ✅ | ✅ | ✅ | ❌ |

**结论**：每个服务支持的功能不同，必须有独立的能力声明。

---

### 4. 消息发送差异

**Telegram 发送消息**：
```typescript
// Telegram API
POST https://api.telegram.org/bot{token}/sendMessage
{
  "chat_id": 123456,
  "text": "Hello",
  "parse_mode": "Markdown"
}
```

**WhatsApp 发送消息**：
```typescript
// WhatsApp Web (通过 whatsapp-web.js)
await client.sendMessage(
  "1234567890@c.us",  // JID 格式
  "Hello"
);
```

**Discord 发送消息**：
```typescript
// Discord API
POST https://discord.com/api/v10/channels/{channel_id}/messages
{
  "content": "Hello",
  "tts": false
}
```

**结论**：每个服务的发送 API 完全不同，必须有独立的发送逻辑。

---

## 四、Channel Plugin 的统一接口

虽然每个 Channel 的实现完全独立，但它们都遵循统一的 `ChannelPlugin` 接口：

```typescript
export type ChannelPlugin<ResolvedAccount = any> = {
  // 基础信息
  id: ChannelId;                    // 唯一标识
  meta: ChannelMeta;                // 元数据
  capabilities: ChannelCapabilities; // 能力声明

  // 核心适配器（每个 Channel 独立实现）
  config: ChannelConfigAdapter<ResolvedAccount>;
  gateway?: ChannelGatewayAdapter;       // Gateway 集成
  outbound?: ChannelOutboundAdapter;     // 消息发送
  status?: ChannelStatusAdapter;         // 状态查询
  messaging?: ChannelMessagingAdapter;   // 消息处理

  // 可选适配器
  setup?: ChannelSetupAdapter;           // 设置向导
  auth?: ChannelAuthAdapter;             // 认证
  pairing?: ChannelPairingAdapter;       // 配对
  security?: ChannelSecurityAdapter;     // 安全策略
  // ... 更多适配器
};
```

**关键点**：
- **统一接口**：所有 Channel 都实现相同的接口
- **独立实现**：每个 Channel 的实现完全独立
- **适配器模式**：通过适配器屏蔽底层差异

---

## 五、Gateway 如何使用不同的 Channel

### 1. 注册阶段

```typescript
// 启动时，Gateway 加载所有 Channel Plugins
const registry = requireActivePluginRegistry();

// Telegram Plugin 注册
api.registerChannel({ plugin: telegramPlugin });

// WhatsApp Plugin 注册
api.registerChannel({ plugin: whatsappPlugin });

// Discord Plugin 注册
api.registerChannel({ plugin: discordPlugin });

// 所有 Channel 都存储在 PluginRegistry
registry.channels = [
  { plugin: telegramPlugin },
  { plugin: whatsappPlugin },
  { plugin: discordPlugin },
  // ... 更多
];
```

---

### 2. 消息接收阶段

```typescript
// 用户在 Telegram 发消息
Telegram Bot 接收消息
  ↓
Telegram Channel Plugin 的 gateway adapter 处理
  ↓
解析为统一格式：
{
  channel: "telegram",
  accountId: "bot-token",
  peer: { kind: "group", id: "-1001234567890" },
  text: "Hello"
}
  ↓
Gateway 路由系统处理（不关心来自哪个 Channel）
```

```typescript
// 用户在 WhatsApp 发消息
WhatsApp Web 接收消息
  ↓
WhatsApp Channel Plugin 的 gateway adapter 处理
  ↓
解析为统一格式：
{
  channel: "whatsapp",
  accountId: "default",
  peer: { kind: "direct", id: "1234567890@s.whatsapp.net" },
  text: "Hello"
}
  ↓
Gateway 路由系统处理（不关心来自哪个 Channel）
```

**关键**：虽然 Telegram 和 WhatsApp 的原始消息格式完全不同，但通过各自的 Channel Plugin 转换为统一格式后，Gateway 可以统一处理。

---

### 3. 消息发送阶段

```typescript
// Agent 生成响应后，Gateway 需要发送回用户

// 如果消息来自 Telegram
const telegramPlugin = getChannelPlugin("telegram");
await telegramPlugin.outbound.send({
  to: "-1001234567890",
  text: "Response from AI",
  accountId: "bot-token"
});
// 内部调用 Telegram Bot API

// 如果消息来自 WhatsApp
const whatsappPlugin = getChannelPlugin("whatsapp");
await whatsappPlugin.outbound.send({
  to: "1234567890@s.whatsapp.net",
  text: "Response from AI",
  accountId: "default"
});
// 内部调用 WhatsApp Web API
```

**关键**：Gateway 根据消息来源的 `channel` 字段，动态获取对应的 Channel Plugin，调用其 `outbound` 适配器发送消息。

---

## 六、配置示例

### 独立配置不同的 Channel

```yaml
# 配置文件：~/.openclaw/config.yaml

channels:
  # Telegram 配置（独立）
  telegram:
    accounts:
      bot-token:
        botToken: "123456:ABC-DEF..."
        allowFrom: ["*"]
        name: "My Telegram Bot"

  # WhatsApp 配置（独立）
  whatsapp:
    accounts:
      default:
        enabled: true
        allowFrom: ["*"]
        name: "My WhatsApp"

  # Discord 配置（独立）
  discord:
    accounts:
      bot-id:
        token: "..."
        applicationId: "..."
        dm:
          allowFrom: ["*"]
        name: "My Discord Bot"

  # Slack 配置（独立）
  slack:
    accounts:
      workspace-id:
        token: "xoxb-..."
        appToken: "xapp-..."
        dm:
          allowFrom: ["U123", "U456"]
        name: "My Slack Bot"
```

**关键点**：
- 每个 Channel 有独立的配置节
- 每个 Channel 的配置格式不同
- 每个 Channel 可以有多个账号

---

## 七、总结

### 核心要点

1. **每个外部服务都有独立的 Channel Plugin**：
   - Telegram → `extensions/telegram/`
   - WhatsApp → `extensions/whatsapp/`
   - Discord → `extensions/discord/`
   - Slack → `extensions/slack/`
   - ... 更多

2. **每个 Channel 的实现完全独立**：
   - 独立的消息解析逻辑
   - 独立的认证方式
   - 独立的能力声明
   - 独立的配置格式
   - 独立的发送逻辑

3. **统一的接口，独立的实现**：
   - 所有 Channel 都实现 `ChannelPlugin` 接口
   - 通过适配器模式屏蔽底层差异
   - Gateway 通过统一接口调用不同的 Channel

4. **PluginRegistry 管理所有 Channel**：
   - 所有 Channel 注册到 PluginRegistry
   - Gateway 从 PluginRegistry 获取 Channel
   - 支持动态加载和卸载

5. **可扩展性**：
   - 添加新的外部服务只需创建新的 Channel Plugin
   - 无需修改 Gateway 核心代码
   - 无需修改其他 Channel 的代码

---

### 类比理解

**Channel 就像不同的"翻译器"**：

```
Telegram 消息（俄语）
  ↓
Telegram Channel Plugin（俄语翻译器）
  ↓
统一格式（英语）
  ↓
Gateway 处理（只懂英语）

WhatsApp 消息（中文）
  ↓
WhatsApp Channel Plugin（中文翻译器）
  ↓
统一格式（英语）
  ↓
Gateway 处理（只懂英语）

Discord 消息（日语）
  ↓
Discord Channel Plugin（日语翻译器）
  ↓
统一格式（英语）
  ↓
Gateway 处理（只懂英语）
```

**关键**：
- 每个外部服务说"不同的语言"（不同的协议）
- 每个 Channel Plugin 是"专门的翻译器"
- Gateway 只需要理解"统一的语言"（统一格式）
- 添加新服务 = 添加新翻译器

---

### 回答你的问题

**问题**：接入 Telegram 和 WhatsApp，所用的 Channel 是一样的吗？

**答案**：**不一样！**

- Telegram 使用 `extensions/telegram/` 的 Telegram Channel Plugin
- WhatsApp 使用 `extensions/whatsapp/` 的 WhatsApp Channel Plugin
- 它们是完全独立的实现
- 它们只是都遵循相同的 `ChannelPlugin` 接口
- Gateway 通过统一接口调用它们，但底层实现完全不同

**证据**：
1. 独立的插件文件：`extensions/telegram/` vs `extensions/whatsapp/`
2. 独立的 Channel ID：`"telegram"` vs `"whatsapp"`
3. 独立的能力声明：Telegram 支持 4 种聊天类型，WhatsApp 只支持 2 种
4. 独立的配置路径：`channels.telegram` vs `channels.whatsapp`
5. 独立的注册：`api.registerChannel({ plugin: telegramPlugin })` vs `api.registerChannel({ plugin: whatsappPlugin })`

**结论**：每个外部服务都需要自己专属的 Channel Plugin！
