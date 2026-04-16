## ADDED Requirements

### Requirement: 获取用户成就列表
系统 SHALL 提供 `GET /api/analytics/achievements` 接口，返回全部成就定义及用户解锁状态。

#### Scenario: 获取成就列表
- **WHEN** 认证用户请求成就列表
- **THEN** 系统返回所有成就定义，每项含 `{ type, name, description, unlocked, unlocked_at }`

#### Scenario: 未解锁成就
- **WHEN** 用户未满足某成就条件
- **THEN** 该成就项 `unlocked` 为 `false`，`unlocked_at` 为 `null`

### Requirement: 检查并解锁新成就
系统 SHALL 提供 `POST /api/analytics/achievements/check` 接口，根据当前学习数据检查并解锁满足条件的成就。

#### Scenario: 解锁新成就
- **WHEN** 用户学习数据满足某成就条件且尚未解锁
- **THEN** 系统解锁该成就，返回 `{ newly_unlocked: ["streak-7"] }`

#### Scenario: 无新成就
- **WHEN** 用户未满足任何新成就条件
- **THEN** 系统返回 `{ newly_unlocked: [] }`
