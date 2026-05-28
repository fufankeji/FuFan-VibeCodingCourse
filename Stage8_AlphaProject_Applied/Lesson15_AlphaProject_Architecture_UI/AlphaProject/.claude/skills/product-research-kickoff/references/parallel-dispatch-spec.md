# Parallel Dispatch Spec · 双路调研 + Task 并行规范

## 目录

- [双路调研规范](#双路调研规范)
- [muyu-search-mcp planning 状态机](#muyu-search-mcp-planning-状态机)
- [事实来源标注规范](#事实来源标注规范)
- [Task 并行调度规范](#task-并行调度规范)
- [收尾汇总规范](#收尾汇总规范)
- [写进最终提示词的"双路规范段落"模板](#写进最终提示词的双路规范段落模板)

---

## 双路调研规范

每个 sub-agent 在做调研时，**必须同时使用两路搜索引擎**，互相交叉验证。

| 调研路 | 工具 | 偏重 |
|--------|------|------|
| **路 A**：Claude 内置 | `WebSearch` + `WebFetch` | 海外信源 / 英文资料 / GitHub / 官方文档 |
| **路 B**：muyu-search-mcp | `web_search` + `web_fetch` + `web_map` | 中文信源 / 国内产品 / 知乎 / 微信生态 / 国内合规 |

**核心原则**：
- 同一事实点两路都查到一致 → 标 ✅ 双路验证
- 两路冲突 → 在产出文档中**明确标注冲突 + 各自来源**，留给主 Claude 决策
- 只有单路找到 → 标 ⚠️ 单源，提示置信度较低
- 严禁 sub-agent 替用户裁决冲突

---

## muyu-search-mcp planning 状态机

muyu-search-mcp 有**硬门禁**：直接调 `web_search` 会被工具拒绝。必须先走完 planning 流程：

```
plan_intent ─► plan_complexity ─► plan_sub_query (batch)
                                       │
                                       ▼
                                  plan_search_term (batch) ─► plan_tool_mapping (batch)
                                                                       │
                                                                       ▼
                                                                plan_execution ─► web_search
```

| 阶段 | 关键输出 |
|------|---------|
| `plan_intent` | 核心问题 + query_type + **unverified_terms** |
| `plan_complexity` | level 1/2/3 + estimated_tool_calls |
| `plan_sub_query` (批量) | 多个 sub-query（含 goal / boundary / depends_on） |
| `plan_search_term` (批量) | 每个 sub-query 的搜索词（≤8 词） |
| `plan_tool_mapping` (批量) | sub-query → 工具映射 |
| `plan_execution` | parallel 组 + sequential 列 |

**关键约束**：
- `unverified_terms` 必须至少在一个 sub-query.goal 里出现，否则 plan 永远 incomplete
- 产品立项调研建议 level=2 或 3（绝大多数事实都有未验证术语）

---

## 事实来源标注规范

sub-agent 写入产出文档时，每条事实/数据后必须标来源：

| 标记 | 含义 |
|------|------|
| `[WebSearch]` | 只通过 Claude 内置查到 |
| `[muyu]` | 只通过 muyu-search-mcp 查到 |
| `[双路 ✅]` | 两路结论一致 |
| `[单源 ⚠️]` | 仅一路查到，置信度较低 |
| `[冲突 ⚠️ 见下]` | 两路结论不一致，下方列出各自来源 |

**示例**：

```markdown
- 同花顺问财：自然语言选股代表，支持口语化查询。[双路 ✅]
- AKShare 2024 年起对部分接口加了 token 验证。[冲突 ⚠️ 见下]
  - [WebSearch] GitHub Issue #3421 说"全部接口仍免费"
  - [muyu] 知乎 2025-01 回答说"高频接口已开始限流"
```

---

## Task 并行调度规范

### 工具选择

✅ **用 Claude Code 原生 `Task` 工具**——一条消息里发起 N 个 Task 调用 = 真并行
❌ 不要用 Agent Teams（那是 agent 间通信场景，对纯并行调研过度设计）

### 调度模式

```
主 Claude session
   ├──[Task 1]──► sub-agent: 调研主题 1 → 写 01-产品形态.md
   ├──[Task 2]──► sub-agent: 调研主题 2 → 写 02-数据来源.md     (并行)
   ├──[Task 3]──► sub-agent: 调研主题 3 → 写 03-开源项目.md
   └──[Task 4]──► sub-agent: 调研主题 4 → 写 04-实现方案.md
        ↓
   4 个 Task 全部返回
        ↓
   主 Claude 串行写 05-决策汇总.md
```

### 每个 Task 的提示词必须包含（Superpowers `dispatching-parallel-agents` 四要素）

1. **Focused scope**：只做分配的这一个主题，明确边界
2. **Self-contained context**：项目定位、目标市场、对标竞品等所有必要背景
3. **Constraints**：
   - 必须双路调研 + 来源标注
   - 必须用 Write 工具写入指定路径
   - 不要修改其他主题的文件
   - 不知道就说不知道
4. **Expected output**：文件路径 + 文档结构 + 质量要求

### Task 数量上限

- 推荐 4 个 Task 并行（4 主题）
- 上限 6 个（多了会撑爆主 session 协调成本）
- 如果项目需要超过 6 个主题，建议拆成两批

---

## 收尾汇总规范

`05-决策汇总.md` 由主 Claude（不是 sub-agent）串行完成：

1. **不可并行**——必须读完前 4 份才能写
2. **不可委托给 sub-agent**——汇总需要全局视角和决策权
3. **必须处理冲突**——前 4 份里标了 `[冲突 ⚠️]` 的，汇总时显式说明取舍理由
4. **必须给推荐**——每个决策点（产品形态/资源/复用/技术栈）要明确给出推荐 + 理由

汇总文档骨架：

```markdown
# 05-决策汇总

## 1. 产品形态决策
推荐：xxx
理由：xxx
（基于 01-产品形态.md）

## 2. 关键资源决策
主选：xxx | 备份：xxx
理由：xxx

## 3. 开源复用决策
fork: xxx | 借鉴：xxx
理由：xxx

## 4. 技术栈决策
模块 1: xxx (理由)
模块 2: xxx (理由)
...

## 5. 架构总图
（Mermaid）

## 6. 成本估算
每月预算：约 xxx 元 / 美元

## 7. 风险与对策
- 风险 1: xxx → 对策: xxx
- 风险 2: xxx → 对策: xxx

## 8. 冲突信息处理
（列出前 4 份里所有 [冲突 ⚠️] 的事实点 + 取舍理由）
```

---

## 写进最终提示词的"双路规范段落"模板

直接复制下方内容写入 Step 4 生成的最终提示词中（写死部分，不替换变量）：

```markdown
## 🔀 双路调研规范

每个 sub-agent 必须同时用两路搜索引擎，交叉验证：

- **路 A**：Claude 内置 `WebSearch` / `WebFetch`
  （偏海外信源、GitHub、英文官方文档）
- **路 B**：muyu-search-mcp `web_search` / `web_fetch` / `web_map`
  （偏中文信源、国内产品、知乎、国内监管合规）

**muyu-search-mcp 调用约束**：它有 planning 硬门禁，必须先走完
`plan_intent → plan_complexity → plan_sub_query → plan_search_term →
plan_tool_mapping → plan_execution` 才能调 `web_search`，否则会被拒绝。

**事实标注**：每条事实/数据后标来源：
`[WebSearch]` / `[muyu]` / `[双路 ✅]` / `[单源 ⚠️]` / `[冲突 ⚠️ 见下]`

两路冲突时**不要替我裁决**，原样标出 + 列双方来源。

## 并行执行

用 Claude Code 原生 **Task 工具**，在**同一条消息中发起 4 个 Task 调用**。
4 个 sub-agent 全部返回后，主 Claude 串行写 `05-决策汇总.md`。
```
