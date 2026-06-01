# 会话交接 · LLM 异动解释（F3 · 004-llm-anomaly-explain）

## 完成时间
2026-05-28

## 状态
✅ 14/14 tasks · 161 BE tests · tag `v0.1.0-004-llm-anomaly-explain`
⏸️ 联调待凭证（LLM API key 未提供，模板模式可跑）

## 交付摘要
- BE：openai-compat SDK（主 DeepSeek / 备 Qwen / 兜底 Ollama）+ 模板模式（预算=0/无 key 自动）+ 三层降级链 + budget 累加 + 合规过滤（10 类禁词 + 200 字截断 + 强制风险尾标）+ prompt 注入隔离（`<参考资料>` 围栏）+ 缓存
- API：`POST /explain` 暴露给 F2/F4/Dashboard
- test-routing-advisor 判类：单后端 + 跨模块契约候选
- BE 补测：✅ BE-4/5/6（spec-kit TDD）· 不命中 BE-2（单用户本地）· 新增 G-BE-1 并发 add_llm_cost 幂等性 + G-BE-3 budget 软上限 race 文档化

## 下游对接
- F2/F4：`explain_service` + `llm_service` + `news_source` + `sensitive_filter`
- F1：`POST /explain` 为「为什么」按钮
- 新表 `llm_budget(on_date, cost_cny)` 跨日隔离

## 未做 · 待凭证（不阻塞）

| 凭证 | `.env` key | 当前 | 提供后 |
|---|---|---|---|
| 主 LLM | `LLM_PRIMARY_*`（DeepSeek） | 模板模式 | ≤200 字 AI 解释 + 尾标 |
| 备 LLM | `LLM_BACKUP_*`（Qwen） | 不参与 | 主超时切备 |
| Ollama | `OLLAMA_BASE_URL/MODEL` | 不参与 | 备失败切本地 |
| 预算 | `LLM_DAILY_BUDGET`（默认 5） | — | 软上限（G-BE-3 钉死） |

`tests/test_explain.py::test_real_provider_smoke` 用 skip 占位；凭证到位去 skip 跑真接口。

## 怎么本地跑
```bash
cd backend && uv sync && uv run uvicorn app.main:app --reload --port 8000
curl -X POST http://127.0.0.1:8000/explain -H 'content-type: application/json' \
  -d '{"code":"600519","name":"贵州茅台","anomaly_type":"limit_up","price":1500,"change_pct":0.10}'
```
