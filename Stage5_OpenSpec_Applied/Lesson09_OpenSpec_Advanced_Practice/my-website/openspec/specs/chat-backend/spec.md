# chat-backend Specification

## Purpose
TBD - created by archiving change ai-chat. Update Purpose after archive.
## Requirements
### Requirement: 创建和列出对话
系统 SHALL 提供对话的创建和列表接口，对话归属于当前认证用户。

#### Scenario: 创建新对话
- **WHEN** 认证用户发送 `POST /api/chat/conversations`
- **THEN** 系统创建对话，返回 `201` 和 `{ id, title, created_at }`

#### Scenario: 获取对话列表
- **WHEN** 认证用户发送 `GET /api/chat/conversations`
- **THEN** 系统返回该用户的对话列表，按 created_at 降序排列

#### Scenario: 未认证访问
- **WHEN** 未携带有效 token 访问对话接口
- **THEN** 系统返回 `401 Unauthorized`

### Requirement: 发送消息并获取 AI 流式回复
系统 SHALL 接受用户消息，将其与对话历史和用户学习数据一起发送给 DeepSeek，以 SSE 流式返回 AI 回复。

#### Scenario: 发送消息获取流式回复
- **WHEN** 认证用户发送 `POST /api/chat/conversations/{id}/messages` 且 body 为 `{ "content": "..." }`
- **THEN** 系统保存用户消息，调用 DeepSeek API，以 `text/event-stream` 格式逐 token 返回 AI 回复，完成后保存完整 assistant 消息到数据库

#### Scenario: AI 回复包含个性化学习数据
- **WHEN** 系统调用 DeepSeek API
- **THEN** system prompt SHALL 包含当前用户的 streak_days、level 和今日目标完成情况

#### Scenario: DeepSeek API 调用失败
- **WHEN** DeepSeek API 返回错误或超时
- **THEN** 系统通过 SSE 发送错误事件 `data: {"error": "..."}` 并关闭连接

#### Scenario: 对话不属于当前用户
- **WHEN** 认证用户尝试向其他用户的对话发送消息
- **THEN** 系统返回 `404 Not Found`

### Requirement: 获取对话消息历史
系统 SHALL 提供对话消息历史的查询接口。

#### Scenario: 获取消息列表
- **WHEN** 认证用户发送 `GET /api/chat/conversations/{id}/messages`
- **THEN** 系统返回该对话的所有消息，按 created_at 升序排列，每条含 `{ id, role, content, created_at }`

#### Scenario: 空对话
- **WHEN** 对话中没有任何消息
- **THEN** 系统返回空数组 `[]`

