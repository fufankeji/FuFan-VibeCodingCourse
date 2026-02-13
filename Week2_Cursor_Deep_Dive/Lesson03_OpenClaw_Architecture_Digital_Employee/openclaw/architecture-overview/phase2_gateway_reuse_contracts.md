# Phase 2：Gateway 可复用架构与多客户端对接规范（源码版）

## 0. 结论先行

你的判断是成立的：

- 在当前架构下，**Gateway 是可被 WebUI、macOS、iOS、Android、CLI 复用的统一后端**。
- 客户端差异主要发生在：
  - 连接参数（`clientId/clientMode/role/scopes/caps/commands`）
  - 鉴权路径（token/password/device identity）
  - 本地能力实现（node.invoke 的执行侧）
- 只要新客户端严格遵守现有协议与安全约束，后端基本可 100% 复用。

---

## 1. Gateway 的标准接入方式与核心功能模块

## 1.1 标准接入方式（统一入口）

Gateway 对外统一提供两类入口：

1. **WebSocket（主入口）**
   - 用于 `connect` 握手、RPC 请求/响应、事件推送。
   - 入口装配：`src/gateway/server-ws-runtime.ts` -> `src/gateway/server/ws-connection.ts`。

2. **HTTP（补充入口）**
   - 用于 Control UI 静态资源托管、OpenAI 兼容 API、Hooks、插件路由等。
   - 入口装配：`src/gateway/server-http.ts`。

核心启动装配：`src/gateway/server.impl.ts`（统一把配置、鉴权、WS/HTTP、插件、channels、cron、health、reload 串起来）。

## 1.2 Gateway 核心模块划分（按源码职责）

### A. 启动与运行时装配

- `src/gateway/server.impl.ts`
- `src/gateway/server-runtime-config.ts`
- `src/gateway/server.ts`

职责：

- 读取并解析网关配置、决定 bind/auth/tailscale/control-ui/http endpoints。
- 启动 HTTP/WS、加载插件与渠道扩展、初始化运行时上下文。

### B. 连接接入层（WS/HTTP）

- WS：`src/gateway/server/ws-connection.ts`、`src/gateway/server/ws-connection/message-handler.ts`
- HTTP：`src/gateway/server-http.ts`

职责：

- 建立连接、发放 challenge、处理握手、读写帧、请求分发。
- 统一把 HTTP 请求路由到 control-ui/openai/hooks/plugin/tools 等路径。

### C. 协议与契约层

- `src/gateway/protocol/schema/*`
- `src/gateway/protocol/schema/protocol-schemas.ts`
- `src/gateway/server-methods-list.ts`

职责：

- 定义帧结构、connect 参数、事件/方法 schema、协议版本。
- 汇总可调用 methods 与可订阅 events。

### D. 安全与鉴权层

- `src/gateway/auth.ts`
- `src/gateway/origin-check.ts`
- `src/gateway/server/ws-connection/message-handler.ts`
- `src/gateway/server-methods.ts`

职责：

- token/password/tailscale/device-token/device-signature 的授权判定。
- Control UI origin 校验。
- role/scope 的方法访问控制。

### E. 业务方法分发层

- `src/gateway/server-methods.ts`
- `src/gateway/server-methods/*`

职责：

- 把请求方法映射到 chat/config/channels/node/cron/skills/sessions/device/wizard 等业务 handler。

### F. 状态与事件广播层

- `src/gateway/server/health-state.ts`
- `src/gateway/server-broadcast.ts`
- `src/gateway/node-registry.ts`
- `src/gateway/server-node-subscriptions.ts`

职责：

- 维护 presence/health/stateVersion。
- 广播全局事件与会话定向事件。
- 管理 node 连接和 node.invoke 路由。

### G. 扩展与集成层

- `src/gateway/server-plugins.ts`
- `src/gateway/server-channels.ts`
- `src/gateway/server-methods-list.ts`（叠加 channel plugin methods）

职责：

- 扩展 gateway methods/events/router。
- 保持核心 + 插件通道的统一调用面。

---

## 2. 客户端对接时的输入/输出接口规范

下面是“客户端与 Gateway 对接”真正要遵守的 IO 契约。

## 2.1 帧级别协议规范（统一）

定义来源：`src/gateway/protocol/schema/frames.ts`

### 输入给 Gateway（客户端 -> Gateway）

1. `req` 帧

- 结构：`{ type: "req", id, method, params? }`
- 第一帧必须是 `method=connect`。

2. `connect` 参数（`ConnectParams`）

- 必须字段：
  - `minProtocol/maxProtocol`
  - `client.id/version/platform/mode`
- 常用字段：
  - `role/scopes`
  - `auth.token/password`
  - `device.id/publicKey/signature/signedAt/nonce`
  - `caps/commands/permissions`

### 输出给客户端（Gateway -> 客户端）

1. `hello-ok`（`connect` 成功响应 payload）

