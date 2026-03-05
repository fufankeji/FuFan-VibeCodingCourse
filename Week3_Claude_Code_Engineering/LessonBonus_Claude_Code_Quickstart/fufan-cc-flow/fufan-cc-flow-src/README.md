# Fufan-CC Flow

> 基于 Web 的 Claude Code 图形化前端，让 AI 编程工作流可视化。

Fufan-CC Flow 将 Claude Code CLI 的全部能力封装为友好的 Web 界面，支持实时对话流、工具调用可视化、权限确认（HIL）、会话管理、MCP 扩展、终端集成等功能，适合个人开发者、团队协作以及 AI 编程教学场景。

---

## 功能亮点

| 功能 | 说明 |
|------|------|
| **实时对话流** | Token 级流式输出，带 Thinking 折叠展示 |
| **工具调用可视化** | 每次 Tool Call 以卡片形式展示名称、输入、结果 |
| **HIL 权限确认** | 危险操作弹出确认框，支持一次性批准/永久批准/拒绝 |
| **会话管理** | 历史会话列表、分支（Fork）、会话恢复 |
| **上下文压缩感知** | 实时显示 Token 用量，压缩事件可视化 |
| **模型切换** | 支持 Claude Opus / Sonnet / Haiku 及国产基座模型 |
| **文件树 + 代码查看** | CodeMirror 6 语法高亮，Diff 视图 |
| **集成终端** | xterm.js + node-pty，完整 Shell 体验 |
| **MCP 管理** | 图形化添加/删除 MCP Server（stdio / HTTP / SSE） |
| **Memory 管理** | Auto Memory 和 CLAUDE.md 双体系统一管理 |
| **Sub-Agent 树** | 可视化多 Agent 执行链路 |
| **Settings 向导** | 两步配置（环境检测 → API Key 设置），支持官方 + 国产基座 |

---

## 技术栈

- **前端**：React 19 · Vite · TypeScript · Tailwind CSS v4 · Zustand
- **后端**：Node.js · Express · WebSocket (ws) · TypeScript
- **AI 集成**：`@anthropic-ai/claude-agent-sdk`
- **终端**：node-pty · xterm.js
- **代码查看**：CodeMirror 6
- **包管理**：pnpm workspace（Monorepo）

---

## 环境要求

| 依赖 | 最低版本 | 说明 |
|------|----------|------|
| Node.js | 18.x LTS | 推荐 20.x 或 22.x |
| pnpm | 8.x | 包管理器 |
| Claude Code CLI | 最新版 | `npm install -g @anthropic-ai/claude-code` |
| Python | 3.x | node-pty 编译需要 |
| C++ 构建工具 | — | node-pty 编译需要（见平台说明） |

---

## 安装指南

### macOS

#### 1. 安装 Node.js

