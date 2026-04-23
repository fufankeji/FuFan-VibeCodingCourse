# Feature Specification: Landing Hero 动态粒子背景

**Feature Branch**: `evolution`（复用现有 evolution 分支，不新建 feature 分支）
**Spec Directory**: `specs/004-particle-bg`
**Created**: 2026-04-20
**Status**: Clarified
**Input**: User description: "在 Landing 页 Hero 区（'下一代 AI Agent 构建、编排与分发平台' 那一屏）背后加一层动态粒子背景，让页面第一印象更高大上。"

## Clarifications

### Session 2026-04-20

> 用户在 `/speckit-clarify` 触发语中一次性回答了全部问题，此处直接落盘，不再进入交互式问答流程。

- Q: 粒子数量如何分叉？ → A: 桌面（viewport ≥ 768px）渲染 60 颗；移动（viewport < 768px）渲染 20 颗
- Q: 粒子颜色从哪里取？ → A: 从 @theme token `--color-primary-default`（现值 hsl(220 90% 60%)）取色，逐粒随机 alpha 0.3–0.6；严禁硬编码 hex
- Q: 是否需要鼠标交互（引力 / 视差 / 点击爆炸）？ → A: 不需要，纯被动漂浮。粒子 canvas 必须 pointer-events: none，不拦截 Hero 内按钮点击
- Q: 无障碍策略？ → A: 必须响应 `prefers-reduced-motion: reduce`，命中时停止 requestAnimationFrame 循环，以静态渐变替代（不可出现空洞黑底）
- Q: 主题切换适配？ → A: 本期不处理。Landing 当前暗色为主，亮/暗主题色值联动留到下一个 spec
- Q: 性能预算？ → A: 桌面稳定 60fps；新增 gzip 后 bundle ≤ 3KB；零新 npm 依赖（仅用原生 Canvas 2D API）

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 首访者看到有"呼吸感"的 Hero 背景 (Priority: P1)

首次访问 Landing 页的访客在看到 Hero 主标题前，眼睛会先被一层缓慢漂浮的粒子光点吸引。背景的动态不抢戏——只是让"下一代 AI Agent 构建、编排与分发平台"这句主张看起来活着、在呼吸，而不是一张静态 PPT 截图。

**Why this priority**: 这是该功能唯一的核心价值点。如果这一层动效不存在或劣化成静态图，功能本身就失去存在意义。

**Independent Test**: 打开 http://localhost:3000，Hero 区应看到缓慢移动的粒子；粒子在主标题、副标题、CTA 按钮**后面**，不遮挡、不影响点击；其余 section（精选 Agent / ValueProps / Stats）视觉上零变化。

**Acceptance Scenarios**:

1. **Given** 桌面 Chrome 最新版打开 Landing 页, **When** 页面加载完成, **Then** Hero 区出现缓慢漂浮的粒子，约 60 颗，颜色源自品牌主色，不明显抢视线
2. **Given** 同一页面, **When** 用户点击 Hero 区的 "立即开始" / "查看 Playground" 按钮, **Then** 按钮正常响应，粒子不阻断鼠标事件
3. **Given** 同一页面, **When** 用户向下滚动至 "精选 Agent" section, **Then** 粒子背景**不会**溢出到 Hero 之外

### User Story 2 - 移动端访客得到性能友好的降级体验 (Priority: P2)

手机用户打开 Landing 页，仍然感受到"高级动效"，但粒子数量自动减少，滚动依然顺滑。

**Why this priority**: 2026 年移动流量占比过半，不能因为桌面动效拖垮移动首屏。

**Independent Test**: iPhone Safari 或 Chrome DevTools mobile emulation 下打开 Landing，Hero 粒子数量明显少于桌面，滚动帧率保持平稳。

**Acceptance Scenarios**:

1. **Given** viewport 宽度 < 768px, **When** Hero 渲染, **Then** 粒子数量降至约 20 颗
2. **Given** 移动浏览器, **When** 滚动 Landing 页, **Then** 感知帧率 ≥ 50fps，无明显掉帧

### User Story 3 - 偏好"减少动效"的用户看到静态友好版本 (Priority: P2)

开启了系统无障碍偏好 `prefers-reduced-motion` 的用户（前庭失调、晕动症、低功耗模式等），打开 Landing 页时看不到移动粒子，只看到一层静态渐变作为视觉替代。

**Why this priority**: 无障碍是底线；粒子漂浮对前庭敏感用户可能直接诱发不适。

**Independent Test**: macOS 系统设置 → 辅助功能 → 显示 → 勾选 "减少动态效果"，刷新 Landing 页，Hero 区粒子应停止运动（或直接不绘制），Hero 视觉不崩。

**Acceptance Scenarios**:

1. **Given** 用户系统开启 reduce-motion, **When** Landing 页加载, **Then** 粒子不进入动画循环（静止或直接以静态渐变替代）
2. **Given** reduce-motion 下, **When** 查看 Hero, **Then** 不出现"空洞的黑底"，而是有平滑的静态渐变保持视觉完整

### Edge Cases

