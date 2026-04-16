## 1. 后端数据模型与迁移

- [x] 1.1 创建 `backend/app/models/conversation.py`（Conversation + Message ORM 模型）
- [x] 1.2 生成 Alembic 迁移并执行（`conversations` + `messages` 表）
- [x] 1.3 在 `backend/.env` 添加 `DEEPSEEK_API_KEY`，在 `config.py` 读取

**验证**：确认 `conversations` 和 `messages` 表已创建，字段完整。

## 2. 后端 Chat API（非流式部分）

- [x] 2.1 创建 `backend/app/schemas/chat.py`（CreateConversation, ConversationResponse, MessageResponse, SendMessageRequest）
- [x] 2.2 创建 `backend/app/routers/chat.py`，实现 `POST /api/chat/conversations`（创建对话）
- [x] 2.3 实现 `GET /api/chat/conversations`（获取当前用户的对话列表，按 created_at 降序）
- [x] 2.4 实现 `GET /api/chat/conversations/{id}/messages`（获取对话消息历史，验证对话归属）
- [x] 2.5 在 `main.py` 挂载 chat router

**验证**：通过 Swagger UI 测试创建对话、列出对话、获取消息历史。

## 3. 后端 DeepSeek 流式集成

- [x] 3.1 安装 `openai` 和 `sse-starlette` 依赖
- [x] 3.2 实现 `POST /api/chat/conversations/{id}/messages`：保存用户消息 → 构建 system prompt（注入用户学习数据）→ 调用 DeepSeek stream → SSE 逐 token 返回 → 保存完整 assistant 消息
- [x] 3.3 实现错误处理：DeepSeek 超时/失败时返回 SSE error 事件
- [x] 3.4 实现对话归属校验（非本人对话返回 404）

**验证**：用 curl 测试流式响应，确认 SSE 格式正确，数据库中消息已保存。

## 4. 前端对话页面骨架

- [x] 4.1 安装 `react-markdown` 依赖
- [x] 4.2 创建 `src/pages/dashboard/ChatPage.tsx`（对话列表侧栏 + 消息主区域布局）
- [x] 4.3 更新 `src/App.tsx`：`/dashboard` 改为嵌套路由（Outlet），`/dashboard` index 渲染原有面板，`/dashboard/chat` 渲染 ChatPage
- [x] 4.4 更新 `src/pages/dashboard/DashboardPage.tsx`：使用 `<Outlet />` 支持子路由
- [x] 4.5 更新 `src/components/dashboard/Sidebar.tsx`：新增"AI 对话"导航项，使用 router Link 跳转

**验证**：确认 `/dashboard` 显示原有面板，`/dashboard/chat` 显示空对话页骨架，Sidebar 导航正常。

## 5. 前端对话交互

- [x] 5.1 创建 `src/components/dashboard/ChatBubble.tsx`（消息气泡组件，支持 user/assistant 样式 + Markdown 渲染）
- [x] 5.2 实现对话列表加载（调用 `GET /api/chat/conversations`）和新建对话功能
- [x] 5.3 实现消息历史加载（调用 `GET /api/chat/conversations/{id}/messages`）
- [x] 5.4 实现发送消息 + 流式读取（fetch stream + TextDecoder，逐 token 追加到 assistant 气泡）
- [x] 5.5 实现自动滚动（useRef + scrollIntoView）
- [x] 5.6 实现空输入禁止发送、发送中禁用输入框

**验证**：完整走查新建对话 → 发送消息 → AI 流式回复 → 自动滚动 → Markdown 渲染。

## 6. 集成测试与最终验证

- [x] 6.1 完整走查：登录 → Dashboard → AI 对话 → 新建对话 → 多轮对话 → 切换对话
- [x] 6.2 验证 AI 回复包含个性化学习数据（提问"我的学习情况如何"）
- [x] 6.3 验证错误场景：对话不存在、未登录访问、DeepSeek 超时提示
- [x] 6.4 验证暗色模式下对话页面样式正确
- [x] 6.5 运行 `npm run build` 确认前端构建无错误
