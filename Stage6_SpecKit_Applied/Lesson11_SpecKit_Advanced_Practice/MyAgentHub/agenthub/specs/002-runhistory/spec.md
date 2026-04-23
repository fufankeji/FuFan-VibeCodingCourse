# Feature Specification: RunHistory 页（AI 调用历史与 Trace 瀑布图）

**Feature Branch**: `002-runhistory`
**Created**: 2026-04-23
**Status**: Draft
**Input**: User description: "RunHistory 页 - 左列表最近 AI 调用、右详情完整 Trace 瀑布图（嵌套 span + 耗时 + token），支持按状态/模型/时间筛选，排查「某次调用为什么慢 / 工具调用失败」"
**Constitution**: v2.0.0（§0.3 作用域例外已为本 spec 开启 Turso + Drizzle 许可）

## User Scenarios & Testing *(mandatory)*

### User Story 1 — 看历史列表 + Trace 瀑布图（Priority: P1 · MVP）

一位开发者在 Playground 跑了十几次不同模型、不同 prompt 之后，想回头看某次为什么慢。他打开 RunHistory 页：
- 左侧是按时间倒序的 Run 列表，每行有状态图标、prompt 摘要、耗时、token 总数
- 点中任一条，右侧瀑布图立刻铺开：每个 span 一行，横轴时间，LLM 调用和工具调用用不同颜色；嵌套 span 以缩进 + 虚线连接展示
- 点击任一 span 展开，能看到 input / output / error 详情

**Why this priority**：这是 RunHistory 的核心价值——没有它，整个页面只是"列表"，没有"诊断"能力。

**Independent Test**：只做这一条即可交付 MVP——从 Playground 触发几次调用 → 进 RunHistory 页 → 能看到列表 → 点一条看到瀑布图 → 点 span 看 input/output。

**Acceptance Scenarios**:

1. **Given** 本地已有 ≥ 3 条历史 Run，**When** 用户进入 RunHistory 页，**Then** 左列表按时间倒序呈现 Run，每行含 status icon / prompt 摘要 / 耗时 / token 总数
2. **Given** 用户选中一条 Run，**When** 右侧详情区渲染完成，**Then** 瀑布图按时间轴展开所有 span，LLM 与工具调用用不同颜色区分
3. **Given** 某 Run 含嵌套 span，**When** 用户查看瀑布图，**Then** 子 span 缩进显示，父子之间用虚线连接，最大支持 5 层嵌套
4. **Given** 用户点击某个 span 行，**When** 展开态激活，**Then** 显示该 span 的 input / output / error 原始数据

---

### User Story 2 — 按状态 / 模型 / 时间筛选（Priority: P2）

开发者只关心"昨天失败的那几次 Claude 调用"。他用筛选器把范围收到 status = error、model = Claude、时间 = 最近 24h，列表立刻收敛到相关 Run。

**Why this priority**：依附于 US1；没有 US1 的列表就没有"筛"的对象。但对真实诊断场景必不可少。

**Independent Test**：US1 可用后，打开筛选面板，勾选组合条件 → 列表在 500ms 内收敛。

**Acceptance Scenarios**:

1. **Given** 列表有混合状态的 Run，**When** 用户把状态筛选切到 "error"，**Then** 列表仅保留 `status = error` 的 Run
2. **Given** 用户叠加模型筛选（Claude 4.7）和时间范围（近 24h），**When** 所有筛选生效，**Then** 结果是三个条件的交集

---

### User Story 3 — 无限滚动加载更多（Priority: P3）

开发者想翻到两周前的一次调用。他滚动列表到底部，系统自动加载下一页（不用点"下一页"按钮），上限每次 50 条。

**Why this priority**：Trace 数据会随使用快速增长；没有分页到上千条就卡死。但 MVP 阶段用户可能只有几十条，P3 延后可接受。

**Independent Test**：手动往 Turso 塞 ≥ 120 条 mock Run，进入列表 → 滚到底 → 第二批 50 条加载 → 再滚 → 第三批 20 条加载 → 再滚无响应（到底了）。

**Acceptance Scenarios**:

1. **Given** 本地 ≥ 51 条 Run，**When** 用户初次打开页面，**Then** 列表最多显示 50 条，底部显示"加载更多"指示
2. **Given** 用户滚动到列表底部，**When** 触发加载，**Then** 追加下一批 ≤ 50 条，不重复不丢失
3. **Given** 已加载全部 Run，**When** 用户再滚，**Then** 底部显示"到底了"，不再触发请求

---

### Edge Cases

