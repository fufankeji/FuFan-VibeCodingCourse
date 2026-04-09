# Phase 2：Gateway 可复用架构与多客户端对接规范（v1.0，源码版）

## 0. 文档目标

本文基于当前 OpenClaw 最新代码，更新 Gateway 模块开发规范，聚焦：

- Gateway 可复用边界与分层职责
- 多客户端统一接入契约（WS/HTTP）
- 安全模型与权限模型
- Node/Device 配对与能力调用链路
- 相比旧版规范的改动与新增能力

适用对象：Gateway 模块开发者、客户端接入开发者、插件/渠道扩展开发者。

---

## 1. 结论先行（最新状态）

1. **Gateway 仍是统一后端控制平面**，可被 CLI/WebUI/macOS/iOS/Android/Node Host 复用。
2. 客户端差异仍集中在：
   - `client.id/mode`
   - `role/scopes/caps/commands`
   - 鉴权路径（token/password/device/trusted-proxy）
   - 本地能力执行面（`node.invoke` 执行器）
3. 与旧版相比，Gateway 已明显增强：
   - 安全：`trusted-proxy`、auth rate limit、更严格握手策略
   - 协议：方法域扩大（agents files、exec approvals、browser、webchat-native chat）
   - 运行时：配置热重载、sidecar 编排、channel health monitor、delivery recovery

---

## 2. Gateway 最新分层与可复用边界

## 2.1 启动装配层（核心中枢）

源码入口：`src/gateway/server.impl.ts`

职责：

- 读取并校验配置（含 legacy 迁移与 doctor 指引）
- 自动补齐启动鉴权（缺 token 时可生成）
- 装配插件注册表、channels、cron、node registry、ws/http、sidecars
- 启动 discovery/tailscale/update-check/config-reload/maintenance timers
- 注册 gateway_start/gateway_stop hooks

可复用边界：

- 客户端不需要关心内部装配，只依赖统一 WS/HTTP 契约。
- 扩展模块（插件/渠道）可通过 registry + handlers 参与装配。

## 2.2 协议与分发层

- 方法目录：`src/gateway/server-methods-list.ts`
- 请求鉴权/授权与分发：`src/gateway/server-methods.ts`
- 协议 schema：`src/gateway/protocol/schema/*`
- 协议版本：`PROTOCOL_VERSION = 3`

可复用边界：

- 所有客户端共享同一方法/事件目录。
- 服务端通过 role + scope + method policy 强制约束客户端行为。

## 2.3 WS 接入与握手层

- 连接处理：`src/gateway/server/ws-connection/*`
- 消息主处理：`message-handler.ts`

可复用边界：

- 客户端必须遵守统一握手流程（challenge -> connect -> hello-ok）。
- 连接建立后才能调用业务方法。

## 2.4 HTTP 接入层

- 入口：`src/gateway/server-http.ts`

提供：

- Control UI 托管
- OpenAI 兼容 `/v1/chat/completions`
- OpenResponses `/v1/responses`
- hooks、tools invoke、plugin routes、canvas/a2ui

可复用边界：

- WS 为主控制通道；HTTP 为补充接口与 web surface。

---

## 3. 统一接入契约（客户端必须遵守）

## 3.1 WS 握手契约

客户端连接后：

1. 服务端推送 `event: connect.challenge`（nonce）。
2. 客户端发送 `req/connect`（含 `minProtocol/maxProtocol`、client、auth、role/scopes、device）。
3. 服务端完成协议协商 + 鉴权 + pairing 决策。
4. 成功返回 `res(payload=hello-ok)`。

关键约束：

- 首个请求必须是 `connect`。
- 角色仅允许 `operator` / `node`。
- 非法帧、非法 role、协议不兼容均会被关闭连接。

## 3.2 connect 必要字段与扩展字段

必要字段：

- `minProtocol/maxProtocol`
- `client.id/version/platform/mode`

常用扩展：

- `role/scopes`
- `auth.token/password/deviceToken`
- `device.id/publicKey/signature/signedAt/nonce`
- `caps/commands/permissions/pathEnv`

## 3.3 hello-ok 输出契约

返回核心字段：

- `protocol`
- `server.version/connId`
- `features.methods/events`
- `snapshot`（presence/health/stateVersion）
- `policy`（maxPayload/maxBufferedBytes/tickIntervalMs）
- 可选 `auth.deviceToken`
- 可选 `canvasHostUrl`（含 scoped capability）

## 3.4 帧级 IO 契约

- 请求：`{ type:"req", id, method, params? }`
- 响应：`{ type:"res", id, ok, payload?, error? }`
- 事件：`{ type:"event", event, payload?, seq?, stateVersion? }`

---

## 4. 方法与事件目录（当前版本）

## 4.1 核心方法域（节选）

来源：`server-methods-list.ts`

- 系统与健康：`health`、`status`、`logs.tail`、`usage.*`
- 配置：`config.get/set/apply/patch/schema`
- Agent：`agent`、`agent.wait`、`agent.identity.get`、`agents.*`、`agents.files.*`
- 会话：`sessions.list/preview/patch/reset/delete/compact`
- 技能与模型：`skills.*`、`models.list`、`tools.catalog`
- 渠道：`send`、`channels.status/logout`
- 自动化：`cron.*`、`wizard.*`、`update.run`
- 节点设备：`node.*`、`device.pair.*`、`device.token.*`
- 执行审批：`exec.approvals.*`、`exec.approval.*`
- 浏览器：`browser.request`
- WebChat native chat：`chat.history/send/abort`

此外，channel plugins 还能动态追加 `gatewayMethods`。

## 4.2 核心事件域

