# AlphaProject · A 股自动盯盘 AI 助手

> 本地 Mac 常驻的个人盯盘工具：**Web Dashboard + 飞书推送**
> 一屏看完自选股 · 60 秒内推送 4 类异动 · AI 解释 ≤200 字 · 工作日 09:15 早盘简报
> MVP 6 周 · 月成本 ≤ 100 元 · **不下单 / 不对外 / 不收费**

```
后端 FastAPI + APScheduler + SQLite      前端 Vite + React 19 + Tailwind v4
akshare（主）+ Tushare Pro（补）          shadcn/ui + Material Symbols
lark-oapi（飞书推送）                     TradingView Lightweight Charts
OpenAI-compatible LLM（DeepSeek/Qwen/Ollama 三级降级）
```

---

## 1 · 截图速览

> 截图存放路径：`docs/screenshots/`。用 macOS Cmd+Shift+4 截图后拖入即可（详见 §6.4）。

### 总览看板 · Dashboard
真实 akshare 行情 + 30 日趋势线 + KPI 速览 + 今日最强/最弱
![Dashboard](docs/screenshots/01-dashboard.png)

### 早盘简报 · Morning Briefing
工作日 09:15 自动生成 · 4 区块（全球市场 / 自选 AI 洞察 / 隔夜要闻 / 今日日程）
![Morning Briefing](docs/screenshots/02-briefing.png)

### 异动日志 · Alert Logs
垂直时间线 · 推送状态 · AI 解释 · 风险尾标
![Alert Logs](docs/screenshots/03-alerts.png)

### 单股详情 · Stock Detail
display-price 大字 · K 线分时切换 · AI「为什么」按钮 · 相关新闻
![Stock Detail](docs/screenshots/04-detail.png)

---

## 2 · 功能（F1–F6 · MVP P0）

| ID | 模块 | 一句话 | 关联 |
|----|------|--------|------|
| F1 | 自选股 Dashboard | 一屏看完 + 60s 自动刷新 + 异动徽章 | US-01 / US-05 |
| F2 | 异动检测推送 | 涨跌停 / 突破 / 量能 / 振幅 / 事件 5 类规则 60s 内推 | US-02 |
| F3 | LLM 异动解释 | ≤200 字 · DeepSeek 主 / Qwen 备 / Ollama 兜底 · 必附风险尾标 | US-04 |
| F4 | 早盘简报 | 工作日 09:15 自动 · 飞书 Markdown 卡片 · 4 区块 | US-03 |
| F5 | 自选股 CRUD | 增删改分组 · 上限 30 只 · 持仓上限 5 只 | US-05 |
| F6 | 飞书推送通道 | lark-oapi Lark App · 限频 + dedup + 重试 + 未送达队列 | US-02/03/04 |

详情见 `specs/prd.md` 与各 feature 的 `specs/00X-*/spec.md`。

---

## 3 · 快速上手

### 3.1 环境要求

- macOS 13+（其他平台未测试，路径用绝对路径应该也行）
- Python **3.11**（uv 自动管理）
- Node 18+ + pnpm 9+
- 飞书账号一个（个人或公司都行，需开放平台创建自建应用）
- 任一 OpenAI 兼容的 LLM API Key（DeepSeek / Qwen / OpenRouter 都行）

### 3.2 5 分钟跑起来

```bash
# 1. 克隆 + 装依赖
git clone <repo-url> AlphaProject && cd AlphaProject

# 2. 凭证模板复制 + 填值（如何拿见 §4）
cp .env.example .env
$EDITOR .env

# 3. 后端
cd backend
uv sync                                # 装 Python 依赖
uv run python -m uvicorn app.main:app --port 8000 --reload

# 4. 前端（新开终端）
cd frontend
pnpm install
pnpm dev                               # 默认 http://localhost:5173

# 5. 加几只自选股（任选其一）
#    A. 浏览器打开 Dashboard → 点「+ 管理」
#    B. 命令行：
curl -X POST http://127.0.0.1:8000/watchlist \
  -H 'Content-Type: application/json' \
  -d '{"code":"600519","name":"贵州茅台","is_holding":true}'
```

### 3.3 验证联通

| 链路 | 验证命令 | 期望 |
|------|---------|------|
| 后端启动 | `curl http://127.0.0.1:8000/health` | `{"status":"ok"}` |
| 行情拉取 | `curl http://127.0.0.1:8000/quotes/snapshot` | 含 rows 数组与 session_label |
| 飞书推送 | 浏览器打开 Dashboard → 触发任一异动 | 飞书目标群收到卡片 |
| AI 解释 | `curl -X POST http://127.0.0.1:8000/explain -d '{"code":"600519","signal":"limit_up"}'` | 返回 ≤200 字中文 + 风险尾标 |

---

## 4 · 凭证配置（不要暴露 Key）

> **铁律：`.env` 已在 `.gitignore`，永不提交。**
> 模板 `.env.example` 只有变量名 + 来源说明，不含任何 Key。

### 4.1 飞书 Lark App（F6 推送出口）

