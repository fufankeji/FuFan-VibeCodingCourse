# Backend 结构性缺口 · 闭环登记

按 `testing-system-blueprint` 蓝本：风险分级 + 可追溯 + 发布门 + 三层节奏。

## 本次（test/001-backend-gaps）补齐

| ID | 缺口 | 类别 | 风险 | 发布门 | 三层节奏 | 测试文件 | 命中机制 | 状态 |
|---|---|---|:-:|:-:|:-:|---|---|:-:|
| G-01 | 30/5 caps read-then-write race | B-③ 并发 | **P0** | 🚫 阻断 | 中（线程并发） | `test_gap_concurrency_caps.py` | 真 race，产品码 +RLock | ✅ GREEN |
| G-02 | 孤儿 group_id silent accept | B-① 真库 | P1 | 🚫 阻断 | 快 | `test_gap_orphan_group_ref.py` | 真缺陷，服务层 +校验 | ✅ GREEN |
| G-03 | AkShare 超时/挂起降级 | B-④ 韧性 | P1 | ⚠️ 告警 | 快 | `test_gap_akshare_timeout.py` | 覆盖既有降级 | ✅ GREEN |
| G-04 | lifespan `_every` 异常 observability | B-④ 韧性 | P2 | ⚠️ 告警 | 中（async sleep） | `test_gap_background_task_observability.py` | 覆盖既有日志 | ✅ GREEN |
| G-05 | purge ↔ read 并发 | B-③ 并发 | P2 | ⚠️ 告警 | 中（线程并发） | `test_gap_purge_read_race.py` | 行为校验（SQLite 串行化） | ✅ GREEN |
| G-06 | init_db 不可写目录 fail-fast | B-④ 韧性 | P2 | ⚠️ 告警 | 快 | `test_gap_init_db_unwriteable.py` | 行为校验（fail-fast 路径） | ✅ GREEN |

发布门口径：P0 测试**任何 1 项 RED 即阻断发布**；P1 RED 阻断 minor 发布、可豁免 hotfix；P2 RED 进 release notes 不阻断。

## 推后（未本轮做，登记原因）

| ID | 缺口 | 类别 | 风险 | 推后理由 | 建议 |
|---|---|---|:-:|---|---|
| G-07 | delete_group 事务原子性故障注入 | B-① 真库 | P2 | 需 sqlite-fault helper / monkeypatch sqlite3.connect 在事务中段杀连接，自建成本高 | 下一轮 `backend-testing` 补；或装 `pytest-sqlite-fault` 类库 |
| G-08 | backup/restore 并发竞态 | B-① 真库 | P3 | 单用户工具，并发备份场景罕见 | v1.1 评估 |
| G-09 | BOLA/BFLA 越权 | B-② 鉴权 | — | **不命中**（PRD §7.3 单用户 Tailscale 内网，无 auth、无多租户） | 永久不做 |

## 命中机制 vs 不命中（覆盖维度速查）

| 维度 | 本 feature 命中? | 已覆盖? | 缺口? |
|---|:-:|:-:|:-:|
| 真库 / 迁移 / 事务 / 约束 | ✓ | T002 T004 T013 + G-02 G-05 G-06 | G-07 G-08 推后 |
| 鉴权 / BOLA / BFLA | ✗ | — | — |
| 并发 / 竞态 / 限频 | ✓ | G-01 G-05 | — |
| 韧性 / 故障注入 / 降级 | ✓ | T005 + G-03 G-04 G-06 | — |

## 可追溯 ID 索引

每个 G-XX 测试模块顶端包含：
- `风险级：P0/P1/P2/P3`
- `可追溯：F5 / 001-watchlist-crud / FR-XXX 或 task-id`

便于 CI 报告反查到原始 feature 与 FR。
