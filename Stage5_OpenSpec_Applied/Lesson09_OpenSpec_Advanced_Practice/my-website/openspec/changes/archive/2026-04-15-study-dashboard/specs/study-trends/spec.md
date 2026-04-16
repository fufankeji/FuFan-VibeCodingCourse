## ADDED Requirements

### Requirement: 展示学习趋势图表
Dashboard SHALL 展示一个学习趋势面板，以折线图显示用户的学习时长变化，支持周/月维度切换。

#### Scenario: 默认显示周趋势
- **WHEN** Dashboard 页面加载
- **THEN** 趋势图默认显示"本周"维度，X 轴为周一至周日，Y 轴为学习时长（分钟）

#### Scenario: 切换到月趋势
- **WHEN** 用户点击"月"切换按钮
- **THEN** 趋势图切换为"本月"维度，X 轴为日期（1-30/31），Y 轴为学习时长（分钟）

#### Scenario: 切换回周趋势
- **WHEN** 用户在月趋势视图下点击"周"切换按钮
- **THEN** 趋势图切换回"本周"维度

#### Scenario: 图表响应式适配
- **WHEN** 视口宽度变化
- **THEN** 图表宽度自适应容器，保持可读性

#### Scenario: 数据点为空
- **WHEN** mock 数据中某些日期无学习记录
- **THEN** 对应数据点显示为 0，折线连续不断裂
