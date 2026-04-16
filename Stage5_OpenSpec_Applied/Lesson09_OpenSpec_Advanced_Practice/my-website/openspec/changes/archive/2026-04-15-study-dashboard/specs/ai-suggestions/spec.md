## ADDED Requirements

### Requirement: 展示 AI 学习建议面板
Dashboard SHALL 展示一个 AI 学习建议面板，显示 mock 的学习建议卡片列表。

#### Scenario: 渲染建议列表
- **WHEN** Dashboard 页面加载
- **THEN** 显示"AI 学习建议"面板，包含若干建议卡片，每张含标题、描述文字和分类标签

#### Scenario: 建议卡片分类标签
- **WHEN** 建议卡片渲染
- **THEN** 每张卡片 SHALL 展示一个彩色分类标签（如"复习"、"新课"、"练习"），不同分类使用不同颜色

#### Scenario: 空建议列表
- **WHEN** mock 数据返回空建议列表
- **THEN** 显示空状态提示文案（如"暂无学习建议"）
