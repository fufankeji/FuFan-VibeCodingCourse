# AlphaProject · A 股自动盯盘 AI 助手

## 1. 项目 WHAT

本地 Mac 常驻的单用户工具：Web Dashboard + 飞书推送，承载 4 件事 —— 自选股一屏看完（F1/F5）、4 类异动 60 秒推送（F2/F6）、≤200 字 AI 解释（F3）、工作日 09:15 早盘简报（F4）。MVP 6 周，月成本 ≤100 元，不下单、不对外、不收费。详见 @specs/prd.md。

## 2. 项目 WHY

消灭多 App 切换、不再错过持仓/自选/板块/事件 4 类信号、盘前 5 分钟刷完关键信息、用 AI 解释加速从"看到涨停"到"理解涨停逻辑"的认知形成。学习目标：6 个月把"看不懂的异动"占比从 80% 降到 30%。

## 3. 工作流 HOW

**① 启动一个 feature**：`/speckit.specify` → `/speckit.clarify` → `/speckit.plan` → `/speckit.tasks`，产物落 `specs/00X-<feature-slug>/{spec,plan,tasks}.md`。

**② 每个 task 启动必读**：`@specs/00X-.../tasks.md`（任务定义）+ `@specs/00X-.../plan.md`（技术决策）+ `@.specify/memory/constitution.md`（前端任务必读 FD-1~FD-8）+ FE 视觉任务额外读 `@specs/design-reference/stitch-export/precision_terminal/DESIGN.md` 对应章节与 tasks.md 标注的参考 HTML。

**③ 测试纪律**：本仓 tasks 已把出参验证内联到每条任务的 `[出参验证]` 字段；实现时**按 `[出参验证]` 反推最小测试**再写代码（goal-driven，呼应 §9 Karpathy 原则 4）。后端单测在 `backend/tests/`，前端 UI 改动需在浏览器实操金 path 与边界。

**④ feature 完成动作**：本地自测全部 `[出参验证]` 通过 → 更新该 feature `tasks.md` 勾选状态 → 跨 feature 契约变动同步到上下游 spec（如 F5 T014 路由变 → 通知 F1）→ 停下来汇报，等下一条指令。

**⑤ 节奏铁律**：每跑完一个 feature 停下来汇报，确认再下一个；feature 内每个 task 只动该任务声明的文件（FD/Karpathy §3 Surgical Changes）；不在 plan/tasks 写代码（"本轮不写代码"约束）。

## 4. 技术栈（预定 / 未落地，源自 @specs/research/06-架构基线决策.md）

| 层 | 选型 | 来源 |
|---|---|---|
| 后端语言/框架 | Python 3.11 + FastAPI | 06 §1 复用矩阵 |
| 任务调度 | APScheduler（cron + 交易时段） | 06 §1 + F4 plan |
| 行情数据 | akshare（主）+ tushare Pro（补） | 06 §1 + PRD §12.1 |
| LLM | openai-compatible SDK：DeepSeek（主）/ Qwen（备）/ Ollama 本地降级 | 06 §1 + PRD F3 |
| 持久化 | SQLite（单文件本地） | 06 §1 + F5 plan |
| AI Agent 内核 | TradingAgents-CN（fork）+ TauricResearch/TradingAgents（上游 cherry-pick） | 06 §0 决策摘要 |
| 飞书 SDK | lark-oapi（官方 Python，非 larksuite/cli Go） | PRD §13.4 + F6 spec |
| 前端 | Vite + React 19 + TypeScript + shadcn/ui（自主构建，不 fork SD） | 06 修订说明（2026-05-26） |
| K 线 | tradingview/lightweight-charts | 06 §1 |
| 部署 | 本地 Mac + Tailscale 内网访问 | PRD §7.2/§7.3 |

> 版本号待 `frontend/package.json` 与 `backend/pyproject.toml` 初始化后回填。

## 5. 命令清单