- `connect.challenge`
- `agent`、`chat`、`presence`
- `tick`、`health`、`heartbeat`、`shutdown`
- `cron`
- `node.pair.requested/resolved`
- `device.pair.requested/resolved`
- `node.invoke.request`
- `voicewake.changed`
- `exec.approval.requested/resolved`
- `update.available`（常量事件）

---

## 5. 安全与权限模型（重点更新）

## 5.1 鉴权模式（GatewayAuthMode）

当前支持：

- `none`
- `token`
- `password`
- `trusted-proxy`（新增重点）

参考：`src/gateway/auth.ts`、`src/config/types.gateway.ts`。

## 5.2 trusted-proxy 契约

`mode=trusted-proxy` 时必须配置：

- `gateway.auth.trustedProxy.userHeader`（必填）
- 可选 `requiredHeaders`
- 可选 `allowUsers`
- 且 `gateway.trustedProxies` 必须配置可信反代来源 IP

否则连接会被拒绝。

## 5.3 auth rate limit

- 认证失败可按 IP/scope 限流与锁定。
- 超限时返回可重试信息（包含 retry-after）。

## 5.4 role + scope 授权

- `role=node` 只能调用 node-role 方法（如 `node.invoke.result`、`node.event`、`skills.bins`）
- `role=operator` 走 `operator.read/write/approvals/pairing/admin` 范围判定
- `operator.admin` 覆盖低权限 scopes
- 未分类方法默认拒绝（default-deny 倾向）

参考：`role-policy.ts`、`method-scopes.ts`、`server-methods.ts`。

## 5.5 Control Plane 写操作限流（新增）

`server-methods.ts` 对高风险写操作（如 `config.apply`、`config.patch`、`update.run`）加入控制面预算限流，超限返回 `UNAVAILABLE + retryAfterMs`。

---

## 6. Node/Device 配对与升级规则（关键契约）

## 6.1 配对触发条件

在 `message-handler.ts` 中，若设备身份存在且未满足配对策略，会触发 pairing：

- `not-paired`
- `role-upgrade`
- `scope-upgrade`

并广播：`device.pair.requested` / `device.pair.resolved`。

## 6.2 升级审计

当请求角色或 scope 超过已配对授权时，会记录安全审计日志（roleFrom/roleTo/scopesFrom/scopesTo）。

## 6.3 node commands 过滤

`role=node` 时，声明的 `commands` 会按网关 allowlist 动态过滤：

- 全局策略：`gateway.nodes.allowCommands/denyCommands`
- 平台维度策略：按 platform/device family 组合

---

## 7. HTTP 面契约与路由优先级

`server-http.ts` 的处理顺序（核心）：

1. hooks
2. tools invoke
3. slack http
4. plugin routes（部分 channel 路由默认受 gateway auth 保护）
5. openresponses（若 enabled）
6. openai chat completions（若 enabled）
7. canvas/a2ui（需 canvas 授权）
8. control-ui
9. 404

新增重点：

- `/v1/responses` 已成为正式可配置端点，包含 file/image URL fetch 及 MIME/size/redirect/timeout/PDF 等安全限制。
- `gateway.tools.allow/deny` 可限制 HTTP `/tools/invoke` 工具面。

---

## 8. 配置契约（Gateway 侧关键键）

接入与运维需重点关注：

1. 网络与模式：`gateway.mode`、`gateway.bind`、`gateway.customBindHost`、`gateway.port`
2. 鉴权：`gateway.auth.mode/token/password/trustedProxy/rateLimit`
3. 反代：`gateway.trustedProxies`、`gateway.allowRealIpFallback`
4. TLS：`gateway.tls.*`
5. Tailscale：`gateway.tailscale.mode/resetOnExit`
6. HTTP：`gateway.http.endpoints.chatCompletions/responses`
7. UI：`gateway.controlUi.enabled/basePath/root/allowedOrigins`
8. Node：`gateway.nodes.browser`、`gateway.nodes.allowCommands/denyCommands`
9. 热重载：`gateway.reload.mode/debounceMs`
10. 工具面：`gateway.tools.allow/deny`

---

## 9. 新客户端二开接入清单（实操版）

1. 先打通 `connect.challenge + connect + health`。
2. 明确客户端身份：`client.id/mode/role/scopes`。
3. 至少实现 token/password；推荐实现 device identity + nonce 签名。
4. 远端必须走 `wss` 并做 TLS 指纹校验。
5. 实现事件消费（含 seq gap/重连）。
6. 若为 node 客户端，实现 `node.invoke.result` 与 `node.event` 回传闭环。
7. 完整验证拒绝路径：
   - 协议不兼容
   - role/scope 不足
   - pairing 未通过
   - origin 不允许
   - auth rate limit

---

## 10. 与旧版文档相比的关键变化

旧版规范成立，但当前版本新增/变化如下：

1. **鉴权模式升级**：新增 `trusted-proxy`，并有严格配置校验。
2. **安全控制加强**：auth rate limit + control-plane write 限流。
3. **方法域扩展**：`agents.files.*`、`exec approvals`、`browser.request`、webchat-native `chat.*`。
4. **HTTP 面增强**：`/v1/responses` 正式化，附带细粒度文件/图片安全策略。
5. **Node 配对策略更细化**：not-paired/role-upgrade/scope-upgrade 三类触发与审计。
6. **运行时装配增强**：热重载、update-check、delivery recovery、skills remote cache、sidecar 编排。
7. **channel/plugin 集成深化**：channel methods 动态并入 gateway methods。

---

## 11. 一句话总结

当前 Gateway 已从“统一通信入口”升级为“强策略控制平面”：

**在保持多客户端统一协议复用的前提下，通过更严格的鉴权、权限、配对和运行时治理，把可扩展性与安全性同时前移到协议接入层。**