- **SSR 首屏闪烁**：粒子组件必须是客户端组件，SSR 阶段不应渲染 canvas 导致 hydration mismatch
- **Canvas 尺寸变化**：窗口 resize 时粒子画布需要重新适配尺寸，不出现黑边或拉伸
- **切换 tab 回来**：标签页被切走再切回，粒子动画不应卡死或累积丢失的时间
- **超长 Hero**：主标题/副标题因 i18n 变长导致 Hero section 高度变化时，粒子仍然铺满 Hero 背景
- **Hero 内部所有可点击元素**：粒子 canvas 必须 `pointer-events: none`，不拦截按钮 / 链接点击

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST 在 Landing 页 Hero section 背后渲染一层 canvas 动画，显示多颗缓慢漂浮的粒子
- **FR-002**: System MUST 从项目主色 token（@theme 中的 `primary-default`）取色，粒子颜色不得硬编码 hex
- **FR-003**: System MUST 根据 viewport 宽度分叉：桌面（≥ 768px）约 60 颗粒子，移动（< 768px）约 20 颗
- **FR-004**: System MUST 响应 `prefers-reduced-motion: reduce`——在该偏好下停止粒子动画循环，以静态渐变替代或完全静止
- **FR-005**: Canvas 图层 MUST 不拦截 Hero 内部其他元素的点击和悬停事件（pointer-events: none）
- **FR-006**: 粒子动画 MUST 使用 requestAnimationFrame 驱动，页面卸载时 MUST 清理动画循环避免内存泄漏
- **FR-007**: System MUST **不修改** Hero 以外任何 section（精选 Agent / ValueProps / Stats 零改动）
- **FR-008**: System MUST **不引入**任何新的 npm 依赖（无 tsparticles / three.js / particles.js 等）
- **FR-009**: System MUST **不修改** `src/app/globals.css` 的 @theme 段 / 项目 constitution / tailwind 配置
- **FR-010**: 粒子背景 MUST 不导致 Hero 区原有按钮 / 链接 / 文案的可访问性或可见性下降

### Key Entities

- **粒子 (Particle)**：在 canvas 内漂浮的一颗圆点。属性：x / y 坐标、vx / vy 速度向量、r 半径、alpha 透明度。无持久化，每次页面加载随机初始化
- **粒子背景组件 (ParticleBackground)**：一个客户端 React 组件，自治管理 canvas 创建、粒子生命周期、动画循环、窗口 resize、reduce-motion 响应

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 桌面用户首访 Landing 页时，Hero 区 100% 出现动态粒子效果
- **SC-002**: 移动端 Hero 粒子数 ≤ 桌面的 40%（≈ 20 / 60）
- **SC-003**: Landing 页 Lighthouse Performance 分数相较改动前回退不超过 3 分
- **SC-004**: 开启 prefers-reduced-motion 的用户 100% 看不到运动粒子
- **SC-005**: pnpm build 通过，bundle 新增 ≤ 3KB（gzip 后）
- **SC-006**: 除新建 `src/components/particle-background.tsx` 和修改 `src/app/page.tsx` Hero section 外，其余文件 diff 为 0

## Assumptions

- 用户使用支持 Canvas 2D API 的现代浏览器（Chrome / Safari / Firefox / Edge 近两年版本），不需要兼容 IE11 或无 canvas 环境
- Landing 页以暗色视觉为主，无需同时适配亮/暗主题切换（本次不处理主题响应）
- 项目已有 @theme token `--color-primary-default` 在 `src/app/globals.css`；粒子颜色通过 `var(--color-primary-default)` 或等价方式读取
- 粒子"交互"仅为被动漂浮，不需要响应鼠标移动 / 点击 / 视差
- Hero 以外的 section 已在既有代码中由其他 section 组件实现，本次**不触碰**

## Out of Scope

> 本段对 brownfield 安全性极为关键，严禁越界。

- ❌ **不修改 Landing 其他任何 section**：精选 Agent 卡片 / ValueProps 三栏 / Stats 数字区域的 JSX、样式、数据、顺序，一律不动
- ❌ **不修改任何其他页面**：`/playground`、`/runs`、`/settings`、`/api/agent-run` 等所有路由完全不碰
- ❌ **不引入新 npm 依赖**：不得新增 tsparticles / react-tsparticles / three.js / particles.js / canvas-confetti / pixi 等任何粒子 / 渲染库；canvas 全部用浏览器原生 Canvas 2D API 实现
- ❌ **不修改 @theme / globals.css**：现有 OKLCH / HSL token 不动，@layer base 不动，tailwind 配置不动
- ❌ **不修改 constitution / 三法衣**：`.specify/memory/constitution.md` 不碰
- ❌ **不修改 Hero 文案与结构**：主标题 "下一代 AI Agent 构建、编排与分发平台" 一字不改；副标题、CTA 按钮文案与数量、排版层级一律保留
- ❌ **不做主题切换适配**：亮色主题的粒子色值推导、主题切换动画，均属于下一个 spec
- ❌ **不做鼠标交互**：鼠标引力、点击爆炸、视差，均不在范围内
- ❌ **不做 SSR 粒子**：canvas 动画仅在客户端挂载后启动，不尝试在服务端预渲染粒子状态
