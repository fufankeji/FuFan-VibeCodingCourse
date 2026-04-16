# study-stats Specification

## Purpose
TBD - created by archiving change study-dashboard. Update Purpose after archive.
## Requirements
### Requirement: 展示学习概览统计卡片
Dashboard SHALL 在顶部展示统计卡片，数据从后端 API 实时获取。

#### Scenario: 正常渲染真实统计数据
- **WHEN** Dashboard 页面加载且用户已认证
- **THEN** 统计卡片调用 `GET /api/analytics/stats` 获取真实数据并展示

#### Scenario: API 请求失败时降级
- **WHEN** 统计 API 返回错误
- **THEN** 卡片显示"加载失败"提示，不显示错误的数值

#### Scenario: 统计卡片响应式布局
- **WHEN** 视口宽度 ≥ 768px
- **THEN** 卡片在一行内等宽排列
- **WHEN** 视口宽度 < 768px
- **THEN** 卡片以 2×2 网格排列

