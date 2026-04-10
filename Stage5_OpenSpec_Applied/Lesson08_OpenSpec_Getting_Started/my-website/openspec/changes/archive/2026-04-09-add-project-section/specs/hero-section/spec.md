## MODIFIED Requirements

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