- 关键字段：
  - `protocol`
  - `server`（version/host/connId）
  - `features.methods/events`
  - `snapshot`（presence/health/stateVersion）
  - `policy`（maxPayload/maxBufferedBytes/tickIntervalMs）
  - `auth.deviceToken`（当启用设备 token 时）

2. `res` 帧

- 通用响应：`{ type:"res", id, ok, payload?, error? }`

3. `event` 帧

- 推送：`{ type:"event", event, payload?, seq?, stateVersion? }`

## 2.2 握手流程规范（重要）

实际流程（服务端见 `src/gateway/server/ws-connection.ts` 与 `message-handler.ts`）：

1. 建立 WS 连接后，Gateway 先发 `event: connect.challenge`（含 nonce）。
2. 客户端发送 `req/connect`，可携带 device 签名与 nonce。
3. 服务端验证：
   - 协议版本
   - role 合法性
   - origin（webchat/control-ui）
   - auth（token/password/tailscale/device-token）
   - device 身份与配对状态
4. 成功后返回 `hello-ok`，连接进入可用状态。

## 2.3 方法与事件目录规范

定义来源：

- 方法列表：`src/gateway/server-methods-list.ts`
- 分发与授权：`src/gateway/server-methods.ts`

示例方法域：

- 系统：`health`、`status`、`logs.tail`
- 聊天：`chat.send`、`chat.history`、`chat.abort`
- 配置：`config.get/set/patch/schema/apply`
- 节点：`node.list/describe/invoke/invoke.result/event`
- 设备配对：`device.pair.*`、`device.token.*`
- 会话/cron/skills/wizard/update 等

核心事件：

- `connect.challenge`
- `chat`、`agent`、`presence`
- `device.pair.requested/resolved`
- `node.pair.requested/resolved`
- `exec.approval.requested/resolved`
- `tick`、`health`、`shutdown`

## 2.4 角色与作用域规范

权限规则来源：`src/gateway/server-methods.ts`

- `role=node`
  - 只能调用 node 侧方法（如 `node.invoke.result`、`node.event`、`skills.bins`）。
- `role=operator`
  - 调用管理/读写方法，受 scopes 约束：
    - `operator.read`
    - `operator.write`
    - `operator.approvals`
    - `operator.pairing`
    - `operator.admin`（覆盖）

注意：服务端在握手时会给 `operator` 且空 scopes 的连接补默认 `operator.admin`（见 `message-handler.ts`）。

## 2.5 HTTP 接口规范（非 WS 客户端可选）

入口：`src/gateway/server-http.ts`

- Control UI 静态资源：由 Gateway 托管（`src/gateway/control-ui.ts`）
- OpenAI 兼容：`/v1/chat/completions`
- OpenResponses：`/v1/responses`
- Hooks/Tools invoke/插件路由

对于“完整客户端”（WebUI/macOS/iOS/Android）主通道仍是 WS；HTTP 更多是补充能力。

---

## 3. 不同客户端在对接 Gateway 时的接口参数差异（源码落地）

## 3.1 对接参数对比

| 客户端 | clientId / mode | role / scopes | 典型输入方法 | 典型输出事件 |
| --- | --- | --- | --- | --- |
| CLI（TS） | `cli` / `cli`（`src/cli/gateway-rpc.ts`） | 默认 `operator` + 默认 admin | `health/status/cron/node.invoke/...` | `event`（可选处理） |
| WebUI | `openclaw-control-ui` / `webchat`（`ui/src/ui/gateway.ts`） | `operator` + `admin/approvals/pairing` | `chat.send/config.*/skills.*/cron.*` | `chat/agent/presence/device.pair.*` |
| macOS（operator） | 默认 `openclaw-macos` / `ui`（`GatewayChannel.swift` 默认） | `operator` + 默认 admin/approvals/pairing | `chat.*`、`config.*`、`skills.*`、`cron.*` | `snapshot/chat/health/...` |
| macOS（node） | `openclaw-macos` / `node`（`MacNodeModeCoordinator.swift`） | `node` + `caps/commands/permissions` | `node.event`、`node.invoke.result` | `node.invoke.request` |
| iOS（dual） | node: `openclaw-ios` / `node`; operator: UI 会话（`NodeAppModel.swift`） | node: `role=node`; operator: `role=operator` | operator: `chat/config/voicewake`；node: invoke result/event | `chat`、`node.invoke.request`、配对类 |
| Android（dual） | node: `openclaw-android` / `node`; operator: `openclaw-control-ui` / `ui`（`NodeRuntime.kt`） | node: `role=node`; operator: `role=operator` | 与 iOS 类似，双会话分工 | `chat`、`node.invoke.request`、配对类 |

## 3.2 客户端输入输出模式总结

### WebUI

- 输入（到 Gateway）：`chat.send`、`config.set/apply`、`skills.update`、`cron.*` 等。
- 输出（来自 Gateway）：事件驱动 UI 刷新，尤其 `chat/agent/presence` 和配对审批事件。

