# Gateway 组件深度分析

## 一、Gateway 的核心定位

**Gateway 不仅仅是"转发器"，而是整个系统的"控制平面"（Control Plane）**

你的理解"接收不同客户端，然后给到后端 Agent 执行"是对的，但这只是 Gateway 职责的一部分。Gateway 实际上承担了以下核心职责：

```
┌─────────────────────────────────────────────────────────────┐
│                    Gateway 核心职责                          │
├─────────────────────────────────────────────────────────────┤
│ 1. 协议处理层    - HTTP/WebSocket 服务器                    │
│ 2. 认证授权层    - 身份验证、权限控制                       │
│ 3. 路由调度层    - 消息路由、会话管理                       │
│ 4. 插件系统层    - 插件加载、工具注册                       │
│ 5. 渠道管理层    - 多渠道统一接入                           │
│ 6. Agent 调度层  - 模型选择、Agent 执行                     │
│ 7. 状态管理层    - 会话持久化、健康监控                     │
│ 8. 事件分发层    - 实时事件推送、订阅管理                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 二、Gateway 的输入（Input）

### 1. HTTP 端点输入

#### a) Control UI（Web 管理界面）
```
GET  /                    - Web UI 首页
GET  /assets/*            - 静态资源
GET  /api/health          - 健康检查
```

**数据格式**：标准 HTTP 请求
**来源**：浏览器访问

---

#### b) OpenAI 兼容接口
```
POST /v1/chat/completions - OpenAI 格式的聊天接口
```

**数据格式**：
```json
{
  "model": "gpt-4",
  "messages": [
    {"role": "user", "content": "Hello"}
  ],
  "stream": true
}
```

**来源**：任何支持 OpenAI API 的客户端（Cursor、Continue、ChatGPT UI 等）

---

#### c) OpenResponses 接口
```
POST /v1/responses        - OpenResponses 格式的接口
```

**数据格式**：
```json
{
  "prompt": "Hello",
  "model": "claude-opus-4"
}
```

**来源**：支持 OpenResponses 协议的客户端

---

#### d) Hooks/Webhooks
```
POST /hooks/wake          - 唤醒 Hook
POST /hooks/agent         - Agent 调用 Hook
POST /hooks/custom/*      - 自定义 Hook
```

**数据格式**：
```json
{
  "text": "Hello from webhook",
  "channel": "telegram",
  "to": "@username"
}
```

**来源**：外部系统（GitHub Actions、CI/CD、定时任务等）

---

#### e) 渠道特定端点
```
POST /slack/events        - Slack 事件接收
POST /slack/interactions  - Slack 交互接收
```

**来源**：Slack、Discord 等平台的 Webhook

---

### 2. WebSocket 连接输入

#### a) Gateway Protocol（RPC 方法调用）

**连接建立**：
```
ws://localhost:18789/ws
```

**消息格式**：
```json
{
  "jsonrpc": "2.0",
  "id": "req-123",
  "method": "agent.invoke",
  "params": {
    "message": "Hello",
    "agentId": "default",
    "sessionKey": "main"
  }
}
```

**支持的方法**（从 server-methods.ts 分析）：

| 分类 | 方法 | 说明 |
|------|------|------|
| **Agent 相关** | `agent.invoke` | 调用 Agent |
| | `agent.wait` | 等待 Agent 完成 |
| | `agents.list` | 列出所有 Agent |
| | `agent.identity.get` | 获取 Agent 身份 |
| **Chat 相关** | `chat.send` | 发送聊天消息 |
| | `chat.abort` | 中止聊天 |
| | `chat.history` | 获取聊天历史 |
| **渠道相关** | `channels.status` | 获取渠道状态 |
| | `send` | 发送消息到渠道 |
| **配置相关** | `config.get` | 获取配置 |
| | `config.set` | 设置配置 |
| | `config.patch` | 部分更新配置 |
| **会话相关** | `sessions.list` | 列出会话 |
| | `sessions.preview` | 预览会话 |
| **设备相关** | `node.invoke` | 调用设备能力 |
| | `node.list` | 列出设备 |
| | `node.pair.request` | 设备配对请求 |
| **系统相关** | `health` | 健康检查 |
| | `status` | 系统状态 |
| | `logs.tail` | 日志尾随 |
| **Cron 相关** | `cron.list` | 列出定时任务 |
| | `cron.create` | 创建定时任务 |
| **技能相关** | `skills.status` | 技能状态 |
| | `skills.bins` | 技能二进制 |
| **审批相关** | `exec.approval.request` | 命令执行审批请求 |
| | `exec.approval.resolve` | 审批决策 |

**来源**：
- macOS/iOS/Android 客户端
- Web UI
- 第三方集成

---

### 3. 渠道消息输入

#### a) Telegram Bot
```
来自 Telegram 的消息 → Gateway 的 Telegram 渠道处理器
```

**数据格式**：Telegram Bot API 格式
```json
{
  "update_id": 123,
  "message": {
    "chat": {"id": 456, "type": "private"},
    "text": "Hello"
  }
}
```

---

#### b) Slack Bot
```
来自 Slack 的消息 → Gateway 的 Slack 渠道处理器
```

**数据格式**：Slack Events API 格式
```json
{
  "type": "message",
  "channel": "C123",
  "user": "U456",
  "text": "Hello"
}
```

---

#### c) 其他渠道
- Discord Bot
- Signal
- WhatsApp Web
- iMessage（通过 macOS 客户端）

---

## 三、Gateway 的处理流程

### 完整数据流

```
┌─────────────────────────────────────────────────────────────┐
│                    输入层（多种协议）                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  HTTP 请求          WebSocket 消息        渠道消息          │
│  • /v1/chat        • agent.invoke        • Telegram        │
│  • /hooks/agent    • chat.send           • Slack           │
│  • /slack/events   • node.invoke         • Discord         │
│                                                              │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              1. 协议解析与验证层                             │
│  • HTTP 路由解析                                            │
│  • WebSocket RPC 解析                                       │
│  • 渠道消息格式转换                                         │
│  • JSON Schema 验证                                         │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              2. 认证与授权层                                 │
│  • Bearer Token 验证                                        │
│  • 设备配对验证                                             │
│  • 权限范围检查（scopes）                                   │
│  • 角色验证（operator/node/device）                         │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              3. 路由与会话解析层                             │
│  • 渠道识别：channel (telegram/slack/discord...)           │
│  • 账号识别：accountId (Bot Token/用户账号)                │
│  • 对话识别：peer (群组/私聊/频道)                          │
│  • 路由匹配：根据 bindings 配置匹配 Agent                   │
│  • 会话构建：生成 sessionKey                                │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              4. 插件与工具注册层                             │
│  • 加载插件：extensions/*                                   │
│  • 注册工具：Bash/Read/Write/Camera/Screen...              │
│  • 注册 Hooks：pre-agent/post-agent/tool-call...           │
│  • 注册渠道：自定义渠道插件                                 │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              5. Agent 调度层                                 │
│  • 加载会话历史                                             │
│  • 选择模型：Claude/GPT/Gemini...                           │
│  • 认证管理：API Key/OAuth Token 轮换                       │
│  • 构建系统提示词                                           │
│  • 注入工具定义                                             │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              6. Agent 执行层                                 │
│  • 调用 AI 模型 API                                         │
│  • 流式响应处理                                             │
│  • 工具调用执行                                             │
│  • 子代理管理                                               │
│  • 错误处理与重试                                           │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              7. 工具执行层                                   │
│  • Bash：执行系统命令                                       │
│  • Read/Write：文件操作                                     │
│  • Camera：请求设备拍照                                     │
│  • Screen：请求设备截图                                     │
│  • 插件工具：自定义工具                                     │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              8. 设备能力请求层                               │
│  • 查找可用设备：根据能力匹配                               │
│  • 发送请求：通过 WebSocket 请求设备                        │
│  • 等待响应：异步等待设备返回                               │
│  • 审批流程：敏感操作需要用户批准                           │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              9. 结果处理与持久化层                           │
│  • 会话保存：持久化到文件系统                               │
│  • 使用量统计：记录 Token 使用                              │
│  • 日志记录：结构化日志                                     │
│  • 事件发布：发布到订阅者                                   │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              10. 结果分发层                                  │
│  • 格式转换：根据来源格式化响应                             │
│  • 流式推送：实时推送到客户端                               │
│  • 多端同步：同一会话的多个客户端                           │
│  • 渠道发送：发送到 Telegram/Slack 等                       │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    输出层（多种格式）                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  HTTP 响应          WebSocket 消息        渠道消息          │
│  • JSON 响应       • RPC 响应            • Telegram 消息   │
│  • 流式响应        • 事件推送            • Slack 消息      │
│  • SSE 流          • 设备请求            • Discord 消息    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 四、Gateway 的输出（Output）

### 1. HTTP 响应输出

#### a) JSON 响应
```json
{
  "result": {
    "message": "Hello, how can I help?",
    "sessionKey": "main",
    "usage": {
      "inputTokens": 10,
      "outputTokens": 20
    }
  }
}
```

---

#### b) 流式响应（SSE）
```
data: {"type":"text","text":"Hello"}

data: {"type":"text","text":" world"}

data: {"type":"done"}
```

---

### 2. WebSocket 消息输出

#### a) RPC 响应
```json
{
  "jsonrpc": "2.0",
  "id": "req-123",
  "result": {
    "message": "Hello, how can I help?",
    "sessionKey": "main"
  }
}
```

---

#### b) 事件推送
```json
{
  "jsonrpc": "2.0",
  "method": "agent.event",
  "params": {
    "type": "text",
    "text": "Hello",
    "sessionKey": "main"
  }
}
```

---

#### c) 设备能力请求
```json
{
  "jsonrpc": "2.0",
  "method": "node.invoke",
  "params": {
    "capability": "camera.capture",
    "reason": "User requested via Telegram"
  }
}
```

---

### 3. 渠道消息输出

#### a) Telegram 消息
```
Gateway → Telegram Bot API
POST https://api.telegram.org/bot{token}/sendMessage
{
  "chat_id": 123,
  "text": "Hello, how can I help?"
}
```

---

#### b) Slack 消息
```
Gateway → Slack Web API
POST https://slack.com/api/chat.postMessage
{
  "channel": "C123",
  "text": "Hello, how can I help?"
}
```

---

## 五、关键组件详解

### 1. 路由解析器（Routing Resolver）

**文件**：`src/routing/resolve-route.ts`

**功能**：根据消息来源解析出对应的 Agent 和会话

**输入**：
```typescript
{
  channel: "telegram",      // 渠道
  accountId: "bot-token",   // 账号
  peer: {                   // 对话对象
    kind: "group",
    id: "123456"
  }
}
```

**输出**：
```typescript
{
  agentId: "coding-agent",  // 匹配的 Agent
  sessionKey: "telegram:bot-token:group:123456",  // 会话 Key
  matchedBy: "binding.peer" // 匹配方式
}
```

**匹配优先级**：
1. Peer 绑定（最精确）
2. Guild/Team 绑定
3. Account 绑定
4. Channel 绑定
5. 默认 Agent

---

### 2. 方法处理器（Method Handlers）

**文件**：`src/gateway/server-methods.ts`

**功能**：处理 WebSocket RPC 方法调用

**结构**：
```typescript
const coreGatewayHandlers = {
  // Agent 相关
  ...agentHandlers,      // agent.invoke, agent.wait
  ...agentsHandlers,     // agents.list

  // Chat 相关
  ...chatHandlers,       // chat.send, chat.abort, chat.history

  // 渠道相关
  ...channelsHandlers,   // channels.status
  ...sendHandlers,       // send

  // 配置相关
  ...configHandlers,     // config.get, config.set, config.patch

  // 会话相关
  ...sessionsHandlers,   // sessions.list, sessions.preview

  // 设备相关
  ...nodeHandlers,       // node.invoke, node.list, node.pair.*
  ...deviceHandlers,     // device.pair.*

  // 系统相关
  ...healthHandlers,     // health
  ...systemHandlers,     // status
  ...logsHandlers,       // logs.tail

  // Cron 相关
  ...cronHandlers,       // cron.list, cron.create

  // 技能相关
  ...skillsHandlers,     // skills.status, skills.bins

  // 审批相关
  ...execApprovalsHandlers, // exec.approval.*

  // 其他
  ...ttsHandlers,        // tts.*
  ...voicewakeHandlers,  // voicewake.*
  ...browserHandlers,    // browser.request
  ...webHandlers,        // web.*
  ...wizardHandlers,     // wizard.*
  ...updateHandlers,     // update.*
  ...modelsHandlers,     // models.list
  ...talkHandlers,       // talk.mode
};
```

---

### 3. 权限控制（Authorization）

**文件**：`src/gateway/server-methods.ts`

**角色**：
- `operator`：操作员（默认，Web UI/客户端）
- `node`：设备节点（macOS/iOS 客户端）
- `device`：设备（配对的设备）

**权限范围（Scopes）**：
- `operator.admin`：管理员权限
- `operator.read`：只读权限
- `operator.write`：写入权限
- `operator.approvals`：审批权限
- `operator.pairing`：配对权限

**权限检查**：
```typescript
function authorizeGatewayMethod(method: string, client: Client) {
  const role = client.connect.role ?? "operator";
  const scopes = client.connect.scopes ?? [];

  // 检查角色
  if (NODE_ROLE_METHODS.has(method)) {
    if (role === "node") return true;
  }

  // 检查权限范围
  if (READ_METHODS.has(method)) {
    if (scopes.includes("operator.read")) return true;
  }

  // ... 更多检查
}
```

---

### 4. 渠道管理器（Channel Manager）

**文件**：`src/gateway/server-channels.ts`

**功能**：
- 启动和停止渠道连接
- 管理渠道状态
- 处理渠道消息
- 渠道健康检查

**支持的渠道**：
- Telegram
- Slack
- Discord
- Signal
- WhatsApp Web
- iMessage（通过 macOS 客户端）
- Web（内置 Web 渠道）
- 自定义渠道（通过插件）

---

### 5. 插件系统（Plugin System）

**文件**：`src/gateway/server-plugins.ts`

**功能**：
- 发现和加载插件
- 注册插件能力
- 管理插件生命周期

**插件类型**：
- 工具插件（Tools）
- 渠道插件（Channels）
- Hooks 插件
- HTTP 路由插件
- Gateway 方法插件

---

### 6. 会话管理器（Session Manager）

**功能**：
- 会话创建和恢复
- 会话持久化（文件系统）
- 会话历史管理
- 会话并发控制

**会话 Key 格式**：
```
{agentId}:{channel}:{accountId}:{peerKind}:{peerId}
```

**示例**：
```
default:telegram:bot-token:group:123456
coding-agent:slack:workspace-id:channel:C123
```

---

### 7. 事件系统（Event System）

**功能**：
- 发布/订阅模式
- 实时事件推送
- 多端同步

**事件类型**：
- `agent.event`：Agent 执行事件
- `chat.message`：聊天消息
- `node.event`：设备事件
- `health.update`：健康状态更新
- `presence.update`：在线状态更新

---

## 六、典型处理流程示例

### 示例 1：用户在 Telegram 发消息

```
1. Telegram Bot 接收消息
   ↓
2. Gateway 的 Telegram 渠道处理器接收
   {
     "channel": "telegram",
     "accountId": "bot-token",
     "peer": {"kind": "group", "id": "123456"},
     "text": "Hello"
   }
   ↓
3. 路由解析
   resolveAgentRoute() → {
     agentId: "default",
     sessionKey: "default:telegram:bot-token:group:123456"
   }
   ↓
4. 加载会话历史
   loadSession(sessionKey) → 历史消息
   ↓
5. Agent 调度
   - 选择模型：Claude Opus 4.6
   - 加载工具：Bash, Read, Write
   - 构建系统提示词
   ↓
6. 调用 AI 模型
   Anthropic API → "Hello, how can I help?"
   ↓
7. 保存会话
   saveSession(sessionKey, messages)
   ↓
8. 发送到 Telegram
   Telegram Bot API → sendMessage()
```

---

### 示例 2：macOS 客户端请求 Agent

```
1. macOS 客户端发送 WebSocket 消息
   {
     "method": "agent.invoke",
     "params": {
       "message": "帮我看看这个错误",
       "attachments": [{"type": "image", "data": "..."}]
     }
   }
   ↓
2. Gateway 接收并验证
   - 验证 Bearer Token
   - 检查权限：operator.write
   ↓
3. 路由解析
   - 使用默认 Agent
   - 生成 sessionKey
   ↓
4. Agent 执行
   - 调用 Claude API
   - Claude 分析截图
   ↓
5. 返回结果
   {
     "result": {
       "message": "这是一个 TypeScript 类型错误..."
     }
   }
   ↓
6. macOS 客户端接收并显示
```

---

### 示例 3：跨设备协作

```
1. 用户在 Slack 发消息："帮我拍一张照片"
   ↓
2. Gateway 接收 Slack 消息
   ↓
3. Agent 执行
   - Claude 理解需要摄像头
   - 生成工具调用：Camera.capture
   ↓
4. Gateway 查找可用设备
   - 发现 iOS 客户端在线
   - 检查能力：有 camera 能力
   ↓
5. Gateway 请求 iOS 客户端
   WebSocket → {
     "method": "node.invoke",
     "params": {
       "capability": "camera.capture"
     }
   }
   ↓
6. iOS 客户端处理
   - 弹出权限确认
   - 用户批准
   - 拍照并上传
   ↓
7. Gateway 接收照片
   ↓
8. Agent 继续执行
   - Claude 分析照片
   ↓
9. 结果返回到 Slack
```

---

## 七、Gateway 的关键特性

### 1. 多协议支持
- HTTP/HTTPS
- WebSocket
- SSE（Server-Sent Events）
- 各渠道的 Webhook

### 2. 统一路由
- 所有消息统一路由到 Agent
- 支持复杂的绑定规则
- 会话隔离和管理

### 3. 插件化扩展
- 工具插件
- 渠道插件
- Hooks 插件
- HTTP 路由插件

### 4. 安全控制
- 认证（Bearer Token、设备配对）
- 授权（角色和权限范围）
- 审批流程（敏感操作）

### 5. 高可用性
- 健康检查
- 自动重连
- 错误恢复
- 优雅关闭

### 6. 可观测性
- 结构化日志
- 使用量统计
- 性能监控
- 事件追踪

---

## 八、总结

### Gateway 的本质

**Gateway 是一个"智能路由器 + 控制平面 + 编排引擎"**

1. **智能路由器**：
   - 接收多种协议的输入
   - 统一路由到正确的 Agent
   - 分发结果到各个端点

2. **控制平面**：
   - 管理所有渠道连接
   - 管理所有设备节点
   - 管理所有会话状态

3. **编排引擎**：
   - 编排 Agent 执行
   - 编排工具调用
   - 编排设备能力请求

### 你的理解修正

**原理解**："Gateway 接收不同客户端，然后给到后端 Agent 执行"

**更准确的理解**：

"Gateway 是整个系统的控制中心，它：
1. 接收来自多种来源的输入（客户端、渠道、Webhooks）
2. 进行认证、授权、路由解析
3. 调度 Agent 执行（包括模型选择、工具注册）
4. 协调设备能力请求（跨设备协作）
5. 管理会话状态和持久化
6. 分发结果到各个端点
7. 提供插件扩展能力
8. 监控系统健康状态"

**类比**：
- Gateway 不是简单的"转发器"
- 而是像"交通指挥中心 + 任务调度中心 + 资源管理中心"的综合体
