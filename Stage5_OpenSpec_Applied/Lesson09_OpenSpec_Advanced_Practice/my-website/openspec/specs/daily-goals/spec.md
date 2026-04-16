# daily-goals Specification

## Purpose
TBD - created by archiving change study-dashboard. Update Purpose after archive.
## Requirements
### Requirement: 展示每日目标清单
Dashboard SHALL 展示一个可交互的每日目标清单面板，用户可以勾选完成状态。

#### Scenario: 渲染目标列表
- **WHEN** Dashboard 页面加载
- **THEN** 显示目标清单面板，包含标题"每日目标"和若干目标项，每项含勾选框和目标文字

#### Scenario: 勾选完成目标
- **WHEN** 用户点击某目标项的勾选框
- **THEN** 该目标标记为已完成（勾选框填充，文字添加删除线样式）

#### Scenario: 取消完成状态
- **WHEN** 用户点击已完成目标的勾选框
- **THEN** 该目标恢复为未完成状态（勾选框清空，删除线移除）

#### Scenario: 显示完成进度
- **WHEN** 目标清单中有 N 项已完成、共 M 项
- **THEN** 面板顶部显示进度指示（如 "N/M 已完成"）

#### Scenario: 空目标列表
- **WHEN** mock 数据返回空目标列表
- **THEN** 显示空状态提示文案（如"今天还没有学习目标"）

