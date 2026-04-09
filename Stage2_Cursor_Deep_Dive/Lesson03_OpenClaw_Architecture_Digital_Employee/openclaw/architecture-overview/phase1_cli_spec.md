# Phase 1：客户端层（CLI / WebUI / macOS / iOS / Android）与 Gateway 通信架构解析

## 0. 分析范围与目标

本文只聚焦你定义的“第一层客户端”，不下钻到函数细节，重点回答两件事：

1. 不同客户端虽然都通过 Gateway 通信，但在构建与集成上有哪些共性和差异。
2. 如果要接入/二开一个新客户端，应该从哪些配置和功能点开始。

核心证据文件（节选）：

- CLI 与网关调用：`src/gateway/client.ts`、`src/gateway/call.ts`、`src/cli/gateway-rpc.ts`
- Gateway 握手/鉴权/授权：`src/gateway/server/ws-connection/message-handler.ts`、`src/gateway/auth.ts`、`src/gateway/server-methods.ts`
- WebUI 通信：`ui/src/ui/gateway.ts`、`ui/src/ui/app-gateway.ts`、`ui/src/ui/storage.ts`
- WebUI 构建与托管：`ui/vite.config.ts`、`scripts/ui.js`、`src/infra/control-ui-assets.ts`、`src/gateway/control-ui.ts`、`src/gateway/server-http.ts`
- Apple 端共享通信层：`apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayChannel.swift`
- macOS：`apps/macos/Package.swift`、`apps/macos/Sources/OpenClaw/MenuBar.swift`、`apps/macos/Sources/OpenClaw/GatewayConnection.swift`、`apps/macos/Sources/OpenClaw/NodeMode/MacNodeModeCoordinator.swift`
- iOS：`apps/ios/project.yml`、`apps/ios/Sources/Gateway/GatewayConnectionController.swift`、`apps/ios/Sources/Model/NodeAppModel.swift`
- Android：`apps/android/app/build.gradle.kts`、`apps/android/app/src/main/java/ai/openclaw/android/gateway/GatewaySession.kt`、`apps/android/app/src/main/java/ai/openclaw/android/NodeRuntime.kt`
- 协议与版本：`src/gateway/protocol/client-info.ts`、`src/gateway/protocol/schema/protocol-schemas.ts`、`scripts/protocol-gen.ts`、`scripts/protocol-gen-swift.ts`

---

## 1. 客户端模块分层（Phase 1）

### 1.1 客户端类型与代码落点

| 客户端 | 主要代码目录/入口 | 运行定位 |
| --- | --- | --- |
| CLI | `openclaw.mjs`、`src/entry.ts`、`src/cli/*`、`src/commands/*` | 命令编排 + 通过 Gateway RPC 调用服务 |
| Web Control UI | `ui/src/main.ts`、`ui/src/ui/*` | 浏览器控制台（聊天/配置/状态/审批） |
| macOS 菜单栏 App | `apps/macos/Sources/OpenClaw/*`、`apps/shared/OpenClawKit/*` | 桌面主控客户端（本地/远程模式、系统集成） |
| iOS App | `apps/ios/Sources/*`、`apps/shared/OpenClawKit/*` | 移动端控制 + 设备能力节点 |
| Android App | `apps/android/app/src/main/java/ai/openclaw/android/*` | 移动端控制 + 设备能力节点 |
| macOS CLI（原生） | `apps/macos/Sources/OpenClawMacCLI/*` | Swift 实现的辅助连接/探测 CLI |

### 1.2 统一后端入口

所有客户端最终都进入同一个 Gateway 服务面：

- WS：请求/响应/事件通道（`connect` 握手后进入 RPC）
- HTTP：Control UI 静态资源、OpenAI 兼容 API、hooks、插件路由

Gateway 装配核心：`src/gateway/server.impl.ts`
HTTP/WS 接入：`src/gateway/server-http.ts`

---

## 2. “同一协议面”下的客户端共性

### 2.1 传输与握手共性

所有客户端共用同一条通信骨架：

