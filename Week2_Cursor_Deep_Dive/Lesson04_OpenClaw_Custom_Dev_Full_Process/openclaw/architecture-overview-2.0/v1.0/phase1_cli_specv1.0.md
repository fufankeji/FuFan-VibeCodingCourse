# Phase 1：OpenClaw CLI 模块开发规范（v1.0）

## 0. 文档定位

本文是基于最新代码（`e:\openclaw`）的 CLI 专项架构与开发规范，聚焦：

- CLI 启动与执行链路
- 命令注册体系（Core + Sub CLI + Plugin CLI）
- CLI 与 Gateway 的 RPC 调用机制
- 安全与权限模型（scopes/auth/tls/device identity）
- 新增能力与相对旧版 `phase1_cli_spec.md` 的改动
- 新命令开发与测试落地方法

本文不再展开 WebUI/macOS/iOS/Android 细节，重点聚焦 **CLI 模块本身**。

---

## 1. 当前 CLI 架构总览

## 1.1 启动主链

`openclaw.mjs`
-> `src/entry.ts`
-> `src/cli/run-main.ts`
-> `src/cli/route.ts`（route-first 快路径）
-> `src/cli/program/*`（Commander 命令体系）
-> `src/commands/*`（业务实现）

关键职责：

- `openclaw.mjs`：加载 dist 构建产物。
- `src/entry.ts`：环境归一化、warning 处理、Windows argv 规范化、profile 注入。
- `run-main.ts`：CLI 运行器，优先 route-first，失败后进入 Commander 解析。

## 1.2 执行模式

CLI 当前有 3 种执行模式：

1. **Fast Route 模式**：`health`、`status`、`sessions`、`config get/unset`、`models list/status` 等快速命令直接分发执行，减少 Commander/全量注册开销。
2. **Commander 模式**：常规命令由 `buildProgram()` + lazy 注册执行。
3. **Plugin 扩展模式**：命中插件命令时动态加载插件 CLI 注册器。

---

## 2. 命令注册体系（最新）

## 2.1 Core Commands（一级核心命令）

来源：`src/cli/program/command-registry.ts`

当前核心命令：

- `setup`
- `onboard`
- `configure`
- `config`
- `doctor`
- `dashboard`
- `reset`
- `uninstall`
- `message`
- `memory`
- `agent`
- `agents`
- `status`
- `health`
- `sessions`
- `browser`

设计特点：

- 使用 lazy 占位命令，真正执行时再按 primary command 加载模块。
- 支持多命令同 entry 注册（例如 status/health/sessions 同组）。

## 2.2 Sub CLI（功能域命令）

来源：`src/cli/program/register.subclis.ts`

当前 sub CLI：

- `acp`
- `gateway`
- `daemon`
- `logs`
- `system`
- `models`
- `approvals`
- `nodes`
- `devices`
- `node`
- `sandbox`
- `tui`
- `cron`
- `dns`
- `docs`
- `hooks`
- `webhooks`
- `qr`
- `clawbot`
- `pairing`
- `plugins`
- `channels`
- `directory`
- `security`
- `skills`
- `update`
- `completion`

设计特点：

- 同样使用 lazy 注册策略，支持按 primary command 精准加载。
- `OPENCLAW_DISABLE_LAZY_SUBCOMMANDS=1` 时可切为 eager 注册（调试/测试用）。

## 2.3 Message / Agent 命令域增强

`message` 命令已从基础 send 扩展为消息运营面：

- `send`
- `broadcast`
- `poll`
- `reactions`
- `read/edit/delete`
- `pins`
- `permissions/search`
- `thread`
- `emoji/sticker`
- `discord-admin`

`agent` 命令已支持：

- Gateway 模式 + 本地嵌入模式 `--local`
- `--thinking` / `--verbose` 持久覆盖
- `--deliver` + `replyChannel/replyTo/replyAccount` 回投控制
- lane、runId、extraSystemPrompt 等高级参数

---

## 3. CLI 运行期关键机制

## 3.1 Route-first 快路径

来源：`src/cli/route.ts` + `src/cli/program/routes.ts`

目标：

- 对高频命令降低启动时延
- 避免不必要的全量命令树注册

现有快路径命令：

- `health`
- `status`
- `sessions`（仅裸命令）
- `agents list`
- `memory status`
- `config get`
- `config unset`
- `models list`
- `models status`

## 3.2 配置守卫与降级白名单

来源：`src/cli/program/config-guard.ts`

行为：

- 启动时校验配置快照与 legacy key。
- 配置无效时默认阻断命令执行。
- 允许部分诊断/救援命令继续执行（如 `doctor`、`health`、`status` 及部分 `gateway` 子命令）。

## 3.3 插件注册预热

来源：`src/cli/plugin-registry.ts`

行为：

- 在需要时加载 plugin registry。
- 若测试或上游已注入 registry，避免重复重载。
- 保障 plugin CLI、channel plugin 能被命令层消费。

---

## 4. CLI 到 Gateway 的调用模型

## 4.1 核心调用层

- CLI 入口适配：`src/cli/gateway-rpc.ts`
- 调用编排：`src/gateway/call.ts`
- WS 客户端：`src/gateway/client.ts`

