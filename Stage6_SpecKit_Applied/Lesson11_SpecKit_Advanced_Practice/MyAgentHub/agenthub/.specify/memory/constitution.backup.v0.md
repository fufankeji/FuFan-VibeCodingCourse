# AgentHub 项目宪法

## 项目基本原则

- **项目名**：AgentHub
- **核心理念**：AI Agent 的商店、Playground 与编排平台
- **技术底座**：Next.js 15 App Router + Vercel AI SDK

## 基础约束

- 所有数据契约必须可校验（Zod schema 优先）
- 服务端与客户端边界清晰（"use client" 标注到位）
- 流式响应场景走 Edge Runtime

> 本宪法由 `/speckit.constitution` 初始化生成，可被 `/spec-kit-patch` 等命令追加扩展。

---

# 三法衣原则（由 /spec-kit-patch 注入）

本段落定义 AgentHub 项目的三条底层法衣，所有后续 `/speckit.plan` / `/speckit.tasks` / `/speckit.implement` 必须对齐。

## 第一法衣：Spec-Kit 业务法衣

### 原则 1：Spec First（先规范，后代码）

在写任何代码之前，必须先有 spec（通过 `/speckit.specify` 产出）。每个 spec 必须包含：

- **User story**：用用户视角描述"谁、在什么场景、想达成什么"
- **Acceptance criteria**：可验证、可勾选的完成标准
- **Constraints**：技术约束、业务约束、边界条件

### 原则 2：Plan Before Implement（先规划，后动手）

Spec 完成后必须跑 `/speckit.plan` 做技术规划，规划需通过 `/speckit.analyze` 一致性检查，才能进入 implement 阶段。禁止跳过 plan 直接写代码。

### 原则 3：Quality Gate（质量闸门）

implement 之前必须依次通过：

- `/speckit.clarify` —— 发现需求盲点和歧义
- `/speckit.checklist` —— 验证需求本身是否清晰可执行

闸门未过，implement 禁开工。

## 第二法衣：StyleSeed 视觉法衣

本项目视觉规范共 69 条，统一维护在 `.styleseed/rules.md`（Single Source of Truth）。

以下列出 4 条最高频红线，完整清单一切以 `.styleseed/rules.md` 为准：

- **颜色**：所有颜色必须走 Tailwind `@theme` 变量，禁止 hardcoded hex（禁止 `#3B82F6` 这种写法）
- **间距**：所有 padding / margin / gap 必须走 4px 阶梯（4/8/12/16/24/32…），禁止 10/15/22 这种任意值
- **交互态**：所有可交互元素必须完整支持 5 态——default / hover / active / focus / disabled
- **图标**：功能图标必须用 `lucide-react`，禁止用 emoji 充当功能图标

> 如何查完整 69 条：`cat .styleseed/rules.md`。新增或修改规则请改那里，不要改这段。

## 第三法衣：Figma Variables 设计法衣

### 原则 1：Variables 化

所有设计稿必须 Variables 化，分层命名：`bg` / `fg` / `border` / `primary` / `secondary` / … 禁止在 Figma 里直接填色值。

### 原则 2：语义命名，禁止值语义

命名必须表达"用途"，禁止表达"长相"：

- 正例：`color.primary.default` / `color.bg.surface` / `color.fg.muted`
- 反例：`color.blue500` / `color.gray200` / `color.red`

### 原则 3：Figma 与代码双向同步

Figma 里的 Variables 必须和代码里的 Tailwind `@theme` 变量一一对应，通过 Figma MCP 定期校验，发现漂移立即对齐。

---

（三法衣注入结束。如需查看备份，请看 `.specify/memory/constitution.backup.md`。）
