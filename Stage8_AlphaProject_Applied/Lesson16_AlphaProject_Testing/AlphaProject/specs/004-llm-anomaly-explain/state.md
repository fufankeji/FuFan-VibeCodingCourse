# 实施进度 · LLM 异动解释（F3 · 004-llm-anomaly-explain）

## 当前任务
✅ 全部 14 任务完成，进入收尾（test-routing-advisor → backend gaps → tag）

## 已完成
- T001 · LLM 配置（主/备/Ollama + 预算 + 计价 + 超时）+ template_mode 推断
- T002 · llm_budget 表 + add/get/reset (per-day 行隔离自动跨日归零)
- T003 · ExplainRequest / ExplainResult / ExplainContext + AnomalyType / ResultSource 枚举
- T004 · news_source (AkShare 财联社+公告 + 60s TTL + 失败容错)
- T005 · context_assembler (sector/industry + 名/代码/行业词关键词筛选 + partial 标记)
- T006 · prompt_templates (system 指令区 + <参考资料> 数据区物理分隔，防注入)
- T007 · llm_service (primary→backup→local→TemplateSignal 降级链 + 成本估算 + OpenAICompat 适配)
- T008 · sensitive_filter (10 类禁用词 + 强制风险尾标 + 200/201 边界截断)
- T009 · explain_service 缓存 (code+anomaly_type 键，5min TTL)
- T010 · explain() 主编排 (cache → assemble → budget guard → LLM → 合规 → 写回 → 缓存)
- T011 · 预算守门 (budget≤0 / template_mode / 当日成本超额 → 跳 LLM 走模板)
- T012 · 上下文降级 (partial 透传；ctx.empty + 无行情 → "数据不足"模板)
- T013 · POST /explain REST 端点 (Dashboard 为什么按钮 + F2 同步调用)
- T014 · 端到端 + 真实 provider smoke (skip 默认绿，含 LLM_PRIMARY_API_KEY 即可跑)

## 阻塞项
- 无

## 最后更新
2026-05-28
