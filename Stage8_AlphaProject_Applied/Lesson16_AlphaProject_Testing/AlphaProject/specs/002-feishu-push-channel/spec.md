# Feature Specification: 飞书机器人推送通道

**Feature ID**: 002-feishu-push-channel（对应 PRD F6）
**Created**: 2026-05-20
**Status**: Draft → Clarified（见末尾 Clarifications）
**来源**: `specs/prd.md` §5.1 F6 · §6 F6 · US-02 / US-03 / US-04
**上游约束**: `specs/research/06-架构基线决策.md`

> 本文档仅描述 **What & Why**，不含技术选型（令牌桶实现、HTTP 库、队列存储均留 `plan.md`）。

---

## 1. 为什么做这个功能（Why）

异动检测（F2）、LLM 解释（F3）、早盘简报（F4）都需要"把消息送到用户手机"。如果每个功能各自直连飞书、各自处理限频 / 重试 / 去重 / 卡片渲染，会产生三份重复且不一致的推送代码，且飞书限频是**全局共享**的，分散处理必然互相打架。

F6 把"推送"抽象为**唯一出口**：上游只管"我要推什么内容、什么优先级"，限频、去重、重试、卡片渲染、未送达兜底、全局静音全部由 F6 统一负责。这是推送基座，与 F5（数据基座）并列为两个零依赖前置。

---

## 2. 功能边界（What）

### 2.1 In-Scope（F6 本功能必做）

- 接收上游（F2/F3/F4）的推送请求并送达飞书
- 全局令牌桶限频（飞书 100 次/分钟上限，应用层留 30% 余量 = 70 次/分钟）
- 超限自动批量合并（一张卡片承载多条，最多 10 股/卡）
- 去重（dedup）：同股 + 同信号 5 分钟内不重复推送
- 持仓股绕过 dedup（强制送达）
- 飞书卡片渲染（文本 / Markdown / interactive card）
- 飞书 webhook 签名校验
- 失败重试（30 秒、90 秒两次）+ 未送达队列兜底
- 全局静音开关（出差 / 周末暂停推送）
- webhook 失效检测 + 推送暂停 + 通知更新
- 推送日志（送达 / 失败 / 重试次数）

### 2.2 Out-of-Scope（F6 不做）

- ❌ 异动检测逻辑（何时该推）→ F2
- ❌ LLM 解释内容生成 → F3
- ❌ 早盘简报内容组装 → F4
- ❌ Telegram / 微信 / 钉钉 / App Push 等其他通道 → 永久 Won't（PRD Non-Goal，MVP 仅飞书）
- ❌ 双向交互（用户在飞书点按钮回调控制系统）→ v1.1+
- ❌ 推送内容的合规审查（禁用买卖建议词）→ 由 F3 在内容生成侧负责；F6 仅做飞书平台禁用词的兜底替换

### 2.3 MVP 约束

- 单一通道：仅飞书（**完整 Lark App 模型** —— 经源码调研 larksuite/cli 后决议，用官方 Python SDK `lark-oapi` 走 IM OpenAPI，而非自定义机器人 webhook，见 Clarifications 决策记录）
- 单用户、单 App、单接收目标（一个群 chat_id 或单聊 open_id）
- 应用层令牌桶限频保留作自我保护；**阈值按 IM OpenAPI 官方频控口径设定**（量级高于自定义机器人的 100/min，实现时以官方文档核实，见 Clarifications）
- 批量合并阈值：一张卡片最多 10 股
- dedup 窗口：5 分钟（PRD §6 F2 协同值）；可叠加 SDK `uuid` 幂等字段做发送级去重
- 重试策略：失败后 30s、90s 各重试一次，共 3 次尝试

### 2.4 运行环境

- 本地 Mac 常驻
- 通过官方 Python SDK `lark-oapi` 出站访问飞书 IM OpenAPI（本地网络可达 open.feishu.cn）
- **Lark App 凭证 `app_id` + `app_secret` 本地加密存储**（PRD §7.3，不入 git）；tenant_access_token 由 SDK 内部自动获取与刷新
- 前置：在飞书开放平台创建企业自建 App、开通机器人能力、申请 IM 发消息权限（scope）、把机器人加入目标群或单聊

---

## 3. 用户场景与验收

### User Story 1 — 推送送达飞书（Priority: P1）🎯

作为本人，我希望上游功能产生的消息能可靠送到我的飞书，以便我在手机上即时看到。

**Why this priority**：推送送达是 F6 存在的根本，缺它 F2/F4 都没有出口。

**Independent Test**：构造一条测试推送请求 → 飞书收到对应卡片，即验证成功（不依赖 F2/F3/F4 真实逻辑）。

**Acceptance Scenarios**：

