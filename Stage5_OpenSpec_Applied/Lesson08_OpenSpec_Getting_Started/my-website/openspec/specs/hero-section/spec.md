## ADDED Requirements

### Requirement: 全屏 Hero 区域展示
Hero Section 必须（SHALL）占据整个视口高度，在页面顶部作为首屏内容展示。

#### Scenario: 桌面端正常展示
- **GIVEN** 用户使用桌面浏览器访问首页
- **WHEN** 页面加载完成
- **THEN** Hero Section 占据整个视口高度，内容垂直水平居中

#### Scenario: 移动端视口适配
- **GIVEN** 用户使用移动端浏览器访问（地址栏可能收缩/展开）
- **WHEN** 页面加载完成
- **THEN** Hero Section 使用动态视口高度（dvh），正确适配地址栏变化

#### Scenario: 内容超出视口（边界）
- **GIVEN** 用户设备屏幕非常小（如横屏手机）
- **WHEN** 文字内容高度超过视口
- **THEN** Hero Section 高度自动撑开（min-height 而非固定 height），内容不被截断

### Requirement: 个人信息展示
Hero Section 必须（SHALL）居中展示用户的姓名、职业和一句话介绍。

#### Scenario: 信息完整展示
- **GIVEN** 页面加载完成
- **WHEN** 用户查看 Hero 区域
- **THEN** 姓名以最大标题（h1）展示，职业和一句话介绍以副文本展示，三者垂直排列且水平居中

#### Scenario: 长文本响应式处理（边界）
- **GIVEN** 用户在小屏设备上查看
- **WHEN** 姓名或介绍文字较长
- **THEN** 文字自动换行，字号响应式缩小，不产生水平溢出

### Requirement: CTA 按钮跳转
Hero Section 必须（SHALL）包含一个 CTA 按钮，点击后跳转到项目展示区域。

#### Scenario: 点击 CTA 跳转
- **GIVEN** 页面中存在 `#projects` 锚点目标（项目展示 Section）
- **WHEN** 用户点击 CTA 按钮
- **THEN** 页面平滑滚动到项目展示区域

#### Scenario: 目标锚点不存在（边界）
- **GIVEN** 页面中尚未创建 `#projects` 区域
- **WHEN** 用户点击 CTA 按钮
- **THEN** 页面不产生报错，按钮行为表现为标准锚点链接（无目标时不跳转）

#### Scenario: 键盘可访问
- **GIVEN** 用户使用键盘导航
- **WHEN** 用户 Tab 聚焦到 CTA 按钮并按 Enter
- **THEN** 触发与点击相同的跳转行为，按钮具有可见的 focus 样式

### Requirement: 粒子背景效果
Hero Section 必须（SHALL）展示 CSS 渐变底层 + Canvas 粒子叠加的科技感背景。

#### Scenario: 桌面端粒子展示
- **GIVEN** 用户使用桌面浏览器访问
- **WHEN** 页面加载完成
- **THEN** 背景展示渐变色底层和粒子连线效果，粒子层不遮挡文字内容的交互

#### Scenario: prefers-reduced-motion 降级（边界）
- **GIVEN** 用户系统开启了 `prefers-reduced-motion: reduce`
- **WHEN** 页面加载完成
- **THEN** 粒子效果完全禁用，仅展示渐变背景

#### Scenario: 低端设备性能降级（边界）
- **GIVEN** 用户设备为低端设备（CPU 核心数 ≤ 2）
- **WHEN** 页面加载完成
- **THEN** 粒子数量大幅减少或降级为纯渐变，确保不影响页面流畅度
