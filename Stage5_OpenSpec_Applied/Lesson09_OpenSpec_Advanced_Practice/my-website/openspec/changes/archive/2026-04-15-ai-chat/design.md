## Context

StudyPal 已有完整的用户认证（JWT）和 Dashboard 布局。用户的学习数据（streak_days, level, 每日目标完成情况）存储在后端。需要新增 AI 对话功能，接入 DeepSeek API，通过 system prompt 注入用户学习数据，提供个性化学习建议。

## Goals / Non-Goals

**Goals:**
- 后端实现对话 CRUD + DeepSeek 流式代理
- 前端实现气泡式 ChatUI，支持流式渲染和 Markdown
- AI 回复基于用户学习数据（个性化 system prompt）

**Non-Goals:**
- 语音输入、文件上传、模型切换
- 对话上下文窗口管理（本阶段发送全部历史）

## Decisions

### Decision 1: 数据模型

```sql
CREATE TABLE conversations (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id),
    title       TEXT NOT NULL DEFAULT '新对话',
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE messages (
    id                TEXT PRIMARY KEY,
    conversation_id   TEXT NOT NULL REFERENCES conversations(id),
    role              TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
    content           TEXT NOT NULL,
    created_at        DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Decision 2: DeepSeek 集成方案

**选择**：通过 OpenAI SDK 兼容接口调用 DeepSeek

```python
from openai import OpenAI

client = OpenAI(
    api_key="sk-5e16509b29894840a78a5127bd21499d",
    base_url="https://api.deepseek.com"
)
```

**System Prompt 注入用户数据**：
```
你是 StudyPal 学习助手。当前用户的学习数据：
- 连续学习天数：{streak_days}
- 用户等级：Lv.{level}
- 今日目标完成情况：{completed}/{total}

请基于以上数据给出个性化学习建议。回复使用中文，支持 Markdown 格式。
```

### Decision 3: 流式响应方案

**选择**：Server-Sent Events (SSE) via `sse-starlette`

```
POST /api/chat/{conversation_id}/messages
Content-Type: application/json
Authorization: Bearer <token>
Body: { "content": "用户消息" }

Response: text/event-stream
data: {"delta": "你"}
data: {"delta": "好"}
data: {"delta": "！"}
data: [DONE]
```

**替代方案**：
- WebSocket：双向通信过重，Chat 只需单向流
- 非流式：用户体验差，需等待完整回复

### Decision 4: API 端点规范

| Method | Path | Auth | 说明 |
|--------|------|------|------|
| POST | `/api/chat/conversations` | Bearer | 创建新对话 |
| GET | `/api/chat/conversations` | Bearer | 获取用户的对话列表 |
| GET | `/api/chat/conversations/{id}/messages` | Bearer | 获取对话的消息历史 |
| POST | `/api/chat/conversations/{id}/messages` | Bearer | 发送消息 + 流式 AI 回复 |

### Decision 5: 前端组件架构

**组件层级图**：
```
<DashboardPage>
├── <Sidebar />                    ← 修改：新增 "AI 对话" 导航项
└── <main>
    └── Route /dashboard/chat
        └── <ChatPage>             ← 新增
            ├── <ChatSidebar />    ← 对话列表（左侧窄栏）
            └── <ChatMain />       ← 对话主区域
                ├── <ChatBubble /> ← 消息气泡（user / assistant）
                ├── 自动滚动锚点
                └── <ChatInput />  ← 输入框 + 发送按钮
```

**技术选型**：
- Markdown 渲染：`react-markdown`（轻量，支持 GFM）
- 流式读取：`fetch` + `ReadableStream` + `TextDecoder`
- 自动滚动：`useRef` + `scrollIntoView({ behavior: 'smooth' })`

### Decision 6: 路由结构变更

```
/dashboard          → DashboardPage（现有统计面板）
/dashboard/chat     → ChatPage（新增 AI 对话）
```

`App.tsx` 中 `/dashboard` 改为嵌套路由，`/dashboard` 显示原有面板，`/dashboard/chat` 显示对话页。

## Risks / Trade-offs

- **[DeepSeek API 可用性]** → 外部服务不可控。Mitigation：对话 API 捕获超时/错误，前端显示友好错误提示。
- **[全量历史发送]** → 长对话会超出 token 限制。Mitigation：本阶段不处理，后续可添加截断策略。
- **[API Key 安全]** → Key 存储在后端 .env，不暴露给前端。前端通过后端代理调用。
- **[SSE 连接中断]** → 网络不稳定时流可能断开。Mitigation：前端检测连接关闭，显示"回复中断"提示。