1. **Given** Lark App 凭证配置正确、机器人已在目标会话且未静音，**When** 上游提交一条异动推送请求（含股票名/价格/解释），**Then** 60 秒内目标会话收到对应卡片（经 `client.im.v1.message.create`），推送日志记一条"送达"。
2. **Given** 推送请求为 interactive 卡片类型，**When** F6 渲染并以 `msg_type="interactive"` 发送，**Then** 目标会话显示格式正确的卡片（标题/正文/跳转链接）。
3. **Given** 推送内容含飞书平台禁用词，**When** F6 渲染，**Then** 自动替换为安全表达后发送，日志记录替换。

### User Story 2 — 限频与批量合并（Priority: P1）🎯

作为本人，我不希望盘中异动集中爆发时被飞书限流或被几十条消息轰炸，以便推送既不丢也不烦。

**Why this priority**：飞书限频是硬约束，触发限流会导致丢消息。

**Independent Test**：1 分钟内灌入 25 条推送 → 验证合并为若干批量卡片且不超 70 次/分钟。

**Acceptance Scenarios**：

1. **Given** 当前分钟已发送接近 70 次，**When** 新推送到达，**Then** 进入合并队列，多条合并为一张卡片（≤10 股/卡）后发送，不超过 70 次/分钟。
2. **Given** 单分钟内 25 只股票同时异动，**When** F6 处理，**Then** 合并为 ≤3 张批量卡片发送，而非 25 条独立消息。
3. **Given** 限频余量充足（远低于 70/min），**When** 单条推送到达，**Then** 立即单条发送，不强制合并。

### User Story 3 — 失败重试与未送达兜底（Priority: P1）🎯

作为本人，我希望推送失败时系统自动重试并留底，以便临时网络抖动不会让我永久错过消息。

**Why this priority**：本地 Mac 网络可能抖动，可靠性是盯盘工具的底线。

**Independent Test**：模拟 webhook 返回失败 → 验证 30s/90s 重试 → 仍失败入未送达队列 + Dashboard 提示。

**Acceptance Scenarios**：

1. **Given** webhook 首次返回失败，**When** F6 处理，**Then** 30 秒后重试，再失败 90 秒后第三次重试。
2. **Given** 三次尝试均失败，**When** 重试耗尽，**Then** 该消息进入"未送达队列"，Dashboard 顶部显示"N 条推送未送达"。
3. **Given** 存在未送达消息且 webhook 恢复，**When** 下次推送成功，**Then** 自动回放未送达队列（按时间序补发，过多则汇总）。

### User Story 4 — 去重与持仓强制送达（Priority: P2）

作为本人，我不希望同一只股票同一信号在几分钟内反复推送，但持仓股的任何异动都不能被去重吞掉。

**Acceptance Scenarios**：

1. **Given** 自选股 Y 在 14:00 推送过"量能异常"，**When** 14:03 同股同信号再次触发，**Then** 不重复推送（5 分钟 dedup）。
2. **Given** 自选股 Y 在 14:00 推送过"量能异常"，**When** 14:03 触发"突破"（新信号），**Then** 推送"突破"（不同信号不去重）。
3. **Given** 持仓股 Z 在 14:00 推送过"量能异常"，**When** 14:03 同股同信号再次触发，**Then** 仍推送（持仓绕过 dedup）。

### User Story 5 — 全局静音与 webhook 失效处理（Priority: P2）

作为本人，我希望出差/周末能一键静音，且 webhook 失效时系统能及时告诉我而不是默默丢消息。

**Acceptance Scenarios**：

1. **Given** 用户开启全局静音，**When** 上游提交推送，**Then** 消息不发送但记录到日志（静音期内可选择是否事后汇总）。
2. **Given** Lark App 凭证 / 权限失效（持续返回鉴权或权限错误），**When** F6 检测到，**Then** 暂停所有推送 + Dashboard 红色警示"飞书连接失效，请检查 app_secret / scope / 机器人是否在会话中"。

### Edge Cases

- **卡片内容超长**：超过飞书单卡片长度上限 → 截断 + 加"查看完整内容"跳转链接。
- **未送达队列溢出**：队列积压超过上限（如 200 条）→ 丢弃最旧的非持仓消息 + 汇总提示，持仓消息优先保留。
- **凭证 / 权限失效**：app_secret 失效、scope 不足、机器人被移出会话导致 SDK 返回鉴权/权限错误 → 视为"连接失效"路径处理（暂停 + 告警，等用户修复凭证/权限）。
- **静音期间的持仓紧急异动**：MVP 静音 = 全静音（含持仓）；是否给持仓开"静音豁免"见 Clarifications。
- **系统时钟与飞书限频窗口不一致**：以本地滑动窗口计数为准，留 30% 余量吸收偏差。

