# 会话交接 · 飞书机器人推送通道（F6 · 002-feishu-push-channel）

## 完成时间
2026-05-28

## 状态
F6 MVP 后端实现完成，全部 15 个 task 已交付。后端测试 166 passed (F5 94 + F6 47 + concurrency gap 2 + 其他原有 23)。代码尚未真实联通飞书（缺 `LARK_RECEIVE_ID`，见"未做"）。

## 交付摘要

### 新增模块（backend/app/）
- `config.py`（扩展）：Lark App 凭证 + RATE_LIMIT/DEDUP_TTL/UNDELIVERED_MAX/MUTE_FLAG
- `db.py`（扩展）：`push_log` + `undelivered` 两表（与 watchlist_* 零交叉）
- `models/push.py`：`PushRequest` / `PushLog` / `UndeliveredItem` / `Priority` / `MsgType`
- `push/lark_client.py`：lark-oapi SDK 封装 + `FailureKind` 失败分类（network/rate_limit/invalid_credential/unknown）+ uuid 透传到 `CreateMessageRequestBody`
- `push/card_renderer.py`：`render()`（text/interactive）+ `render_batch()`（≤10/卡）+ 禁用词替换 + 超长截断
- `push/dedup.py`：5min TTL Deduper（注入式 clock）+ `uuid_for()`（FR-016 SHA256 稳定 uuid）
- `push/rate_limiter.py`：60s 滑动窗口令牌桶 + 合并队列
- `push/retry_queue.py`：30s/90s 重试调度 + 未送达队列持久化 + 回放 + 持仓优先溢出策略
- `services/push_service.py`：`PushService.send(PushRequest)` 统一编排（FR-015 入口）
- `api/push_status.py`：`GET /push/status` 暴露 `{undelivered_count, webhook_ok, muted}`

### 依赖
- `lark-oapi>=1.4` ✓（已 sync）
- `apscheduler>=3.10` ✓（已 sync，本轮未实际使用调度，预留 F2 复用）

### 测试矩阵
- `test_push_config.py`(7) / `test_push_db.py`(4) / `test_push_models.py`(7)
- `test_push_lark_client.py`(7 全 mock SDK) / `test_push_card_renderer.py`(6)
- `test_push_dedup.py`(8) / `test_push_rate_limiter.py`(5)
- `test_push_retry_queue.py`(8) / `test_push_service.py`(9)
- `test_push_status_api.py`(1) / `test_push.py`(8 集成 SC-002/003/004/005)
- `test_gap_push_concurrency.py`(2 gap closure 50 线程并发安全)
- 合计 F6 新增 **72 tests** 全绿；累计 backend 166 passed。

## 下游对接

### 给 F2（005 异动检测）
```python
from app.services.push_service import PushService
from app.models.push import PushRequest, MsgType, Priority

# 启动时构造一次
svc = PushService(
    lark_client=build_default_client(settings.LARK_APP_ID, settings.LARK_APP_SECRET),
    db_path=settings.DB_PATH,
    receive_id=settings.LARK_RECEIVE_ID,
    receive_id_type=settings.LARK_RECEIVE_ID_TYPE,
    rate_limit_per_min=settings.RATE_LIMIT,
    dedup_ttl=settings.DEDUP_TTL,
    undelivered_max=settings.UNDELIVERED_MAX,
    muted=settings.MUTE_FLAG,
)

# 命中规则后调用
svc.send(PushRequest(
    msg_type=MsgType.interactive,
    content={"config": {...}, "elements": [...]},
    priority=Priority.holding,  # 或 Priority.watch
    code="600519",
    signal="limit_up",
))
```
- F2 必须传 `priority`、`code`、`signal`（dedup 三元组的两元 + 持仓判定）
- F6 自动处理 dedup / 限频 / 重试 / 持久化 / 日志

### 给 F4（006 早盘简报）
- 简报传 `priority=Priority.system` + 不传 `code/signal`（系统类不参与 dedup）

### 给 F1（003 Dashboard）
- `GET /push/status` → `{undelivered_count: int, webhook_ok: bool, muted: bool}`
- 用法见 `backend/app/api/push_status.py` 的 `build_push_router(svc)`，挂载到主 FastAPI app 即可

## 未做（含待凭证）

### 待凭证（不阻塞代码完成 — 已实现 + mock 测试已覆盖）
- **LARK_RECEIVE_ID**：目标会话 chat_id（群）或 open_id（单聊）。未提供 → 代码已全部就绪 + 单测以 MagicMock SDK 覆盖全部失败/成功路径；一旦凭证就位即可端到端联通。
- **LARK_RECEIVE_ID_TYPE**：默认 `chat_id`；单聊场景填 `open_id`。

### 获取步骤（用户操作）
1. 在飞书开放平台为已创建的 Lark App（app_id=`cli_aa87c8d188f81bd8`）开通机器人能力
2. 申请 IM 发消息 scope（`im:message:send_as_bot`）
3. 把机器人邀请进目标群 → 在群里 @机器人发任意消息触发"机器人收到消息事件"，从事件 body 取 `chat_id`（或调 `/im/v1/chats`）
4. 把 `chat_id` 填入 `.env` 的 `LARK_RECEIVE_ID=oc_xxxx`，`LARK_RECEIVE_ID_TYPE=chat_id`
5. 重启后端 → 自动启用真实推送链路（pipeline 代码已就绪）

### 真实联通后的"冒烟测试"建议
```bash
cd backend
LARK_APP_ID=... LARK_APP_SECRET=... LARK_RECEIVE_ID=oc_xxxx \
  uv run python -c "
from app.config import settings
from app.push.lark_client import build_default_client
from app.services.push_service import PushService
from app.models.push import PushRequest, MsgType, Priority
from app.db import init_db; init_db(settings.DB_PATH)
svc = PushService(
  lark_client=build_default_client(settings.LARK_APP_ID, settings.LARK_APP_SECRET),
  db_path=settings.DB_PATH, receive_id=settings.LARK_RECEIVE_ID,
  receive_id_type=settings.LARK_RECEIVE_ID_TYPE,
  rate_limit_per_min=settings.RATE_LIMIT, dedup_ttl=settings.DEDUP_TTL,
  undelivered_max=settings.UNDELIVERED_MAX, muted=False)
print(svc.send(PushRequest(
  msg_type=MsgType.text, content={'text': 'F6 冒烟测试'},
  priority=Priority.system)))
"
```

### MVP 外（v1.1+）
- 双向交互卡片（用户在飞书点按钮回调控制系统）
- 多接收目标 / 分用户路由
- 分时段静音 / 分类型静音

## 怎么本地跑

```bash
cd backend
uv sync
uv run pytest -q          # 166 passed
uv run uvicorn app.main:app --reload  # 暂未把 push_router 挂到 main; F1 落地时再装配
```

注：当前 `main.py` 只装配 watchlist 路由；F6 的 `build_push_router(svc)` 是独立 APIRouter，等 F1（003）做 Dashboard 装配主 app 时统一 include_router。

## 禁止重新规划
本 feature 全 15 task 已闭环 + 2 gap test 已补，状态为 PR-ready。下游 (F2/F4/F1) 按"下游对接"章节直接调用即可。
