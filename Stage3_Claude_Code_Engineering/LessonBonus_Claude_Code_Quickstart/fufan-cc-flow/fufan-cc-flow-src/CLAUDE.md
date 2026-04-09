# Fufan-CC Flow — Claude Code 项目指南

## 项目简介

Fufan-CC Flow 是基于 Web 的 Claude Code 图形化前端，通过 **Claude Agent SDK** 将 Claude Code CLI 的全部能力以友好的 Web UI 呈现，支持：实时对话流、Tool Call 可视化、HIL 权限确认、Session 管理、上下文压缩、MCP 管理、Memory 管理、终端集成、Sub-Agent 树等。

## 项目结构

```
fufan-cc-flow-src/
├── client/          # 前端 React 19 + Vite + TypeScript + Tailwind CSS + Zustand
│   ├── src/
│   │   ├── components/   # UI 组件（layout / chat / ide / modals / manage / …）
│   │   ├── stores/       # Zustand 状态管理（每功能域一个 store）
│   │   ├── hooks/        # 自定义 Hook（useWebSocket 等）
│   │   └── services/     # HTTP / WebSocket 客户端
│   └── public/
├── server/          # 后端 Node.js + Express + WebSocket (ws) + TypeScript
│   └── src/
│       ├── routes/       # REST API 路由
│       ├── services/     # 业务逻辑（claudeAgentService / sessionManager / …）
│       ├── websocket/    # WebSocket 处理（chat / terminal）
│       └── utils/        # 工具函数（pathUtils / logger / …）
├── package.json
└── pnpm-workspace.yaml
```

## 技术栈

| 层 | 技术 |
|----|------|
| 前端框架 | React 19 + Vite + TypeScript |
| UI 样式 | Tailwind CSS v4（Void Console 设计系统） |
| 前端状态 | Zustand（功能域独立 Store） |
| 后端框架 | Node.js + Express + ws |
| AI 集成 | `@anthropic-ai/claude-agent-sdk` |
| 终端 | node-pty + xterm.js |
| 代码查看 | CodeMirror 6 |
| 包管理 | pnpm workspace (Monorepo) |

## 开发命令

```bash
pnpm dev       # 同时启动前后端开发服务器（前端 :5173，后端 :3001）
pnpm build     # 构建生产版本
pnpm lint      # ESLint 检查
pnpm format    # Prettier 格式化
```

## 代码规范

- TypeScript 严格模式，所有组件和服务均有类型
- 组件文件 PascalCase（`ChatPanel.tsx`），服务/工具文件 camelCase（`sessionManager.ts`）
- 使用 Tailwind CSS utility classes，不写自定义 CSS 文件
- 前端状态管理：Zustand，每个功能域独立 Store（`chatStore`, `uiStore`, `agentStore` 等）
- 后端分层：`routes` → `services` → `utils`，路由只做参数校验和调用转发

## 关键架构决策

- **Agent SDK 集成**：对话流通过 `@anthropic-ai/claude-agent-sdk` 的 `query()` 实现，支持 HIL 权限回调
- **通信协议**：WebSocket 处理对话流和终端 I/O，REST API 处理配置管理（MCP/Memory/Settings）
- **跨平台**：路径统一用 `path.normalize`，Windows 下路径哈希先将 `\` 转换为 `/`
- **安全**：API Key 仅存本地不写日志，文件写操作校验路径在项目目录内

## 前端设计系统（Void Console）

核心颜色：

| 用途 | 值 |
|------|----|
| 全局背景 | `#13111C` (obsidian-900) |
| 主操作色 | `#d97757` (amber-glow) |
| 品牌/AI 色 | `#7c3aed` (purple-glow) |
| 文字层级 | white → slate-200 → slate-300 → slate-400 |

关键规则：

- 文字颜色用 `slate-*`，**不用** `obsidian-*`（obsidian-500 = `#2D2845` 近乎纯黑）
- 面板背景用内联 `rgba()` style，不用 Tailwind `bg-obsidian-*`
- 主操作按钮：`bg-[#ca5d3d] hover:bg-amber-glow text-white font-medium`
- 光晕环境仅在 Sidebar **外**的中/右区域，Sidebar 本身无光晕

## 注意事项

- `node-pty` 需要本机编译（`node-gyp`），安装前确认 Python 和 C++ 构建工具已就位
- Windows 下 Claude Code CLI 需要 Git Bash，路径由 `CLAUDE_CODE_GIT_BASH_PATH` 环境变量覆盖
- 权限请求（HIL）超时为 60 秒，超时后自动拒绝
- `maxBudgetUsd` 选项可在 Settings 页面配置，防止单次任务费用失控