推荐通过 [nvm](https://github.com/nvm-sh/nvm) 管理 Node.js 版本：

```bash
# 安装 nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
source ~/.bashrc   # 或 ~/.zshrc

# 安装并激活 Node.js 22 LTS
nvm install 22
nvm use 22
node -v   # 应输出 v22.x.x
```

也可直接从 [nodejs.org](https://nodejs.org) 下载 pkg 安装包。

#### 2. 安装 pnpm

```bash
npm install -g pnpm
pnpm -v
```

#### 3. 安装 C++ 构建工具（node-pty 依赖）

```bash
xcode-select --install
```

弹出安装向导后按提示完成即可（仅需命令行工具，无需安装完整 Xcode）。

#### 4. 安装 Claude Code CLI

```bash
npm install -g @anthropic-ai/claude-code
claude --version   # 确认安装成功
```

#### 5. 克隆并安装项目

```bash
git clone <repo-url> fufan-cc-flow-src
cd fufan-cc-flow-src
pnpm install
```

#### 6. 启动开发服务器

```bash
pnpm dev
# 前端: http://localhost:5173
# 后端: http://localhost:3001
```

---

### Windows

#### 1. 安装 Node.js

从 [nodejs.org](https://nodejs.org/zh-cn) 下载 **Windows 安装包（.msi）**，选择 LTS 版本（推荐 22.x）。

安装时勾选 **"Automatically install the necessary tools"**（自动安装 Chocolatey 和构建工具），这会同时安装 Python 和 Visual Studio Build Tools，解决 node-pty 的编译依赖。

安装完毕后打开新的 PowerShell 验证：

```powershell
node -v
npm -v
```

#### 2. 安装 Git（含 Git Bash）

从 [git-scm.com](https://git-scm.com/download/win) 下载并安装。Claude Code CLI 在 Windows 上需要 Git Bash。

安装时建议选择 **"Git from the command line and also from 3rd-party software"**。

#### 3. 安装 pnpm

在 PowerShell 中执行：

```powershell
npm install -g pnpm
pnpm -v
```

#### 4. 安装 Claude Code CLI

```powershell
npm install -g @anthropic-ai/claude-code
claude --version
```

如遇权限错误，以管理员身份运行 PowerShell，或先执行：

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

#### 5. 克隆并安装项目

在 Git Bash 或 PowerShell 中：

```bash
git clone <repo-url> fufan-cc-flow-src
cd fufan-cc-flow-src
pnpm install
```

> **如果 node-pty 编译失败**，请确认 Visual Studio Build Tools 已安装：
>
> ```powershell
> # 方法一：通过 npm 自动安装（需管理员权限）
> npm install -g windows-build-tools
>
> # 方法二：手动安装
> # 前往 https://visualstudio.microsoft.com/visual-cpp-build-tools/
> # 下载并安装，勾选「C++ 桌面开发」工作负载
> ```

#### 6. 启动开发服务器

```bash
pnpm dev
```

打开浏览器访问 http://localhost:5173

> **Windows 特别说明**：应用会自动检测 Git Bash 路径（`C:\Program Files\Git\bin\bash.exe`）。若安装在其他位置，可在项目根目录创建 `.env` 文件：
>
> ```env
> CLAUDE_CODE_GIT_BASH_PATH=C:\Your\Git\Path\bin\bash.exe
> ```

---

### Linux（Ubuntu / Debian）

#### 1. 安装 Node.js

通过 NodeSource 官方脚本安装 Node.js 22：

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v
```

或使用 nvm（推荐，无需 sudo）：

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
source ~/.bashrc
nvm install 22 && nvm use 22
```

#### 2. 安装 C++ 构建工具（node-pty 依赖）

```bash
sudo apt-get update
sudo apt-get install -y build-essential python3
```

#### 3. 安装 pnpm

```bash
npm install -g pnpm
pnpm -v
```

#### 4. 安装 Claude Code CLI

```bash
npm install -g @anthropic-ai/claude-code
claude --version
```

#### 5. 克隆并安装项目

```bash
git clone <repo-url> fufan-cc-flow-src
cd fufan-cc-flow-src
pnpm install
```

#### 6. 启动开发服务器

```bash
pnpm dev
```

打开浏览器访问 http://localhost:5173

---

## 首次配置

启动后，浏览器打开 http://localhost:5173，若 Claude Code CLI 未认证，会自动跳转到 **Settings 向导**：

1. **Step 1 — 环境检测**：自动检测 Node.js、Claude CLI、网络代理
2. **Step 2 — 认证配置**：
   - **官方 Anthropic API**：粘贴 API Key（从 [console.anthropic.com](https://console.anthropic.com) 获取）
   - **国产基座兼容**：填写自定义 Base URL 和 API Key

配置完成后点击「开始使用」，即可在主界面选择工作目录，开始 AI 编程会话。

---

## 项目结构

```
fufan-cc-flow-src/
├── client/                   # 前端
│   ├── src/
│   │   ├── components/       # UI 组件
│   │   │   ├── layout/       # AppLayout / Sidebar / RightPanel / ChatPanel
│   │   │   ├── chat/         # 消息气泡 / 工具卡片 / 输入栏
│   │   │   ├── ide/          # 文件树 / 代码查看器 / Diff
│   │   │   ├── manage/       # MCP / Memory / 用量统计 / Settings
│   │   │   └── modals/       # 权限确认 / 会话管理 / 文件浏览器
│   │   ├── stores/           # Zustand 状态（chatStore / uiStore / agentStore …）
│   │   ├── hooks/            # useWebSocket / useFileTree …
│   │   └── services/         # api.ts / websocket.ts
│   └── public/
├── server/                   # 后端
│   └── src/
│       ├── routes/           # REST API（files / mcp / memory / sessions / system）
│       ├── services/         # claudeAgentService / sessionManager / ptyService …
│       ├── websocket/        # chatHandler / terminalHandler
│       └── utils/            # pathUtils / logger / proxyConfig
├── package.json              # 根 package（monorepo 脚本）
└── pnpm-workspace.yaml
```

---

## 常用命令

```bash
pnpm dev        # 开发模式（前端 :5173 + 后端 :3001 热重载）
pnpm build      # 生产构建
pnpm start      # 启动生产后端（需先 build）
pnpm lint       # ESLint 检查
pnpm format     # Prettier 格式化
```

---

## 常见问题

**Q: `node-pty` 安装失败 / 编译报错**

确认已安装对应平台的 C++ 构建工具（见上方安装指南），然后执行：

```bash
pnpm install --force
```

**Q: Windows 下终端无法启动**

检查 Git Bash 是否存在于默认路径，或设置环境变量 `CLAUDE_CODE_GIT_BASH_PATH`。

**Q: 无法连接到 Claude API**

1. 检查 Settings 页面的 API Key 是否正确
2. 如在中国大陆，需要配置代理（Settings → 网络代理）
3. 或使用国产基座兼容模式，填写支持 Anthropic 协议的中转地址

**Q: WebSocket 连接失败（聊天框无法发送消息）**

确认后端服务已启动（`pnpm dev` 后能看到 `Server listening on :3001`），Vite 代理会自动将 `/ws` 转发到后端。

**Q: 会话记录在哪里**

Claude Code 会话存储在 `~/.claude/projects/<project-hash>/` 目录下，与 Claude Code CLI 共享同一份数据。

---

## 许可证

MIT License