源码：`ui/src/ui/controllers/*.ts`、`ui/src/ui/app-gateway.ts`

### macOS / iOS / Android（Operator 侧）

- 输入：健康检查、聊天、配置、voicewake、skills、cron、session。
- 输出：hello snapshot + 实时 event，用于 UI 状态同步。

源码：

- macOS：`apps/macos/Sources/OpenClaw/GatewayConnection.swift`
- iOS：`apps/ios/Sources/Model/NodeAppModel.swift`
- Android：`apps/android/app/src/main/java/ai/openclaw/android/chat/ChatController.kt`

### iOS / Android / macOS（Node 侧）

- 输入：接收 `node.invoke.request`，执行本地能力命令（camera/screen/location/...）。
- 输出：`node.invoke.result`、`node.event`。

源码：

- iOS：`NodeAppModel.swift` + Gateway controller
- Android：`GatewaySession.kt` + `NodeRuntime.kt`
- macOS：`MacNodeModeCoordinator.swift`

---

## 4. “新客户端二次开发”必须关注的技术细节

## 4.1 协议与标识一致性

1. 协议版本必须兼容（当前 `PROTOCOL_VERSION=3`）。
2. `client.id` 必须在受支持集合中（`GatewayClientIdSchema` 来源 `src/gateway/protocol/schema/primitives.ts`）。
   - 如果你新增客户端 ID，需要同步扩展：`src/gateway/protocol/client-info.ts`。
   - 否则会在握手阶段报 `invalid connect params`。

## 4.2 鉴权与安全边界

1. token/password 至少支持一种。
2. 建议支持 device identity + nonce challenge（生产环境必需）。
3. wss 场景建议实现 TLS 指纹校验（TOFU 或固定 fingerprint）。
4. 浏览器类客户端需要处理 origin 校验规则（`src/gateway/origin-check.ts`）。

## 4.3 role/scope 与能力声明

1. 纯控制客户端：优先 `role=operator`。
2. 设备能力客户端：`role=node` + 正确声明 `caps/commands/permissions`。
3. 混合客户端：建议双会话（operator + node 分离），降低权限与职责耦合。

## 4.4 连接生命周期健壮性

必须具备：

- 自动重连（带退避）
- 请求超时/取消
- event seq gap 检测
- `connect.challenge` 处理
- `hello-ok` snapshot 初始化

## 4.5 配置与环境适配

新客户端至少要适配这些配置项（`src/config/types.gateway.ts`）：

- `gateway.mode/local|remote`
- `gateway.remote.url/token/password/tlsFingerprint`
- `gateway.auth.mode/token/password`
- `gateway.tls.enabled`
- `gateway.controlUi.allowedOrigins`（web 客户端）
- `gateway.trustedProxies`（经代理转发时）

## 4.6 Node 命令执行边界

如果是 node 客户端，需要特别注意：

- `node.invoke` 命令会受 allowlist/denylist 限制（`src/gateway/node-command-policy.ts`）。
- capability 与 command 声明要和实际能力一致，否则会出现可见但不可执行或安全拒绝。

## 4.7 向后兼容与演进

1. 协议模型变更时，Swift 端要执行 `scripts/protocol-gen-swift.ts` 同步生成模型。
2. Android 侧当前有手工常量（例如 `GatewayProtocol.kt`），版本升级要手动同步。
3. 若引入新客户端类型，除协议 ID 外还要检查服务端方法授权与 UI/文档联动。

---

## 5. 新客户端接入的推荐落地步骤（实操顺序）

1. **先跑通最小握手**：`connect` + `health`。
2. **补齐安全链路**：token/password + device challenge + tls fingerprint。
3. **确定会话模型**：operator 单会话还是 operator/node 双会话。
4. **实现核心方法集**：
   - operator：`chat.send/chat.history/config.get`。
   - node：`node.invoke.result/node.event`。
5. **实现事件消费**：`chat/presence/device.pair/node.pair`。
6. **验证失败路径**：origin 拒绝、scope 缺失、pairing 未通过、协议版本不匹配。

---

## 6. 对你当前问题的直接回答

### 问题 1：Gateway 是否可被 WebUI/macOS 等客户端完全复用

是。当前代码就是以“单 Gateway + 多客户端协议接入”构建的，复用边界清晰，客户端只需遵循协议与鉴权规则即可。

### 问题 2：不同客户端的输入输出接口规范

本质统一：

- 输入：`req` 帧 + `connect` 参数 + 方法参数。
- 输出：`res` 帧 + `event` 帧 + `hello-ok` snapshot/features。

差异主要在 `clientId/mode/role/scopes/caps/commands` 的组合。

### 问题 3：新客户端二开重点

优先级从高到低：

1. 协议一致性（版本、帧、client id）
2. 安全闭环（auth/device/tls/origin）
3. 角色边界（operator vs node vs dual）
4. 连接稳定性（重连、超时、gap）
5. 配置兼容（local/remote/tls/proxy）

