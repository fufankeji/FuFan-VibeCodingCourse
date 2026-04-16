## ADDED Requirements

### Requirement: 记录学习时段
系统 SHALL 提供 `POST /api/analytics/sessions` 接口，记录用户的学习时段。

#### Scenario: 记录成功
- **WHEN** 认证用户发送 `{ duration_minutes: 60, date: "2026-04-15" }`
- **THEN** 系统保存记录，返回 `201` 和 `{ id, duration_minutes, date }`

#### Scenario: 未认证
- **WHEN** 未携带有效 token
- **THEN** 系统返回 `401 Unauthorized`

### Requirement: 获取日历热力图数据
系统 SHALL 提供 `GET /api/analytics/calendar` 接口，返回指定年份每日学习分钟数。

#### Scenario: 获取年度数据
- **WHEN** 认证用户发送 `GET /api/analytics/calendar?year=2026`
- **THEN** 系统返回 `{ year: 2026, data: { "2026-01-15": 120, ... } }`，仅包含有学习记录的日期

#### Scenario: 无学习记录的年份
- **WHEN** 指定年份无任何学习记录
- **THEN** 系统返回 `{ year: 2026, data: {} }`

### Requirement: 获取聚合统计
系统 SHALL 提供 `GET /api/analytics/stats` 接口，返回用户学习统计摘要。

#### Scenario: 获取统计数据
- **WHEN** 认证用户请求统计
- **THEN** 系统返回 `{ total_minutes, streak_days, sessions_count, today_minutes }`，数据从数据库实时聚合