1. 建立 `ws://` 或 `wss://` 连接。
2. 首帧必须是 `req/connect`（服务端在 `message-handler.ts` 强制检查）。
3. 发送统一 `connect` 参数：
   - `minProtocol/maxProtocol`
   - `client`（`id/version/platform/mode/instanceId`）
   - `role/scopes`
   - `auth`（token/password）
   - `device`（设备签名身份，按端能力可选）
4. 收到 `hello-ok` 后进入正常 RPC + 事件流。

协议版本主线当前是 `3`：

- TS 服务端协议常量：`src/gateway/protocol/schema/protocol-schemas.ts`
- Android 常量：`apps/android/.../GatewayProtocol.kt`
- Swift 常量由脚本生成：`scripts/protocol-gen-swift.ts` -> `OpenClawProtocol/GatewayModels.swift`

### 2.2 安全与鉴权共性

所有客户端都遵循相同的鉴权模型（只是实现细节不同）：

- 共享密钥鉴权：`token` 或 `password`
- 设备身份鉴权：设备公私钥签名 + nonce challenge（`connect.challenge`）
- 设备配对/设备 token：未配对会触发 pairing 流程
- TLS 指纹校验（wss 场景）

服务端统一策略入口：

- 鉴权：`src/gateway/auth.ts`
- 握手 + 设备校验 + pairing：`src/gateway/server/ws-connection/message-handler.ts`
- 方法级 scope 授权：`src/gateway/server-methods.ts`

### 2.3 连接生命周期共性

各客户端都实现了：

- 自动重连（指数退避）
- pending request 管理（请求-响应匹配）
- 事件序列检测（event gap）
- 连接失败后的降级或回退（如 token 回退、重建会话）

---

## 3. 构建链路：共性与差异

### 3.1 构建共性

1. 全仓统一由根 `package.json` 编排多端构建脚本（`ui:*`、`ios:*`、`android:*`、`mac:*`）。
2. 客户端与 Gateway 的“协议契约”统一维护，Swift 端通过脚本生成模型；TS 与 WebUI 共享部分协议常量。
3. 都围绕同一 Gateway 端口/协议，不是每端一套后端。

### 3.2 构建差异矩阵

| 客户端 | 构建工具链 | 构建入口 | 产物 |
| --- | --- | --- | --- |
| CLI | Node/Bun + TS | 根脚本 `openclaw` / `build` | `dist/*` + `openclaw.mjs` |
| WebUI | Vite | `ui/package.json` + `scripts/ui.js` + `pnpm ui:build` | `dist/control-ui` 静态资源 |
| macOS App | SwiftPM | `apps/macos/Package.swift` | `OpenClaw.app` + `openclaw-mac` |
| iOS App | XcodeGen + Xcode | `apps/ios/project.yml` + 根脚本 `ios:*` | iOS App |
| Android App | Gradle + Kotlin/Compose | `apps/android/app/build.gradle.kts` + 根脚本 `android:*` | APK |

### 3.3 WebUI 的特殊点

WebUI 不是独立后端，它是由 Gateway 托管的静态前端：

- 构建输出：`dist/control-ui`
- Gateway 启动时会检查/必要时自动构建 Control UI 资源：`src/infra/control-ui-assets.ts`
- HTTP 分发入口：`src/gateway/control-ui.ts` + `src/gateway/server-http.ts`

---

## 4. 各客户端的关键异同（围绕 Gateway）

## 4.1 CLI（TS）

- 主路径：CLI 命令 -> `callGateway` -> `GatewayClient`
- 默认角色偏 operator，适合管理类操作
- 支持 `expectFinal`（agent 异步结果场景）
- 与服务端协议一致性最好（同仓 TS）

关键文件：`src/cli/gateway-rpc.ts`、`src/gateway/call.ts`、`src/gateway/client.ts`

## 4.2 WebUI（Browser）