| 步骤 | 操作 | 落到哪个变量 |
|------|------|------------|
| ① 登 [open.feishu.cn](https://open.feishu.cn) | 「开发者后台」→「创建企业自建应用」 | — |
| ② 凭证与基础信息 | 复制 App ID + App Secret | `LARK_APP_ID` / `LARK_APP_SECRET` |
| ③ 权限管理 | 开通 `im:message`、`im:message.group_msg`、`im:chat`、`contact:user.id` | — |
| ④ 版本管理 | 创建版本 → 上线申请 → 通过 | — |
| ⑤ 拿群 chat_id | 把 bot 加进飞书群 → `curl` 调 `/im/v1/chats?user_id_type=open_id` 列出 chat_id | `LARK_RECEIVE_ID` |
| ⑥ 接收方类型 | 默认 `chat_id`（群）；私聊填 `open_id` 或 `user_id` | `LARK_RECEIVE_ID_TYPE` |

> 详细权限矩阵见 `specs/002-feishu-push-channel/plan.md`。

### 4.2 LLM API Key（F3 解释 + F4 简报）

任一 openai-compatible 端点都行 —— 主备链 + 本地兜底三级：

| 角色 | 推荐 | base_url 示例 | model 示例 |
|------|------|--------------|----------|
| 主 (PRIMARY) | DeepSeek 直连 | `https://api.deepseek.com/v1` | `deepseek-chat` |
| 主 (PRIMARY) | OpenRouter aggregator | `https://openrouter.ai/api/v1` | `deepseek/deepseek-chat` |
| 备 (BACKUP) | 通义千问 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-plus` |
| 兜底 (OLLAMA) | 本地 ollama | `http://127.0.0.1:11434` | `qwen2.5:7b` |

`LLM_DAILY_BUDGET=5` 表示单日 5 元上限，超额自动降级 Ollama（PRD §7.8）。

### 4.3 Tushare（可选 · 补强财报/龙虎榜）

[tushare.pro](https://tushare.pro/) 注册 → 捐 500 元拿 5000 积分 → 填 `TUSHARE_TOKEN`。
**留空也能跑** —— akshare 免费通道已覆盖行情主链路。

### 4.4 安全清单

- [x] `.env` 在 `.gitignore`
- [x] `.mcp.json` 在 `.gitignore`（含 MCP server key）
- [x] `.env.example` 不含真值，只有变量名 + 来源说明
- [x] Dashboard 默认 `127.0.0.1` 监听（公网访问走 Tailscale，PRD §7.3）
- [x] 推送内容禁含 PII；AI 文本禁含买卖建议词（合规自律）

---

## 5 · 项目结构

```
AlphaProject/
├── .env                       # 真实凭证（gitignored）
├── .env.example               # 模板（提交，不含真值）
├── backend/
│   ├── app/
│   │   ├── api/               # FastAPI 路由（quotes / watchlist / push / explain / briefing）
│   │   ├── services/          # 业务层（quote / kline / anomaly / briefing / push / llm）
│   │   ├── integrations/      # akshare_adapter / lark_client / llm_client
│   │   └── main.py            # 启动入口（APScheduler + lifespan）
│   ├── tests/                 # pytest
│   └── pyproject.toml
├── frontend/
│   ├── src/
│   │   ├── pages/             # Dashboard / MorningReport / AlertLogs / StockDetail / Settings
│   │   ├── components/shell/  # AppShell / Sidebar / Topbar / Mi（Material Symbols）
│   │   ├── store/             # zustand（dashboardStore / watchlistStore）
│   │   └── services/sdk.ts    # 与后端的契约层
│   ├── index.html             # Inter / JetBrains Mono / Material Symbols
│   └── package.json
├── specs/
│   ├── prd.md                 # PRD v1.1
│   ├── research/              # 06 架构基线 / 05 决策汇总 / 03 开源项目
│   ├── design-reference/      # Stitch 视觉原型（仅参考，不抄代码）
│   └── 00{1..6}-*/            # 6 个 feature 的 spec/plan/tasks
├── docs/screenshots/          # README 用截图
└── scripts/screenshot.sh      # 截图助手
```

---

## 6 · 开发与运维

### 6.1 测试

```bash
cd backend  && uv run pytest                  # 后端单测（pytest）
cd frontend && pnpm test -- --run             # 前端单测（vitest + RTL）
```

### 6.2 调度任务

| 任务 | cron | 实现 |
|------|------|------|
| 异动扫描 | 每 60 秒 · 9:30-11:30 / 13:00-15:00 | `AnomalyService.scan_cycle` |
| 早盘简报 | 工作日 09:15:00 | `BriefingService.generate_and_push` |
| 未送达回放 | 启动时一次 + 每 5 分钟 | `PushService.retry_undelivered` |

### 6.3 关停 / 重启

```bash
# 找进程
ps aux | grep -E "uvicorn|vite" | grep -v grep
# 关停后端
pkill -f "app.main:app"
# 关停前端
pkill -f "vite"
```

### 6.4 自己拍截图

```bash
# 1. 启动两端 → 浏览器开 http://localhost:5173/
# 2. 调好画面（Dashboard/简报/异动/详情，逐个切）
# 3. Cmd+Shift+4 → 框选 → 默认存到 ~/Desktop
# 4. 拷贝到 docs/screenshots/，命名 01-dashboard.png 等
mv ~/Desktop/截屏*.png docs/screenshots/01-dashboard.png
# 或用 helper：
./scripts/screenshot.sh 01-dashboard
```

---

## 7 · 反模式（禁止条款）

详见 `CLAUDE.md §8`，关键 4 条：

1. **不下单 / 不卖建议 / 不打监管擦边** —— PRD §2.3 + §7.4 红线
2. **AI 文本必附** "以上为信息整理，不构成投资建议" + 禁含"建议买入 / 强烈推荐 / 目标价"
3. **A 股配色：红涨绿跌**（与欧美相反） —— Constitution FD-3
4. **凭证不入 git**，本地加密存储 —— PRD §7.3

---

## 8 · License

个人非商用项目，未对外发行。源码仅本人使用，**禁止 fork 后对外提供 SaaS 服务**（依赖的
akshare / Tushare ToS 均为非商用授权，详见 `specs/research/05-决策汇总.md` §7.1）。
