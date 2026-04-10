## ADDED Requirements

### Requirement: 项目展示区域布局
项目展示 Section 必须（SHALL）位于 Hero Section 下方，使用 `id="projects"` 作为锚点目标，采用卡片式网格布局。

#### Scenario: Section 位置和锚点
- **GIVEN** 页面加载完成
- **WHEN** 用户向下滚动经过 Hero Section
- **THEN** 项目展示区域紧跟其后，具有 `id="projects"` 锚点

#### Scenario: 响应式网格布局
- **GIVEN** 用户使用不同宽度的设备
- **WHEN** 查看项目展示区域
- **THEN** 移动端单列堆叠，平板及以上两列网格，卡片等宽且间距均匀

#### Scenario: 暗色模式适配
- **GIVEN** 用户切换到暗色模式
- **WHEN** 查看项目展示区域
- **THEN** Section 背景、卡片背景、文字颜色均切换为暗色系配色

#### Scenario: 最少项目数量（边界）
- **GIVEN** 项目数据已配置
- **WHEN** 页面渲染项目展示区域
- **THEN** 至少展示 4 个项目卡片

### Requirement: 项目卡片内容
每张项目卡片必须（SHALL）包含项目截图、项目名称、项目简介和 GitHub 链接。

#### Scenario: 卡片内容完整展示
- **GIVEN** 页面加载完成
- **WHEN** 用户查看一张项目卡片
- **THEN** 卡片顶部展示项目截图，下方依次展示项目名称、简介，底部展示 GitHub 链接

#### Scenario: GitHub 链接在新标签页打开
- **GIVEN** 用户点击卡片上的 GitHub 链接
- **WHEN** 链接被触发
- **THEN** 在新标签页中打开 GitHub 仓库页面，当前页面不跳转

#### Scenario: 截图缺失时的降级（边界）
- **GIVEN** 某个项目的截图路径不存在或加载失败
- **WHEN** 页面渲染该卡片
- **THEN** 截图区域展示占位背景色，不出现破碎图片图标

### Requirement: 项目截图 lazy loading
所有项目截图必须（SHALL）使用 lazy loading，不阻塞首屏加载。

#### Scenario: 截图延迟加载
- **GIVEN** 项目展示区域在首屏以下
- **WHEN** 页面首次加载
- **THEN** 项目截图不随首屏加载，当用户滚动到可视区域附近时才加载

#### Scenario: 图片加载前无布局偏移（边界）
- **GIVEN** 截图尚未加载
- **WHEN** 用户滚动到项目区域
- **THEN** 截图区域保持固定高宽比占位，加载后无布局跳动（CLS）

### Requirement: 卡片悬浮微交互
项目卡片必须（SHALL）在鼠标悬浮时展示微交互效果。

#### Scenario: 悬浮时卡片上移 + 阴影增强
- **GIVEN** 用户使用支持 hover 的设备
- **WHEN** 鼠标悬浮到某张项目卡片上
- **THEN** 卡片轻微上移并增强阴影，提供视觉反馈

#### Scenario: 触屏设备无悬浮效果（边界）
- **GIVEN** 用户使用触屏设备（无 hover 能力）
- **WHEN** 用户触摸卡片
- **THEN** 不产生意外的悬浮状态残留

#### Scenario: prefers-reduced-motion 下微交互（边界）
- **GIVEN** 用户系统开启了 `prefers-reduced-motion: reduce`
- **WHEN** 鼠标悬浮到卡片
- **THEN** 悬浮 transition 被禁用，仅保留阴影变化（无位移）