- `GatewayBrowserClient` 直接在浏览器里走 WS
- 同样先 `connect` 握手，再收发 RPC/event
- 设备身份依赖 `crypto.subtle`（HTTPS/localhost）
- 本地持久化 gatewayUrl/token/session 等设置
- 受 `gateway.controlUi.allowedOrigins` 与安全策略约束

关键文件：`ui/src/ui/gateway.ts`、`ui/src/ui/storage.ts`、`src/gateway/server/ws-connection/message-handler.ts`

## 4.3 macOS（菜单栏 App + Node Mode）

- Operator 控制连接由 `GatewayConnection` 统一管理
- 另外有 `MacNodeModeCoordinator` 以 `role=node` 连接 Gateway（能力上报 + node.invoke）
- 支持本地/远程模式切换、SSH/直连远程配置、TLS pinning
- 同时提供 `openclaw-mac` CLI 做连接探测/向导

关键文件：

- `apps/macos/Sources/OpenClaw/GatewayConnection.swift`
- `apps/macos/Sources/OpenClaw/NodeMode/MacNodeModeCoordinator.swift`
- `apps/macos/Sources/OpenClaw/GatewayEndpointStore.swift`
- `apps/macos/Sources/OpenClawMacCLI/ConnectCommand.swift`

## 4.4 iOS（双会话模型）

- 明确维护两条会话：
  - `role=node`：设备能力/`node.invoke.*`
  - `role=operator`：chat/talk/config/voicewake
- 自动发现网关、自动重连、TLS 指纹持久化、Keychain 存 token/password
- 适合“控制 + 设备节点”合一形态

关键文件：

- `apps/ios/Sources/Gateway/GatewayConnectionController.swift`
- `apps/ios/Sources/Model/NodeAppModel.swift`
- `apps/ios/Sources/Gateway/GatewayConnectConfig.swift`
- `apps/ios/Sources/Gateway/GatewaySettingsStore.swift`

## 4.5 Android（双会话模型）

- 与 iOS 类似：`operatorSession + nodeSession`
- `NodeRuntime` 统一组装 connect options（caps/commands/permissions）
- `SecurePrefs` 保存网关地址、token/password、manual 模式与 TLS 指纹
- WebSocket 底层使用 OkHttp，TLS 指纹校验支持 TOFU

关键文件：

- `apps/android/.../gateway/GatewaySession.kt`
- `apps/android/.../NodeRuntime.kt`
- `apps/android/.../SecurePrefs.kt`
- `apps/android/.../gateway/GatewayTls.kt`

---

## 5. 客户端与 Gateway 的服务依赖关系

## 5.1 统一调用链（高层）

客户端（CLI/WebUI/macOS/iOS/Android）
-> Gateway WS/HTTP 接入层（`server-http.ts` + WS handler）
-> 方法分发层（`server-methods.ts`）
-> 业务处理模块（chat/config/channels/node/cron/skills/...）
-> 配置/插件/渠道/Agent 运行时（`src/config`、`src/plugins`、`src/channels`、`src/agents`）

## 5.2 Node 能力型客户端特有链路

Gateway 收到 `node.invoke`
-> 下发到 node 角色会话
-> 客户端执行设备能力命令（camera/screen/location/...）
-> 回传 `node.invoke.result` / `node.event`
-> operator 侧客户端收到事件并更新 UI

## 5.3 外部依赖接口（和客户端最相关）

- WS/WSS（统一 RPC 协议）
- TLS 指纹校验与证书信任
- mDNS/Bonjour + Tailnet 发现（移动端/桌面端）
-（可选）SSH 隧道（macOS remote）

---

## 6. 二次开发接入指南：新增/改造客户端要做什么

## 6.1 必做配置项（Gateway 侧）

优先检查 `src/config/types.gateway.ts` 中这些键：