⚠️ 工程脚手架尚未初始化（无 `package.json` / `pyproject.toml`）。落地后按下表回填，当前先用占位：

| 命令 | 用途 | 状态 |
|---|---|---|
| `pnpm dev` / `npm run dev` | 前端开发服务器（Vite） | TBD |
| `pnpm build` | 前端构建 | TBD |
| `uvicorn app.main:app --reload` | 后端开发服务器 | TBD |
| `pytest backend/tests/` | 后端单测 | TBD |

## 6. 项目宪法

前端设计系统 8 条不可违反原则（FD-1~FD-8）：见 @.specify/memory/constitution.md。任何前端 feature 的 `plan.md` Constitution Check 必须逐条核对。其他领域原则（测试/版本/可观测性）显式 Deferred。

## 7. 视觉规范

**唯一真理来源**：@specs/design-reference/stitch-export/precision_terminal/DESIGN.md（颜色 / 字体 / 间距 / 圆角 / 阴影 token）。代码禁止硬编码视觉数值。

**视觉参考样本**（看不抄）：`specs/design-reference/stitch-export/{precision_terminal, dashboard_a_ai, ai_a_ai, a_ai_1, a_ai_2, alpha_terminal_platform}/`。基准方案是 `precision_terminal`；冲突以 DESIGN.md 为准。

## 8. Anti-Patterns（禁止条款）

1. **不下单 / 不卖建议 / 不打监管擦边** —— PRD §2.3 + §7.4 红线
2. **AI 文本禁含买卖建议词**（"建议买入" / "强烈推荐" / "目标价" 等），必附"以上为信息整理，不构成投资建议"尾标
3. **A 股涨跌色：红涨绿跌**（与欧美相反），禁套国际配色 —— FD-3
4. **前端禁硬编码视觉数值**，全部走 DESIGN.md token —— FD-1
5. **禁引入与 token 体系冲突的现成 UI 套件**（如 Ant Design / MUI 整套），自建密集组件族 —— FD-4
6. **禁 fork SD / 禁抄 design-reference 代码**，前端自主构建 —— 06 修订说明
7. **禁把 app_secret / Tushare Token / LLM Key 写进 git**，本地加密存储 —— PRD §7.3
8. **禁用 webhook 自定义机器人接入飞书**，统一走 Lark App + lark-oapi —— PRD §13.4

## 9. Behavioral Guidelines (Karpathy-Inspired)

以下 4 条原则适用于全项目所有 task 实现期，目的是减少 AI 编码的常见失误。

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan with steps and verification checkpoints.

Strong success criteria enable independent iteration. Vague criteria like "make it work" require ongoing clarification.

## 10. 关键文件导航

| 文件 | 何时读 |
|---|---|
| @specs/prd.md | 任何关于"做什么 / 为什么 / 验收"问题；判 in/out-of-scope |
| @.specify/memory/constitution.md | 前端任务启动；任何视觉/交互决策前 |
| @specs/design-reference/stitch-export/precision_terminal/DESIGN.md | FE 视觉任务取值时 |
| @specs/research/06-架构基线决策.md | 技术选型疑问；fork/复用边界 |
| @specs/research/05-决策汇总.md | 想看决策一页纸版（含历史与修订） |
| @specs/research/03-开源项目.md | 想看开源项目复用矩阵 |
| @specs/00X-<feature>/spec.md | 该 feature 的 What/AC/FR |
| @specs/00X-<feature>/plan.md | 该 feature 的 How/技术决策/Constitution Check |
| @specs/00X-<feature>/tasks.md | 实现任务清单与 `[出参验证]` |
| @specs/design-reference/stitch-export/{dashboard_a_ai,a_ai_1,ai_a_ai}/code.html | FE 视觉参考（看不抄） |

> Feature 索引：F1=003-watchlist-dashboard / F2=005-anomaly-detection-push / F3=004-llm-anomaly-explain / F4=006-morning-briefing / F5=001-watchlist-crud / F6=002-feishu-push-channel。
