/**
 * ============================================================
 *  AgentHub Design Token Normalization Report (Prep-03 rev.1)
 *  Generated: 2026-04-20
 *  Scope: 7 pages + layout + 4 UI components (button / input / badge / card)
 * ============================================================
 *
 *  Audit Constraints Applied:
 *    C1 — 命名严禁出现值语义（blue / 220deg / 500 / main / mainColor）
 *    C2 — 聚合时必须给出理由（Delta E / 频次 / 语义），不能无理由合并
 *    C3 — 所有非阶梯值必须显式列出调整前后
 *    C4 — 无法归入阶梯的值，标记"保留 hardcoded，不纳入变量系统"并说明原因
 *
 *
 * ================================================================
 *  0. NAMING AUDIT (C1)
 * ================================================================
 *
 *  Token 命名全量扫描结果：
 *
 * | Token 名称              | 是否含值语义 | 判定  | 处理                          |
 * |-------------------------|-------------|-------|-------------------------------|
 * | color.bg.base           | 否（层级语义） | PASS  | —                             |
 * | color.bg.subtle         | 否（层级语义） | PASS  | —                             |
 * | color.bg.muted          | 否（层级语义） | PASS  | —                             |
 * | color.bg.elevated       | 否（层级语义） | PASS  | —                             |
 * | color.fg.default        | 否（状态语义） | PASS  | —                             |
 * | color.fg.secondary      | 否（状态语义） | PASS  | —                             |
 * | color.fg.muted          | 否（层级语义） | PASS  | —                             |
 * | color.fg.disabled       | 否（状态语义） | PASS  | —                             |
 * | color.border.default    | 否（状态语义） | PASS  | —                             |
 * | color.border.subtle     | 否（层级语义） | PASS  | —                             |
 * | color.border.strong     | 否（层级语义） | PASS  | —                             |
 * | color.primary.default   | 否（角色语义） | PASS  | —                             |
 * | color.primary.hover     | 否（交互语义） | PASS  | —                             |
 * | color.primary.active    | 否（交互语义） | PASS  | —                             |
 * | color.primary.fg        | 否（角色语义） | PASS  | —                             |
 * | color.success           | 否（状态语义） | PASS  | —                             |
 * | color.warning           | 否（状态语义） | PASS  | —                             |
 * | color.error             | 否（状态语义） | PASS  | —                             |
 * | text.xs ~ text.5xl      | 否（T-shirt 尺码） | PASS | —                          |
 * | space.0 ~ space.16      | 否（序数阶梯） | PASS  | 数字是序号而非像素值（space.1=4px） |
 * | radius.sm ~ radius.full | 否（T-shirt 尺码） | PASS | —                          |
 * | --text-12 ~ --text-36   | **是（literal px）** | **FAIL** | **rev.1 已删除**。原为数值别名，名称直接编码像素值。globals.css 中已移除，仅保留语义别名 xs~5xl |
 *
 *  结论：rev.1 修正后，全部 token 命名 PASS。
 *
 *
 * ================================================================
 *  A. COLOR NORMALIZATION (C2 + C3)
 * ================================================================
 *
 *  Scale:
 *    bg.{base, subtle, muted, elevated}
 *    fg.{default, secondary, muted, disabled}
 *    border.{default, subtle, strong}
 *    primary.{default, hover, active, fg}
 *    status.{success, warning, error}
 *
 * | 原值                                   | 映射到                                     | 出现节点数 | 聚合/调整理由                                                            |
 * |----------------------------------------|--------------------------------------------|-----------|--------------------------------------------------------------------------|
 * | `hover:brightness-105`                 | `not-disabled:hover:border-border-strong`   | 1         | 语义：brightness 滤镜在暗色主题下色偏不可控（亮度偏移而非色阶提升），改为语义化 border 提亮，与 button hover 策略一致 |
 * | `active:brightness-[0.97]`             | `not-disabled:active:bg-bg-subtle`          | 1         | 语义：0.97 缩放在不同底色上视觉差异不一致；改为固定层级 bg-subtle 降暗，与全局 active 反馈策略统一 |
 * | （其余全部页面/组件颜色）                 | 已使用语义 token                             | 146       | 扫描结果：0 处 hardcoded hex/hsl/rgb/oklch 值（不含第三方组件 recharts 内部选择器，见 E 节） |
 *
 *  结论：色板 18 token 全量覆盖，无孤立色值，无 Delta-E 近似合并需求。
 *
 *
 * ================================================================
 *  B. SPACING NORMALIZATION (C2 + C3)
 * ================================================================
 *
 *  Scale (4px base):
 *    space.0=0 / space.1=4 / space.2=8 / space.3=12 / space.4=16
 *    space.5=20 / space.6=24 / space.8=32 / space.10=40 / space.12=48 / space.16=64
 *
 * | 原值（调整前）          | 映射到（调整后）       | 出现节点数 | 聚合/调整理由                                                                                                |
 * |------------------------|----------------------|-----------|--------------------------------------------------------------------------------------------------------------|
 * | `1px`  (py)            | `space.0` (0)        | 2         | 频次：仅 2 处，均为 Badge 微内边距。语义：Badge 高度由 line-height 撑住，1px padding 无实质贡献；1 不在阶梯，向下 round → 0 |
 * | `2px`  (py)            | `space.1` (4px)      | 2         | 频次：仅 2 处，均为能力标签 Badge。语义：向上 round → 4px 保证最小可点击区域（WCAG Touch Target 辅助）；2 不在阶梯 |
 * | `6px`  (gap/px/py/mx/mr/mb) | `space.2` (8px) | 25        | 频次：高频（25 处）。语义：全部用于图标-文字间距、列表行距、面包屑分隔等"紧凑间距"场景。Delta：|6-8|=2px，在 13px 字号上下文中视觉变化 < 1 字符宽度，人眼不可辨 |
 * | `10px` (px/py/gap)     | `space.3` (12px)     | 10        | 频次：中频（10 处）。语义：全部用于"中号控件内边距"（筛选按钮/Tab/状态 Badge）。10 位于 space.2(8) 与 space.3(12) 之间，上下文为控件内边距，向上 round → 12 保证点击区域充足 |
 * | `22px` (-top)          | `space.6` (24px)     | 1         | 频次：孤立值（1 处）。语义：Trace 瀑布图 tooltip 偏移量，22 不在阶梯。Delta：|22-24|=2px，tooltip offset 场景误差不可感知，向上 round → 24 |
 *
 *  逐文件变更清单：
 *
 *    Landing.tsx (2 处)
 *      px-[6px] py-[1px]  → px-[8px] py-0          Badge 能力标签
 *
 *    Gallery.tsx (8 处)
 *      rounded-[6px] px-[10px] py-[6px] → rounded-[8px] px-[12px] py-[8px]   筛选按钮 "全部"
 *      rounded-[6px] px-[10px] py-[6px] → rounded-[8px] px-[12px] py-[8px]   筛选按钮 分类项
 *      gap-[6px]                         → gap-[8px]                           提供商 checkbox 列表
 *      gap-[6px]                         → gap-[8px]                           能力 badge 列表
 *      py-[2px]                          → py-[4px]                            能力 badge 垂直
 *      px-[6px] py-[1px]                 → px-[8px] py-0                       卡片内 Badge 能力标签
 *
 *    AgentDetail.tsx (12 处)
 *      mx-[6px] x2                       → mx-[8px]                            面包屑分隔符
 *      gap-[6px]                          → gap-[8px]                           作者行间距
 *      mb-[6px]                           → mb-[8px]                            能力标签标题
 *      gap-[6px]                          → gap-[8px]                           能力标签列表
 *      py-[2px]                           → py-[4px]                            能力 Badge
 *      mb-[6px]                           → mb-[8px]                            描述标题
 *      gap-[6px]                          → gap-[8px]                           模型选择器 label-select
 *      gap-[6px]                          → gap-[8px]                           温度选择器 label-range
 *      gap-[6px]                          → gap-[8px]                           发送按钮内部
 *      gap-[10px]                         → gap-[12px]                          相似 Agent 卡片图标+文字
 *
 *    RunHistory.tsx (10 处)
 *      space-y-[6px]                      → space-y-[8px]                       骨架屏列表行距
 *      space-y-[6px]                      → space-y-[8px]                       运行列表行距
 *      gap-[6px]                          → gap-[8px]                           运行条目内部间距
 *      px-[10px]                          → px-[12px]                           md 下 tab 水平 padding
 *      px-[10px]                          → px-[12px]                           状态 Badge padding
 *      gap-[6px]                          → gap-[8px]                           瀑布图节点间距
 *      -top-[22px]                        → -top-[24px]                         瀑布图 tooltip 偏移
 *      gap-[6px] x3                       → gap-[8px]                           图例项 icon-text 间距
 *      py-[10px] x3                       → py-[12px]                           底部 tab 垂直 padding
 *
 *    Settings.tsx (5 处)
 *      gap-[6px] py-[10px]                → gap-[8px] py-[12px]                 移动端 tab 按钮
 *      gap-[10px]                         → gap-[12px]                          桌面端侧栏按钮 icon-text
 *      gap-[6px] x2                       → gap-[8px]                           表单 label-input 间距
 *      mr-[6px]                           → mr-[8px]                            保存按钮图标右边距
 *
 *    Pipeline.tsx (6 处)
 *      mr-[6px] x3                        → mr-[8px]                            按钮图标右边距
 *      rounded-[6px] x3                   → rounded-[8px]                       节点图标/select/textarea
 *
 *    input.tsx (1 处)
 *      hover:brightness-105 active:brightness-[0.97]
 *        → not-disabled:hover:border-border-strong not-disabled:active:bg-bg-subtle
 *
 *
 * ================================================================
 *  C. FONT SIZE NORMALIZATION (C3)
 * ================================================================
 *
 *  Scale:
 *    text.xs=12 / text.sm=13 / text.base=14 / text.md=15 / text.lg=16
 *    text.xl=18 / text.2xl=20 / text.3xl=24 / text.4xl=30 / text.5xl=36
 *
 * | 原值   | 映射到  | 出现节点数 | 调整理由 |
 * |--------|---------|-----------|---------|
 * | (无)   | —       | —         | 全部 146 处 font-size 均已在阶梯上，无非阶梯值 |
 *
 *  频次分布：
 *    12px → 28x  |  13px → 34x  |  14px → 42x  |  15px → 8x   |  16px → 12x
 *    18px → 6x   |  20px → 8x   |  24px → 2x   |  30px → 5x   |  36px → 1x
 *
 *
 * ================================================================
 *  D. BORDER RADIUS NORMALIZATION (C2 + C3 + C4)
 * ================================================================
 *
 *  Scale:
 *    radius.sm=4 / radius.md=8 / radius.lg=12 / radius.xl=16 / radius.full=9999
 *
 * | 原值               | 映射到              | 出现节点数 | 聚合/调整理由                                                                             |
 * |---------------------|---------------------|-----------|-------------------------------------------------------------------------------------------|
 * | `rounded-[6px]`     | `radius.md` (8px)   | 8         | 语义：全部出现在交互控件（select/按钮/图标容器），与 button 8px 圆角保持一致。Delta：|6-8|=2px，在 32~40px 高度控件上视觉差异极小 |
 * | `rounded-[4px]`     | `radius.sm` (4px)   | 5         | 已在阶梯上，无需调整                                                                       |
 * | `rounded-[8px]`     | `radius.md` (8px)   | 38        | 已在阶梯上，核心控件圆角                                                                   |
 * | `rounded-full`      | `radius.full` (9999)| 14        | 已在阶梯上，Badge / 状态点 / 头像                                                          |
 * | `rounded-[2px]`     | **保留 hardcoded，不纳入变量系统** | 3 | 原因：仅出现在第三方 shadcn 组件（tooltip.tsx Arrow + chart.tsx Legend indicator）。这些是 shadcn/Radix 内部视觉元素，2px 是其设计规范中的 micro-radius，与我们的 4px 起步阶梯不兼容。强改会破坏 Arrow 对齐和 Legend 色块比例。标记为第三方样式例外，不纳入 AgentHub 变量系统。 |
 *
 *
 * ================================================================
 *  E. HARDCODED 保留清单 (C4)
 * ================================================================
 *
 *  以下值经审计判定为无法/不应归入变量系统，显式保留：
 *
 * | 值                            | 出现位置                  | 出现数 | 保留原因                                                                                         |
 * |-------------------------------|--------------------------|--------|--------------------------------------------------------------------------------------------------|
 * | `rounded-[2px]`               | tooltip.tsx, chart.tsx   | 3      | 第三方 shadcn/Radix 内部微圆角，2px 不在阶梯（阶梯起步 4px），强改破坏 Arrow 几何和 Legend 色块比例      |
 * | `text-underline-offset: 2px`  | globals.css @layer base  | 1      | CSS 排版微调值，控制下划线与基线的距离，属于排版引擎参数而非间距系统范畴。2px 是行业惯例值（Chrome 默认 1px），不适合归入 4px 阶梯 |
 * | `top-[80px]`                  | layout.tsx               | 1      | 布局复合值 = space.16(64px) + space.4(16px)，是 header 高度 + buffer 的复合计算结果。建议未来抽成 `--layout-header-offset` 语义变量，当前保留 hardcoded |
 * | `h-[300px]` / `h-[320px]`     | AgentDetail / Pipeline   | 2      | 内容区固定高度，由 UI 内容量决定而非间距系统。不属于 spacing token 范畴                                    |
 * | `min-h-[80px/160px/500px]`    | Gallery / AgentDetail / Landing | 3 | 内容区最小高度约束，由布局需求决定。与间距阶梯无关                                                      |
 * | `w-[180px] ~ w-[360px]`       | Settings / Pipeline / Gallery   | 5 | 面板固定宽度，由信息架构决定（侧栏、筛选栏、节点宽度）。不属于 spacing token 范畴                         |
 * | `max-w-[400px] ~ max-w-[1280px]` | Landing / Layout / Pricing | 5 | 容器最大宽度，由排版折行点决定。属于 layout breakpoint 范畴，不属于 spacing token                         |
 * | `#ccc` / `#fff` (in CSS selectors) | chart.tsx             | 4      | recharts 库内部 SVG 元素的 stroke/fill 属性选择器（如 `[stroke='#ccc']`），不是我们设置的颜色值，而是用于匹配 recharts 渲染的 DOM 属性。无法替换为变量 |
 * | `ring-offset-[var(--bg-base)]` | button.tsx              | 1      | focus ring offset 需要引用 CSS 变量以适配动态背景色。Tailwind 不支持 `ring-offset-bg-base` 写法，必须用 arbitrary value 透传。值本身引用了语义 token，仅写法为 hardcoded |
 *
 *
 * ================================================================
 *  SUMMARY
 * ================================================================
 *
 *  总扫描范围：7 pages + 1 layout + 4 UI components + 1 globals.css = 13 files
 *
 *  | 维度       | 非阶梯数 | 已修复数 | 保留 hardcoded 数 | 保留原因                              |
 *  |-----------|---------|---------|-------------------|---------------------------------------|
 *  | 命名 (C1)  | 10      | 10      | 0                 | --text-12~36 数值别名已删除             |
 *  | 颜色 (C2)  | 2       | 2       | 4                 | recharts CSS 属性选择器中的 #ccc/#fff    |
 *  | 间距 (C3)  | 40      | 40      | 16                | 布局尺寸/容器宽度/内容高度（见 E 节）      |
 *  | 字号       | 0       | 0       | 0                 | 全部在阶梯                              |
 *  | 圆角 (C4)  | 8       | 8       | 3                 | shadcn rounded-[2px]（见 E 节）         |
 *  | 排版微调    | 0       | 0       | 1                 | text-underline-offset: 2px（见 E 节）   |
 *  | **合计**   | **60**  | **60**  | **24**            |                                       |
 *
 *  所有修复已 inline 应用到代码。
 *  所有保留项已在 E 节逐条标注"保留 hardcoded，不纳入变量系统"并说明原因。
 *  全部 token 命名已通过 C1 约束校验，无值语义残留。
 */

export {};
