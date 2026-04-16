## ADDED Requirements

### Requirement: 消息气泡式对话界面
前端 SHALL 在 `/dashboard/chat` 路径提供气泡式 ChatUI，用户消息靠右，AI 消息靠左。

#### Scenario: 渲染消息历史
- **WHEN** 用户进入对话页面
- **THEN** 系统加载并渲染该对话的消息历史，用户消息气泡靠右蓝色，AI 消息气泡靠左灰色

#### Scenario: 发送新消息
- **WHEN** 用户在输入框输入文字并按发送
- **THEN** 用户消息立即显示为气泡，输入框清空，AI 回复以流式逐字显示

#### Scenario: 输入框为空时禁止发送
- **WHEN** 输入框内容为空或仅含空白字符
- **THEN** 发送按钮禁用

### Requirement: 流式响应渲染
前端 SHALL 实时渲染 AI 的流式回复，逐 token 追加到 assistant 气泡中。

#### Scenario: 流式渲染过程
- **WHEN** 后端以 SSE 格式返回 AI 回复
- **THEN** 前端逐 token 追加到当前 assistant 气泡，用户可看到文字逐步出现

#### Scenario: 流式响应出错
- **WHEN** SSE 返回错误事件
- **THEN** 前端在 assistant 气泡中显示错误提示

### Requirement: 自动滚动
前端 SHALL 在新消息到达时自动滚动到底部。

#### Scenario: 新消息自动滚动
- **WHEN** 新的用户消息或 AI 回复 token 到达
- **THEN** 消息列表自动滚动到底部

### Requirement: Markdown 渲染
AI 回复 SHALL 以 Markdown 格式渲染，支持标题、列表、代码块、加粗等。

#### Scenario: Markdown 内容渲染
- **WHEN** AI 回复包含 Markdown 语法（如 `**加粗**`、代码块、列表）
- **THEN** 前端将其渲染为对应的 HTML 格式，而非纯文本
