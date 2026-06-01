<!--
Sync Impact Report
==================
Version change: 1.0.0 → 1.1.0
Bump rationale: MINOR —— 将初版 4 项 Open Questions 经用户裁决（2026-05-26）并入原则，
  新增 FD-8（移动端定位），并实质性扩充 FD-2 / FD-6 / FD-7；无原则移除或不兼容重定义。
Modified principles:
  - FD-2 视觉参考样本引用边界：增订 precision_terminal 为当前视觉基准方案
  - FD-6 语言策略：增订中文（CJK）字体回退方向
  - FD-7 暗色模式优先：增订"暗色为默认主主题、亮色为可选次主题"
Added sections:
  - FD-8 移动端定位（响应式降级）
Removed sections: 无（Open Questions 4 项已裁决，章节保留但置空）
Templates requiring updates:
  - .specify/templates/plan-template.md（Constitution Check 段）：⚠ 待定 —— 前端类
    feature 的 plan 应在 Constitution Check 引用 FD-1~FD-8（建议后续补，非本次范围）
  - .specify/templates/spec-template.md：✅ 无需改
  - .specify/templates/tasks-template.md：✅ 无需改
Follow-up TODOs:
  - 通用工程原则（测试纪律 / 版本策略 / 可观测性等）仍未制定，见「其他领域原则（Deferred）」
  - 亮色次主题与中文字体回退的具体取值落实到 DESIGN.md（非宪法职责，FD-1 已下放）
-->

# A 股自动盯盘 AI 助手 · Constitution

> 本宪法当前仅涵盖**前端设计系统**领域。其余领域（工程纪律、测试、版本等）的原则尚未
> 制定，见文末「其他领域原则（Deferred）」。

## 前端设计系统（Frontend Design System）

本章节为前端视觉与交互的**不可违反原则**。每条原则的形式为：原则 → 为什么不可违反 →
执行依据（引用具体素材文件）。原则只规定**方向**；所有具体取值（颜色 / 字号 / 间距 /
圆角 / 字体 / token 名）一律以执行依据文件为准，宪法不复制任何具体值。

### FD-1 视觉规范的唯一真理来源（Single Source of Visual Truth）

`DESIGN.md` 是颜色、字体层级、间距、圆角、阴影等一切视觉取值的**唯一权威来源**。任何页面
或组件的视觉属性 MUST 引用 `DESIGN.md` 中定义的设计 token，禁止在代码中硬编码魔法值或
另起一套数值。

- **为什么不可违反**：多处硬编码会让视觉规范分裂、无法统一演进；单一真理来源是设计系统
  可维护的前提。
- **执行依据**：`specs/design-reference/stitch-export/precision_terminal/DESIGN.md`
  （frontmatter 的 colors / typography / rounded / spacing 段）。

### FD-2 视觉参考样本的引用边界（Reference, Not Truth）

`design-reference/stitch-export/` 下的页面原型（截图 + 示例 HTML）是**视觉意图的样本**：
新建页面、改动布局、设计组件前 MUST 先比对相关原型，使产出与既定视觉语言一致。但原型是
「参考」而非「真理」—— 当原型与 `DESIGN.md` 的 token 冲突时，以 `DESIGN.md` 为准。

其中 **`precision_terminal` 为当前视觉基准方案**（它是 `DESIGN.md` 的出处）；其余原型
（dashboard / ai / a_ai_1 / a_ai_2 / alpha_terminal_platform）为备选探索，不作为基准。

- **为什么不可违反**：脱离样本会产出风格漂移的"另一个产品"；但若把原型里的临时取值当
  真理，又会绕过 FD-1。多方案并存时若无单一基准，又会让视觉语言发散。三者边界必须钉死。
- **执行依据**：`specs/design-reference/stitch-export/`（各方案目录下的 `screen.png`
  与 `code.html`；基准为 `precision_terminal/`）。

### FD-3 目标市场与用户群的不可妥协约定（Market & Persona Covenant）

面向 A 股市场与纪律型、数据驱动的盯盘用户，以下约定不可妥协：

1. **金融涨跌语义色必须遵守 A 股市场惯例**（与欧美惯例相反），不得套用国际配色；具体
   取值见 `DESIGN.md`。
2. **AI 生成内容必须在视觉上与市场原始数据明确区分**，且 AI 文本须带免责组件 ——
   呼应"不做投资建议"红线。
3. 设计服务于"严肃、权威、高效"的工具气质，不得为装饰牺牲专业感。

- **为什么不可违反**：涨跌色用反会造成致命误读；AI 与真实数据混淆 + 缺免责会触碰金融
  合规红线；这两点是本产品安全与可信的底线。
- **执行依据**：`specs/prd.md` §3（主画像）、§7.4（合规）；`DESIGN.md`「Brand &
  Style」「Colors / Sentiment Colors」「Components / AI Insights」。

### FD-4 组件基底与密度优先（Component Base & Density-First）

前端 MUST 以 `design-reference` 既定的 token 驱动实用类 CSS 方案为基底，组件为面向
**密集金融表格**的自建组件族。MUST NOT 引入与该 token 体系冲突、或以宽松留白破坏信息
密度的现成 UI 套件。