---

## 4. 功能需求（Functional Requirements）

- **FR-001**: 系统 MUST 接收上游推送请求（含类型、内容、优先级、接收目标）并经 IM OpenAPI 送达飞书。
- **FR-002**: 系统 MUST 支持文本 / interactive 卡片消息（`msg_type` ∈ {text, interactive}）。
- **FR-003**: 系统 MUST 用 Lark App 凭证（`app_id` + `app_secret`）鉴权；tenant_access_token 的获取与刷新由官方 SDK 内部托管，本功能不手写 token 刷新逻辑，但 MUST 处理 token/scope 失效的报错。
- **FR-004**: 系统 MUST 以全局令牌桶限频自我保护；阈值按 IM OpenAPI 官方频控口径设定（实现时核实），并对 SDK 返回的频控错误码做退避重试。
- **FR-005**: 系统 MUST 在接近限频时将多条推送合并为批量卡片（≤10 股/卡）。
- **FR-006**: 系统 MUST 对"同股 + 同信号"在 5 分钟内去重。
- **FR-007**: 系统 MUST 让持仓股推送绕过 dedup 强制送达。
- **FR-008**: 系统 MUST 在发送失败时按 30s / 90s 重试（共 3 次尝试）。
- **FR-009**: 系统 MUST 在重试耗尽后将消息存入未送达队列，并通知 Dashboard。
- **FR-010**: 系统 MUST 在 webhook 恢复后回放未送达队列（过多则汇总）。
- **FR-011**: 系统 MUST 提供全局静音开关。
- **FR-012**: 系统 MUST 检测 webhook 失效并暂停推送 + 告警。
- **FR-013**: 系统 MUST 记录推送日志（送达 / 失败 / 重试次数 / 时间戳），保留 ≥ 90 天（PRD §7.5）。
- **FR-014**: 系统 MUST 对飞书平台禁用词做兜底替换。
- **FR-015**: 系统 MUST 对外提供统一推送接口供 F2/F3/F4 调用（含优先级 + 接收目标参数）。
- **FR-016**: 系统 MUST 在每次发送携带幂等键（SDK `uuid` 字段），保证重试不产生重复消息。

---

## 5. 关键实体（Key Entities）

- **推送请求（PushRequest）**：上游提交的推送意图。属性：类型（异动/简报/系统）、卡片内容、优先级（持仓/自选/系统）、关联股票代码（可选，用于 dedup）、信号类型（可选，用于 dedup）、接收目标（receive_id + receive_id_type，默认取配置的单一目标会话）。
- **接收目标（ReceiveTarget）**：消息发往的会话。属性：receive_id（群 chat_id 或单聊 open_id）、receive_id_type（chat_id / open_id 等）。MVP 单一默认目标，来自配置。
- **推送日志（PushLog）**：每次推送的结果记录。属性：时间戳、目标、状态（送达/失败/静音/合并）、重试次数。
- **未送达项（UndeliveredItem）**：重试耗尽的消息。属性：原始请求、失败次数、入队时间、是否持仓。
- **令牌桶（RateLimiter）**：限频状态。属性：当前分钟已用配额、余量。
- **去重键（DedupKey）**：`股票代码 + 信号类型`，5 分钟 TTL。

---

## 6. 集成边界

- **被 F2 异动检测调用**：F2 命中规则后调 FR-015 接口推送；dedup（FR-006）与 F2 的扫描节拍协同（5 分钟窗口一致）。
- **被 F4 早盘简报调用**：F4 组装好 Markdown 卡片后调 F6 发送（简报类不参与 dedup）。
- **被 F3 间接关联**：F3 生成的解释作为推送内容的一部分由上游塞入 PushRequest，F6 不直接调 F3。
- **依赖飞书开放平台**：企业自建 Lark App（app_id + app_secret + IM 发消息 scope）+ 机器人加入目标会话（外部依赖）。
- **向 F1 Dashboard 暴露**：未送达数量、App 鉴权/连接状态、静音状态供 Dashboard 顶部展示。
- **本功能不依赖** F5（推送不直接读自选清单；持仓标记由上游 PushRequest 的优先级字段传入）。

---

## 7. 成功标准（可度量）

- **SC-001**: 正常网络下，推送从提交到飞书送达 p95 < 60 秒（PRD §7.1）。
- **SC-002**: 限频永不触发 IM OpenAPI 频控拒绝（应用层令牌桶 + 频控错误退避，100% 不丢消息）。
- **SC-003**: 单分钟 25 条异动场景下，合并为 ≤3 张卡片，0 丢失。
- **SC-004**: 三次重试后仍失败的消息 100% 进入未送达队列，0 静默丢失。
- **SC-005**: 持仓股推送绕过 dedup 成功率 100%。