- **零数据**：首次访问或刚清过库时，列表显示空状态（文案 + 图标 + 一个"去 Playground 跑一条"的 CTA）
- **Trace 残缺**：某个 span 的 output 为 null（流式中断导致未写完）——瀑布图仍渲染，展开时显示"此 span 未完成"
- **Trace 嵌套超过 5 层**：第 6 层及更深的 span 折叠成一个 "..." 占位，提示"嵌套过深，可能是设计问题"
- **某 Run 没有任何 span**（AI 直接返回纯文本）：瀑布图区显示"本次调用无可追踪 span，只有请求-响应"，不渲染空图
- **Run 写入失败**（Turso 连接异常）：Playground 本次调用**不受影响**（写失败不影响响应），RunHistory 列表此条缺失，在页面顶部显示一条非阻塞提示
- **筛选结果为空**：显示"当前筛选无匹配，尝试放宽条件"，保留筛选器状态不自动重置
- **耗时极长的 span（> 60s）**：瀑布图横轴需要自适应或提供"压缩长尾"视图，避免短 span 被压成像素

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**：系统必须在每次 Playground 调用**完成或失败**后，持久化该次调用的元数据（Run）与调用链（Spans）；写入失败不得影响 Playground 本身的响应展示
- **FR-002**：RunHistory 页必须提供"列表 + 详情"双栏布局：左列表、右详情；选中列表项即联动右侧详情
- **FR-003**：列表每行必须呈现：状态图标（success / error / running）、prompt 摘要（首行截断 ≤ 60 字符）、耗时（ms）、token 总数（prompt + completion）
- **FR-004**：列表默认按 Run 开始时间倒序排列
- **FR-005**：详情区必须以瀑布图展示 Trace：每个 span 占一行，横轴为相对时间，起止位置按耗时成比例
- **FR-006**：LLM 调用与工具调用必须通过**不同颜色**区分，且满足 WCAG AA 对比度
- **FR-007**：span 必须支持展开，展开后显示 input / output / error 三段原始数据（JSON 结构化或纯文本）
- **FR-008**：嵌套 span 必须通过缩进 + 虚线连接呈现父子关系，系统**支持最多 5 层嵌套**；超出层级的 span 折叠显示占位
- **FR-009**：系统必须提供筛选面板，至少支持：状态（success / error / all）、模型（所有已用过的模型）、时间范围（最近 1h / 24h / 7d / 自定义）
- **FR-010**：筛选条件必须可叠加，结果为交集
- **FR-011**：列表必须采用**游标分页**（而非 offset），每批最多 50 条；滚动到底部自动加载下一批
- **FR-012**：span 的耗时必须用**色阶标识**：< 200ms 绿、200-1000ms 黄、> 1000ms 红（色阶 token 化，非字面量）
- **FR-013**：所有颜色、间距、阴影必须走设计 token；瀑布图的时间刻度线遵循 4px 阶梯
- **FR-014**：瀑布图的可视元素（span 条、文字、刻度）必须可复制文本、可被屏幕阅读器识别（否则 AC-10 的无障碍诉求失败）
- **FR-015**：系统必须提供空态（无数据）与错误态（加载失败）两类非阻塞视觉反馈

### Key Entities

- **Run**：一次 Playground 调用的根记录，含起止时间戳、所选模型、prompt 摘要、最终状态、聚合耗时、聚合 token
- **Span**：一次内部调用单元，属于某个 Run；含 parentSpanId（可空，根 span 为空）、span 类型（llm / tool）、起止时间、耗时、input、output、error、token 计数
- **Trace**：一个 Run 下所有 Span 的树形结构；由 Run.id 聚合查询得出，非独立实体
- **Filter**：一次筛选条件组合，包含 status / modelId / timeRange 三段可选择

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**：选中任一 Run 到右侧瀑布图首次可见元素出现的时间 ≤ 300ms（本地 DB 查询 + 渲染）
- **SC-002**：列表滚动到底部触发的分页加载 ≤ 500ms 出现新一批 Run
- **SC-003**：筛选条件变更到列表收敛的时间 ≤ 500ms
- **SC-004**：持久化写入对 Playground 响应耗时的额外开销 ≤ 50ms p95（非阻塞、与流式并行）
- **SC-005**：瀑布图可无障碍访问：span 标题可被屏幕阅读器朗读，span 上的文本可被鼠标选中并 Cmd+C 复制
- **SC-006**：1000 条 Run 的库下，列表首屏渲染 ≤ 800ms；10000 条 Run 下 ≤ 1500ms
- **SC-007**：耗时色阶（绿/黄/红）与色盲友好配色兼容（通过色盲模拟器测试，三档仍可区分）

## Assumptions

- 持久化方案：**Turso（libSQL，嵌入式 SQLite）+ Drizzle ORM**，依据宪法 v2.0.0 §0.3 的作用域例外条款；仅 `src/app/runs/**`、`src/lib/db/**`、`src/app/api/runs/**` 三个路径允许引入
- Turso 库本地起，开发期无需鉴权；生产期走 libSQL 嵌入模式，单文件部署（不引入托管 Turso Cloud）
- RunHistory 与 Playground 的耦合点是**写入契约**：Playground 完成后通过一个已定义接口把 Run + Spans 推给 RunHistory 写入层，双方解耦
- 本 spec **不包含**时间线重放、跨 Run 聚合分析、告警推送（Out of Scope）
- 本 spec **不触碰** §0.2 对用户账号 / 鉴权 / 订阅 / API Key 的"无 DB"约束
- 瀑布图渲染技术（SVG vs Canvas）作为实现细节放到 `/speckit.plan`；spec 层只约束结果——可无障碍、可选文字、可复制
- 色阶阈值（200ms / 1000ms）为课程教学默认值，后续可在 `constants/` 抽成配置
- 列表分页游标的具体格式（时间戳 + tiebreaker vs 单一 rowid）放到 plan 阶段决定