- **为什么不可违反**：换一套与 token 体系打架的组件库会让 FD-1 失效并破坏密度目标；
  自建密集组件是"单屏看尽全部自选股"体验的工程前提。
- **执行依据**：`design-reference/stitch-export/*/code.html`（既定实用类基底）；
  `DESIGN.md`「Components」段与 frontmatter 的 rounded / spacing。

### FD-5 信息密度与设计哲学（Information Density）

设计哲学是**高信息密度、技术精确、快速认知，功能优先于装饰性留白**，目标支持单屏可视
30+ 只股票。任何降低密度的"美化"改动 MUST 先对照本哲学评估，不得削弱密集监控能力。

- **为什么不可违反**：本产品的核心价值是"一屏看尽、快速认知"；牺牲密度等于削弱核心
  价值主张。
- **执行依据**：`DESIGN.md`「Brand & Style」「Layout & Spacing / Information
  Density」「Typography（紧凑字阶）」。

### FD-6 语言策略（Language）

UI MUST 以简体中文为准（视觉原型与 `specs/prd.md` 均为单一简体中文）；MVP 不做国际化 /
多语言切换。**中文字体走系统 CJK 回退策略**：保留 `DESIGN.md` 指定的拉丁字体，中文字符
回退到各平台系统中文字体，不强制加载自定义中文字体文件（避免拖累首屏与密度场景）。

- **为什么不可违反**：目标用户为中文 A 股散户；引入多语言或重型中文字体会增加无收益的
  复杂度并偏离既定原型与密度目标。
- **执行依据**：`specs/prd.md` §7.7（仅简体中文）；`design-reference` 原型为简体中文
  界面；字体族取值仍归 `DESIGN.md`（FD-1）。

### FD-7 暗色模式优先、亮色可选（Dark-First, Light Optional）

视觉系统 MUST 以**暗色模式为默认主主题**（长时间盯盘降低眼疲劳），通过色调分层与低对比
描边而非重阴影构建层级。**亮色模式作为可选次主题**：可提供，但其全部取值 MUST 同样源自
`DESIGN.md` 的 token 体系（不得为亮色另起一套硬编码数值）。

- **为什么不可违反**：暗色优先是 `DESIGN.md` 明确的根基哲学与盯盘人因要求；亮色作为
  可选项也必须服从 FD-1，否则双主题会让取值体系分裂。
- **执行依据**：`DESIGN.md`「Colors（Dark Mode first philosophy）」「Elevation &
  Depth（Tonal Layering）」；亮色 token 待补入 `DESIGN.md`。

### FD-8 移动端定位（响应式降级，Mobile as Read-Only Degraded）

移动端为**只读降级形态**，桌面为主操作面。移动视图 MUST 按既定移动断点隐藏次要列、优先
保留价格与涨跌幅等关键字段，不追求移动端完整编辑能力。

- **为什么不可违反**：主画像的主设备是桌面 + 手机收推送；把移动端做成一等公民会与既定
  画像和密度策略冲突、放大无收益的工作量。
- **执行依据**：`specs/prd.md` §3（设备：Mac 桌面 + iPhone 收推送）、§7.6；`DESIGN.md`
  「Layout & Spacing / Breakpoints（Mobile）」。

## 其他领域原则（Deferred）

工程纪律、测试策略、版本与破坏性变更、可观测性、安全等通用原则**尚未制定**，不在
「前端设计系统」范围内。这些原则留待后续单独 ratify —— **不替用户预设**未经讨论的约束。

## Governance

- 本宪法对前端视觉与交互的约束**高于**个人临时偏好与一次性视觉决定。
- 任何涉及前端视觉的 feature，其 `plan.md` 的 Constitution Check MUST 核对 FD-1~FD-8。
- 修订（新增 / 修改 / 删除原则）MUST 更新本文件顶部 Sync Impact Report 与版本号，遵循
  语义化版本：MAJOR = 原则移除或不兼容重定义；MINOR = 新增原则或实质性扩充；
  PATCH = 措辞澄清。
- 具体视觉取值的变更属 `DESIGN.md` 职责，不触发宪法版本变更（FD-1 已将取值权下放）。

## Open Questions

（暂无 —— 初版 4 项设计未决问题已于 2026-05-26 经用户裁决，并入 FD-2 / FD-6 / FD-7 /
FD-8。后续如出现新的未明确设计决策，在此登记等待裁决，不擅自补全。）

### Implementation Discipline (for Superpowers handoff)

- Before executing any tasks.md, ALWAYS read .specify/memory/constitution.md FIRST.
- Always follow TDD: Red (failing test) → Green (minimum code) → Refactor.
- Always update tasks.md checkbox after EACH task completes.
- After each task: commit, then STOP and wait for "next".
- All [FE] tasks: MUST read root DESIGN.md and the matched
  design-reference/stitch-export/<page>/ BEFORE writing any component code.

**Version**: 1.1.0 | **Ratified**: 2026-05-26 | **Last Amended**: 2026-05-26
