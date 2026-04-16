## ADDED Requirements

### Requirement: 用户可通过邮箱注册
系统 SHALL 提供 `POST /api/auth/register` 接口，接受邮箱和密码，创建新用户。

#### Scenario: 注册成功
- **WHEN** 客户端发送 `{ email: "user@example.com", password: "Abc12345" }`
- **THEN** 系统创建用户，返回 `201` 和 `{ id, email }`，密码以 bcrypt 哈希存储

#### Scenario: 邮箱已被注册
- **WHEN** 客户端使用已存在的邮箱注册
- **THEN** 系统返回 `409 Conflict` 和错误信息 `"email already registered"`

#### Scenario: 邮箱格式无效
- **WHEN** 客户端发送非法邮箱格式（如 `"not-an-email"`）
- **THEN** 系统返回 `422 Unprocessable Entity`

#### Scenario: 密码过短
- **WHEN** 客户端发送长度 < 8 的密码
- **THEN** 系统返回 `422 Unprocessable Entity` 并提示密码长度要求