调用流程：

CLI command -> `callGateway*` -> `GatewayClient` 建连 -> `connect.challenge` -> `connect` -> request/response。

## 4.2 作用域（Scopes）与最小权限

来源：`src/gateway/method-scopes.ts`

当前 operator scopes：

- `operator.admin`
- `operator.read`
- `operator.write`
- `operator.approvals`
- `operator.pairing`

调用策略：

- `callGatewayCli()` 默认使用 CLI 默认 scope 集。
- `callGatewayLeastPrivilege()` 按 method 自动缩减为最小 scope。
- method 未分类时默认拒绝（default-deny）。

## 4.3 连接安全模型（CLI 侧）

关键安全行为（`call.ts` + `client.ts`）：

1. **禁止远端明文 ws://**：非 loopback 的 ws URL 直接拦截（要求 `wss://`）。
2. **URL override 强制显式凭据**：传 `--url` 必须配 token/password（避免误连未鉴权目标）。
3. **TLS 指纹校验**：支持 pin `tlsFingerprint`。
4. **设备身份签名握手**：使用 device identity 对 challenge nonce 签名。
5. **设备 token 持久化与失效清理**：device token mismatch 时自动清理本地 stale token/pairing。

## 4.4 Agent 命令的双路径容错

来源：`src/commands/agent-via-gateway.ts`

- 默认：调用 Gateway `agent` 方法（`expectFinal=true`）。
- 失败：自动 fallback 到本地嵌入式 `agentCommand`。
- `--local`：直接走本地嵌入执行链。

---

## 5. 新版 CLI 能力面（相对早期版本）

## 5.1 运维与生命周期能力增强

新增/强化：

- `onboard` 全量向导（模式、鉴权、provider、tailscale、daemon、skills）
- `update` 频道升级能力
- `security` 本地审计
- `approvals` 审批面
- `doctor --fix/--repair/--deep`

## 5.2 Node/Device 体系纳入 CLI

新增命令域：

- `nodes`（节点能力调用与状态）
- `devices`（设备配对与 token）
- `node`（headless node host）

这标志 CLI 从“仅控制网关”升级为“控制网关 + 控制设备节点”。

## 5.3 渠道运营能力增强

新增/强化命令域：

- `channels`、`directory`、`pairing`
- `message` 的 poll/reaction/thread/admin 子能力

## 5.4 自动化与系统能力增强

新增命令域：

- `cron`
- `hooks`
- `webhooks`
- `dns`
- `system`
- `docs`
- `tui`

---

## 6. 新命令开发规范（CLI 模块）

## 6.1 何时放 Core，何时放 Sub CLI

1. 用户高频入口、跨角色基础命令：放 Core（`command-registry.ts`）。
2. 功能域较完整、子命令较多：放 Sub CLI（`register.subclis.ts` + 独立 `*-cli.ts`）。

## 6.2 推荐开发步骤

1. 在对应 `register.*.ts` 或 `*-cli.ts` 增加命令定义。
2. 业务逻辑放 `src/commands/*`，避免 CLI 层堆积实现细节。
3. 需要 Gateway 调用时统一走 `callGateway*`，不要手写 ws 请求。
4. 需要进度展示时使用 `withProgress` / `src/cli/progress.ts`。
5. 更新命令帮助示例（`formatHelpExamples`）。
6. 增加对应测试（`*.test.ts`）。

## 6.3 Route-first 接入原则

只有满足以下条件才建议接入快路径：

- 高频且参数结构稳定
- 不依赖复杂子命令解析
- 执行逻辑适合“直接调 command 函数”

否则保留 Commander 正常路径。

---

## 7. 测试与质量门禁（CLI 相关）

建议至少覆盖：

1. 命令注册与冲突测试（option collision / route 选择）。
2. 参数校验与错误路径。
3. Gateway 调用行为（scopes、timeout、expectFinal）。
4. 安全边界（ws 非安全拦截、tls 指纹、凭据缺失）。
5. 回归测试：`pnpm test` + 相关 CLI 单测。

仓库现有 CLI 测试已经覆盖大量注册器、选项冲突和 gateway-cli 行为，可按相同模式扩展。

---

## 8. 与旧版 `phase1_cli_spec.md` 的主要差异

旧版重点是“多客户端统一接入 Gateway”。

本 v1.0 更新为“CLI 专项开发视角”，新增并明确了：

1. CLI 的 route-first + lazy registration 双引擎机制。
2. Core/Sub/Plugin 命令装配模型。
3. 节点与设备命令体系（nodes/devices/node）的进入。
4. Gateway 调用安全模型（明文 ws 拦截、显式凭据、TLS pin、device challenge 签名）。
5. method scope 最小权限模型与 default-deny 行为。
6. `agent` 命令 Gateway 优先 + 本地 fallback 容错链。
7. onboarding/update/security/approvals 等运营化命令矩阵。

---

## 9. 一句话总结

当前 OpenClaw CLI 已从“命令入口”演进为“可插拔的多域控制终端”：

**通过 route-first + lazy command registry + scoped gateway RPC + plugin command 扩展，实现了高性能启动、强安全边界和持续演进的运维/节点/渠道控制能力。**
