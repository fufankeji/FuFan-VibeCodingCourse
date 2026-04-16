# user-profile Specification

## Purpose
TBD - created by archiving change user-auth. Update Purpose after archive.
## Requirements
### Requirement: 已登录用户可获取自身 Profile
系统 SHALL 提供 `GET /api/users/me` 接口，返回当前认证用户的 Profile 信息。

#### Scenario: 获取 Profile 成功
- **WHEN** 客户端携带有效 Bearer token 请求
- **THEN** 系统返回 `200` 和 `{ id, email, avatar_url, streak_days, level }`

#### Scenario: 未携带 token
- **WHEN** 客户端未提供 Authorization header
- **THEN** 系统返回 `401 Unauthorized`

#### Scenario: token 已过期
- **WHEN** 客户端携带过期的 access_token
- **THEN** 系统返回 `401 Unauthorized`

### Requirement: 已登录用户可更新自身 Profile
系统 SHALL 提供 `PATCH /api/users/me` 接口，允许更新 avatar_url、streak_days、level 字段。

#### Scenario: 更新 Profile 成功
- **WHEN** 客户端携带有效 token 发送 `{ avatar_url: "https://example.com/avatar.jpg" }`
- **THEN** 系统更新对应字段，返回 `200` 和完整的更新后 Profile

#### Scenario: 部分字段更新
- **WHEN** 客户端仅发送 `{ streak_days: 15 }`
- **THEN** 仅更新 streak_days，其余字段保持不变

#### Scenario: 无有效字段
- **WHEN** 客户端发送空对象 `{}`
- **THEN** 系统返回 `200` 和当前 Profile（无变更）

