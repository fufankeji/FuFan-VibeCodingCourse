## ADDED Requirements

### Requirement: 固定顶部导航栏
导航栏必须（SHALL）固定在页面顶部，滚动时始终可见，并具有背景模糊半透明效果。

#### Scenario: 页面滚动时导航栏始终可见
- **GIVEN** 用户在页面中
- **WHEN** 用户向下滚动页面
- **THEN** 导航栏始终固定在视口顶部，不随页面滚动消失

#### Scenario: 背景模糊效果
- **GIVEN** 导航栏下方有内容（如 Hero 的渐变和粒子）
- **WHEN** 用户查看导航栏
- **THEN** 导航栏背景为半透明 + backdrop-blur，下方内容模糊可见

#### Scenario: 暗色模式适配
- **GIVEN** 用户切换到暗色模式
- **WHEN** 查看导航栏
- **THEN** 导航栏背景色、文字色、链接色均切换为暗色系配色

#### Scenario: 导航栏不遮挡可交互内容（边界）
- **GIVEN** 导航栏使用 fixed 定位覆盖在页面之上
- **WHEN** 用户滚动到某个 section
- **THEN** section 内容不被导航栏遮挡（通过 scroll-margin-top 偏移）

### Requirement: Logo/名字展示
导航栏左侧必须（SHALL）展示个人 Logo 或名字。

#### Scenario: 名字正常展示
- **GIVEN** 页面加载完成
- **WHEN** 用户查看导航栏左侧
- **THEN** 展示个人名字，点击可回到页面顶部

#### Scenario: 小屏幕名字不被截断（边界）
- **GIVEN** 用户使用窄屏设备
- **WHEN** 查看导航栏
- **THEN** 名字保持完整展示，不与右侧导航链接重叠

### Requirement: 导航链接锚点跳转
导航栏右侧必须（SHALL）包含首页、项目、联系我三个链接，点击后平滑滚动到对应 section。

#### Scenario: 点击导航链接平滑跳转
- **GIVEN** 页面中存在对应的 section 锚点
- **WHEN** 用户点击「项目」链接
- **THEN** 页面平滑滚动到 `#projects` 区域

#### Scenario: 键盘导航
- **GIVEN** 用户使用键盘
- **WHEN** 用户 Tab 遍历导航链接并按 Enter
- **THEN** 触发与点击相同的跳转行为，链接具有可见的 focus 样式

#### Scenario: 目标 section 不存在（边界）
- **GIVEN** 某个目标 section 尚未创建
- **WHEN** 用户点击对应的导航链接
- **THEN** 页面不报错，表现为标准锚点链接行为

### Requirement: 移动端响应式菜单
在移动端视口下，导航栏必须（SHALL）将右侧链接收入汉堡菜单，点击展开/收起。

#### Scenario: 移动端显示汉堡按钮
- **GIVEN** 用户使用移动端设备（视口宽度 < md 断点）
- **WHEN** 页面加载完成
- **THEN** 右侧导航链接隐藏，显示汉堡菜单按钮

#### Scenario: 点击汉堡按钮展开菜单
- **GIVEN** 移动端汉堡菜单处于关闭状态
- **WHEN** 用户点击汉堡按钮
- **THEN** 导航链接和 ThemeToggle 以下拉面板形式展开

#### Scenario: 点击链接后自动收起菜单
- **GIVEN** 移动端汉堡菜单处于展开状态
- **WHEN** 用户点击某个导航链接
- **THEN** 菜单自动收起，页面平滑滚动到目标 section

#### Scenario: 汉堡按钮键盘可访问（边界）
- **GIVEN** 用户使用键盘导航
- **WHEN** 用户 Tab 到汉堡按钮并按 Enter 或 Space
- **THEN** 菜单展开/收起，按钮具有可见的 focus 样式和正确的 aria-label

### Requirement: ThemeToggle 整合
ThemeToggle 必须（SHALL）从独立的 fixed 定位移入导航栏内部。

#### Scenario: 桌面端 Toggle 在导航栏右侧
- **GIVEN** 用户使用桌面浏览器
- **WHEN** 页面加载完成
- **THEN** ThemeToggle 显示在导航链接右侧，不再独立浮动

#### Scenario: 移动端 Toggle 在展开菜单中
- **GIVEN** 用户使用移动设备并展开汉堡菜单
- **WHEN** 查看展开面板
- **THEN** ThemeToggle 在展开面板中可见可操作

#### Scenario: Toggle 被移除 fixed 定位后不残留（边界）
- **GIVEN** ThemeToggle 已从 App.tsx 移入 Navbar
- **WHEN** 页面渲染
- **THEN** 页面中只有一个 ThemeToggle 实例，无重复或残留