---

## 8. 假设（Assumptions）

- 单用户、单 Lark App、单飞书群 / 单聊（单一默认接收目标）。
- 使用官方 Python SDK `lark-oapi`，tenant_access_token 由 SDK 内部托管刷新，本功能不手写 token 逻辑。
- IM OpenAPI 发消息频控以官方文档为准（量级高于自定义机器人 100/min）；应用层令牌桶仅作自我保护与 F2 爆发合并。
- 上游 PushRequest 已携带"是否持仓"优先级与接收目标（F6 不查 F5）。
- 推送内容的"投资建议合规"由内容生成侧（F3）负责，F6 只兜底飞书平台禁用词。
- 全局静音为单一开关，MVP 不做分时段 / 分类型静音规则。

---

## Clarifications

> ② clarify 产出，扫 4 类边界（MVP / API / 数据 / 集成），逐条回写。

### Session 2026-05-20

**[MVP 边界]**
- Q：dedup（FR-006）、全局静音（FR-011）是否 F6 MVP 必做？
  - A：**dedup 必做**（否则盘中爆发会被同信号刷屏）；**全局静音 MVP 必做但实现为单一开关**（不做分时段规则），已回写 §2.3 / US5 优先级 P2（功能在但非首批）。
- Q：未送达队列回放（FR-010）是 MVP 还是 v1.1？
  - A：**MVP 必做**——本地 Mac 网络抖动是高频场景（PRD R-04），回放是可靠性底线。

**[API 边界]（飞书平台）**
- Q：飞书限频精确值？超限行为？
  - A：自定义机器人 **100 次/分钟、5 次/秒**（调研 sq7 核实）；应用层留余量降到 **70/min**。超限不丢，进合并队列。
- Q：webhook 失败的判定标准（区分"临时网络失败"vs"webhook 失效"）？
  - A：网络层失败（超时/5xx）→ 走重试；鉴权失败（签名错/URL 失效/4xx 鉴权类）→ 判定 webhook 失效，暂停 + 告警。已回写 Edge Cases。
- Q：飞书单卡片长度上限？
  - A：超长截断 + 跳转链接（Edge Cases 已含）；精确字节上限实现时以飞书文档为准。

**[数据边界]**
- Q：未送达队列上限？溢出策略？
  - A：上限 **200 条**；溢出丢弃最旧的**非持仓**消息，持仓消息优先保留 + 汇总提示。已回写 Edge Cases。
- Q：推送日志保留多久？
  - A：≥ 90 天（PRD §7.5），FR-013 已含。

**[集成边界]**
- Q：dedup 的"信号类型"由谁定义？F6 还是 F2？
  - A：由 **F2 定义并通过 PushRequest 传入**（如 "limit_up" / "volume_surge"）；F6 只用 `code + signal` 组键去重，不理解信号语义。已回写 §5 DedupKey / §6。
- Q：持仓判定 F6 查 F5 还是上游传入？
  - A：**上游（F2/F4）在 PushRequest 的 priority 字段传入**，F6 不依赖 F5。已回写 §6 / §8。

**[已确认 · 全局静音范围]**
- Q：全局静音期间，持仓股的紧急异动是否豁免静音？
  - A：**用户拍板（2026-05-20）= 备选 A 全静音（含持仓）**。静音 = 彻底不打扰。已固化到 Edge Cases 与 FR-011。

**[已确认 · 飞书接入模型，源码调研后决议]**
- Q：是否采用飞书官方 CLI `larksuite/cli` 接入？
  - 调研（SubAgent 通读 larksuite/cli 源码 `/tmp/larksuite-cli2`）：该 CLI 是 **Go 写的"用命令行/AI Agent 操作飞书"工具**（200+ 命令、给 Claude/Cursor 当工具），**不生成 App 模板、强制完整 App 鉴权**，嵌入常驻 Python 服务做单向推送属过度工程 + 跨语言进程污染。
  - A：**用户拍板（2026-05-20）= 改用「完整 Lark App + 官方 Python SDK `lark-oapi`」**，而非 Go CLI、也非自定义机器人 webhook。
  - **对 spec 的影响**：鉴权从 webhook+HMAC 改为 app_id/app_secret→tenant_access_token（SDK 托管）；发消息从 POST webhook 改为 `client.im.v1.message.create`（需 receive_id）；新增 FR-016 幂等（SDK uuid）；限频口径改为 IM OpenAPI；依赖 httpx→lark-oapi。已全部回写 §2.3/§2.4/§3/§4/§5/§6/§7/§8。
  - **未来若做双向交互**（v1.1+，当前 Out-of-Scope）：仍用 `lark-oapi`（支持事件订阅/长连接），不引入 Go CLI。
