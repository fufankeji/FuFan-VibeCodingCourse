## ADDED Requirements

### Requirement: 展示学习概览统计卡片
Dashboard SHALL 在顶部展示 4 张统计卡片，分别显示：今日学习时长、完成任务数、连续打卡天数、学习效率。

#### Scenario: 正常渲染统计数据
- **WHEN** Dashboard 页面加载
- **THEN** 显示 4 张卡片，每张包含：指标图标、指标名称、数值、与昨日对比的变化趋势（↑/↓/—）

#### Scenario: 统计卡片响应式布局
- **WHEN** 视口宽度 ≥ 768px
- **THEN** 4 张卡片在一行内等宽排列
- **WHEN** 视口宽度 < 768px
- **THEN** 4 张卡片以 2×2 网格排列

#### Scenario: 数据为零时的展示
- **WHEN** 某项统计指标值为 0
- **THEN** 卡片正常渲染，显示 "0" 而非空白或错误状态
