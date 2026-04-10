## ADDED Requirements

### Requirement: 亮暗模式切换按钮
页面必须（SHALL）提供一个可见的主题切换按钮，允许用户在亮色和暗色模式间手动切换。

#### Scenario: 点击切换主题
- **GIVEN** 当前为亮色模式
- **WHEN** 用户点击主题切换按钮
- **THEN** 页面立即切换为暗色模式，按钮图标更新为对应状态

#### Scenario: 反向切换
- **GIVEN** 当前为暗色模式
- **WHEN** 用户点击主题切换按钮
- **THEN** 页面立即切换为亮色模式，按钮图标更新为对应状态

#### Scenario: 键盘可访问（边界）
- **GIVEN** 用户使用键盘导航
- **WHEN** 用户 Tab 聚焦到切换按钮并按 Enter 或 Space
- **THEN** 触发主题切换，按钮具有可见的 focus 样式

### Requirement: 主题偏好持久化
系统必须（SHALL）将用户的主题选择持久化到 localStorage，刷新后保持不变。

#### Scenario: 刷新后保持选择
- **GIVEN** 用户手动切换为暗色模式
- **WHEN** 用户刷新页面
- **THEN** 页面以暗色模式加载，无闪烁

#### Scenario: 首次访问使用系统偏好
- **GIVEN** 用户首次访问（localStorage 无记录）且系统设置为暗色模式
- **WHEN** 页面加载
- **THEN** 页面以暗色模式展示

#### Scenario: 首次访问且无系统偏好（边界）
- **GIVEN** 用户首次访问且系统未明确设置颜色偏好
- **WHEN** 页面加载
- **THEN** 页面以亮色模式展示（默认值）

### Requirement: 防止主题闪烁（FOUC）
系统必须（SHALL）在 React 挂载前确定主题，避免页面加载时出现主题闪烁。

#### Scenario: 暗色用户无闪白
- **GIVEN** 用户 localStorage 中存储了暗色模式偏好
- **WHEN** 页面开始加载（HTML 解析阶段）
- **THEN** `<html>` 元素在 React 挂载前就已添加 `dark` class，用户不会看到亮色闪烁

#### Scenario: 脚本加载失败降级（边界）
- **GIVEN** 内联主题检测脚本因某种原因未执行
- **WHEN** 页面加载
- **THEN** React 挂载后由 ThemeContext 兜底设置正确主题，最坏情况仅出现短暂闪烁

### Requirement: 主题对粒子背景的联动
主题切换时，粒子背景的颜色配置必须（SHALL）随之更新。

#### Scenario: 切换到暗色模式时粒子颜色更新
- **GIVEN** 当前为亮色模式，粒子为深色调
- **WHEN** 用户切换到暗色模式
- **THEN** 渐变背景变为深色系，粒子颜色更新为浅色调

#### Scenario: 切换时粒子不销毁重建（边界）
- **GIVEN** 粒子正在渲染中
- **WHEN** 用户切换主题
- **THEN** 粒子通过配置更新（refresh）而非销毁重建来改变颜色，避免视觉断裂