1. `gateway.mode`：`local` / `remote`
2. `gateway.port`、`gateway.bind`、`gateway.customBindHost`
3. `gateway.auth.mode` + `gateway.auth.token/password`
4. `gateway.remote.url/token/password/tlsFingerprint/transport`（远程客户端必看）
5. `gateway.tls.enabled/certPath/keyPath`
6. `gateway.controlUi.allowedOrigins`
7. `gateway.controlUi.allowInsecureAuth`（仅特殊场景）
8. `gateway.controlUi.dangerouslyDisableDeviceAuth`（高风险，不建议常规开启）
9. `gateway.trustedProxies`（有反向代理时）

## 6.2 新客户端最小接入清单（协议层）

1. 连接：实现 WS 客户端 + 自动重连。
2. 握手：首帧 `req/connect`，并带 `protocol/client/role/scopes`。
3. 鉴权：至少支持 token/password；建议支持 device identity + nonce。
4. 安全：wss + TLS 指纹校验（至少支持 expected fingerprint）。
5. 事件循环：处理 `event`、序列 gap、`connect.challenge`。
6. 请求模型：统一 `req/res` id 关联、超时控制、错误透传。

## 6.3 按客户端类型的二开切入点

### A. 只做“操作端/管理端”客户端（Operator）

从这些点入手：

1. 角色与 scope：`role=operator`，按需要申请 `operator.read/write/admin/approvals/pairing`。
2. 方法优先级：先打通 `health`、`status`、`chat.send`、`config.get/config.patch`。
3. UI 事件订阅：`chat`、`agent`、`presence`、`device.pair.*`、`exec.approval.*`。

参考实现：`ui/src/ui/gateway.ts`、`apps/macos/Sources/OpenClaw/GatewayConnection.swift`

### B. 做“设备能力端/节点端”客户端（Node）

从这些点入手：

1. 角色：`role=node`。
2. 能力声明：`caps`、`commands`、`permissions`。
3. 指令回路：实现 `node.invoke` 执行器，回传 `node.invoke.result`。
4. 设备事件：上报 `node.event`。

参考实现：`apps/ios/Sources/Gateway/GatewayConnectionController.swift`（node connect options）、`apps/android/.../NodeRuntime.kt`、`apps/macos/.../MacNodeModeCoordinator.swift`

### C. 做“混合端”（同端既 Operator 又 Node）

建议直接采用双会话模型：

1. operator 会话：承载聊天/配置/管理。
2. node 会话：承载设备命令执行。
3. 两条会话使用同一 endpoint 配置，但状态分离。

参考：`apps/ios/Sources/Model/NodeAppModel.swift`、`apps/android/.../NodeRuntime.kt`

## 6.4 构建与发布接入点

1. Web 客户端：复用 `ui` 构建链（`scripts/ui.js` + Vite），让 Gateway 托管静态资源。
2. Apple 客户端：优先复用 `apps/shared/OpenClawKit`，避免重复造 WebSocket/鉴权轮子。
3. Android 客户端：当前协议常量在 Kotlin 侧手工维护，升级协议版本时要同步检查 `GatewayProtocol.kt`。
4. 协议演进：运行 `protocol:gen` / `protocol:gen:swift`，确保 Swift 模型与服务端一致。

## 6.5 联调验证顺序（建议）

1. 先用 CLI 验证 Gateway 基础可达：`health/status`。
2. 再验证新客户端 `connect` 成功（含 role/scope）。
3. 验证目标方法调用（operator 或 node 方向）。
4. 验证断线重连、token 轮换、TLS 指纹不匹配处理。
5. 最后验证安全边界：origin、pairing、scopes 拒绝路径。

---

## 7. 结论（Phase 1 设计思路）

这个项目在客户端层的核心设计不是“每端独立协议”，而是“多终端共用一个 Gateway 协议面 + 各端按形态实现不同会话策略”。

- 共性被收敛在：`connect` 协议、鉴权、授权、事件流。
- 差异被留在：构建工具链、会话编排（单会话/双会话）、本地配置持久化、平台能力封装。

对二次开发来说，最关键不是先做 UI，而是先把以下三件事做对：

1. `connect` 参数与 role/scope 设计。
2. 鉴权/配对/TLS 的安全闭环。
3. operator 与 node 能力边界（是否双会话）。
