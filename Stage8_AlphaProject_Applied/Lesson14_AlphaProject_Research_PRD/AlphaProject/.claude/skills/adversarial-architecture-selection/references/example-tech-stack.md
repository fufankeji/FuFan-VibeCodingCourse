# Example · 纯技术栈选型（LangChain vs LlamaIndex vs Haystack）

> 场景：构建一个企业知识库 RAG 系统，需在 3 个主流 LLM 框架中选 1 个或复合方案。
> 与 fork 选型不同：本场景**无源码 fork 计划**，纯库选型——7 维度框架需要适配。

---

## 输入

### 项目定位
企业内部知识库 RAG 系统：私有文档检索 + LLM 问答 + 引用溯源 + 多租户。

### 候选清单
1. **LangChain**（最知名、生态最大、Python + JS）
2. **LlamaIndex**（专注 RAG、检索优化深、Python 为主）
3. **Haystack**（生产导向、Pipeline 抽象清晰、Python）

N = 3，每代言人 owns 1 库。

---

## 7 维度框架适配（关键差异）

库选型场景下，7 维度调整如下：

| 维度 | 原版（fork 场景）| 适配版（库选型场景）|
|------|---------------|-----------------|
| 1. 架构总览 | 项目目录 + Mermaid | 库的核心抽象 + 关键模块 |
| 2. 核心能力清单 | 项目实际功能 | **库提供的开箱即用组件**（向量库、retriever、agent、tool 等）|
| 3. 数据模型 | 关键类/表/接口 | **库的核心 schema**（Document、Chunk、Query、Response）|
| 4. 扩展点 | 项目预留 hook | **插件生态丰富度** + 自定义组件难度 |
| 5. 改造成本估算 | fork 改造人日 | **学习曲线 + 集成成本 + 迁移成本** |
| 6. 致命缺陷自述 | 项目缺陷 | **库的设计缺陷 / 性能瓶颈 / 锁定风险** |
| 7. 与其他候选的集成 | 项目复合可行性 | **多库共存可能**（如 LangChain agent + LlamaIndex retriever）|

Lead 在 Phase 0 时必须在 `00-任务分配.md` 中明确写：

```markdown
## 7 维度本次具体含义（库选型场景）
- 维度 2 "核心能力清单"：本次指库提供的开箱即用组件，而非项目功能
- 维度 5 "改造成本估算"：本次指学习曲线 + 集成成本 + 迁移成本
- ...
```

---

## Phase 1 示例：LangChain 代言人 paper 节选

```markdown
# Position Paper: LangChain

## 1. 架构总览（库的核心抽象）
核心抽象：Runnable（统一接口）+ LCEL（声明式管道）+ Agent + Tool
关键模块：
- `langchain.chains`：现成的 chain（QA、Summarize、Router 等）
- `langchain.agents`：Agent + Tool 生态
- `langchain.memory`：对话记忆
- `langchain.vectorstores`：30+ 向量库适配
- `langchain.embeddings`：20+ embedding 模型适配
- `langchain.retrievers`：MultiQuery、ParentDocument、SelfQuery 等高级 retriever

## 2. 核心能力清单
- ✅ 稳定：100+ LLM 提供商集成（OpenAI/Anthropic/HF/...）
- ✅ 稳定：30+ 向量库集成
- ✅ 稳定：Agent + Tool 完整生态
- ✅ 稳定：LCEL 声明式管道
- 🟡 Beta：LangGraph（状态机 Agent）
- 🟡 Beta：LangSmith（observability）
- ❌ 待完善：Retrieval 优化深度不及 LlamaIndex

## 3. 数据模型
核心 schema：
- `Document(page_content, metadata)`
- `BaseMessage(content, type)`
- `Runnable.invoke/stream/batch` 统一接口

## 4. 扩展点
✅ 良好扩展：
- Custom Tool 继承 BaseTool 即可
- Custom Retriever 继承 BaseRetriever
- LCEL 支持任意自定义节点

⚠️ 难扩展：
- LangChain 0.1 → 0.2 重构破坏性大，旧扩展可能不兼容

❌ 反扩展点：
- 内置 Agent 类型迭代过快，文档时常滞后

## 5. 改造成本估算（学习 + 集成）
| 项 | 人日 |
|----|:----:|
| 团队学习 LCEL 抽象 | 3-5（中等）|
| 接入私有 LLM + 私有向量库 | 2-3 |
| 实现多租户隔离 | 5-8 |
| 引用溯源（自定义元数据流）| 3-5 |
| **合计** | **13-21 人日** |

## 6. ⭐ 致命缺陷自述
1. **抽象层过多，性能开销显著**——简单 RAG 用 LangChain 比手写慢 30-50%
   （证据：社区 benchmark + 多个 reddit 反馈）
2. **API 不稳定**——0.1 → 0.2 重构破坏性大，企业版本锁定风险高
3. **Retrieval 深度不够**——纯检索质量不及 LlamaIndex 的高级 retriever

## 7. 与其他候选的集成可行性
- vs LlamaIndex：**部分集成**——可用 LlamaIndex 做高级 retrieval，
  LangChain 做 agent 编排。两者都遵循 BaseRetriever 接口
- vs Haystack：**互斥**——Haystack 的 Pipeline 抽象与 LCEL 冲突
```

---

## Phase 2：红队对 LangChain 的质疑示例

```markdown
红队 → LangChain 的 3 条质疑：

Q1：你自报"性能开销 30-50%"，对企业级 RAG（万级 QPS）是致命问题。
    具体到目标产品的并发要求，LangChain 是否仍可接受？

Q2：API 不稳定意味着每次大版本升级都要重测——企业内部系统通常 1-2 年
    才大升级，LangChain 的破坏性升级（半年一次）和企业节奏冲突，怎么解？

Q3：你的"100+ LLM 集成"对目标产品只需 1-2 个（OpenAI + 私有模型），
    其他都是冗余。这部分价值打折后，LangChain 的真实优势还剩多少？
```

### LangChain 代言人回应（≤ 200 字）

```markdown
R1：目标产品是企业内部知识库，QPS 估算 10-50，远低于"万级"。性能开销
    可接受。如未来 QPS 增长，可锁定 LangChain 0.x 版本不升级。

R2：可通过 pin 死版本 + 内部 fork 关键模块解决。维护成本约 +2 人日/年，
    可接受。

R3：承认大部分集成是冗余。但 Agent + Tool 生态、LCEL 声明式管道、
    LangSmith observability 这三块是核心价值，不可替代。
```

---

## Phase 3：Lead 综合判决（示例摘录）

```markdown
# 06 架构基线决策（库选型）

## 1. 决策摘要

**架构基线**：LangChain（Agent 编排）+ LlamaIndex（Retrieval 增强）复合方案

**一句话理由**：LangChain 生态最广、LlamaIndex 检索最深，复合使用各取所长。

## 2. 复用矩阵

| 模块 | 来源 | 处理方式 |
|------|------|---------|
| Agent 编排 | LangChain | 用 LCEL 写主管道 |
| Tool 集成 | LangChain | 用 BaseTool 接口 |
| 向量库适配 | LangChain | OpenAI Embedding + Chroma |
| Retrieval（高级）| LlamaIndex | SubQuestionQueryEngine + AutoMergingRetriever |
| Observability | LangSmith | 直接接入 |
| 引用溯源 | 自建（基于 Document.metadata）| - |
| 多租户隔离 | 自建 | - |

## 3. 被否方案理由

### Haystack 为什么没选
- 与 LangChain LCEL 抽象冲突（代言人 3 自报 + 集成评估师确认）
- 生产导向但生态规模显著小于 LangChain

### LangChain 单库为什么没选
- Retrieval 深度不及 LlamaIndex（代言人自报缺陷 + 集成评估师评分 LlamaIndex retrieval 8.5 vs LangChain 6.0）

### LlamaIndex 单库为什么没选
- Agent + Tool 生态显著弱于 LangChain（代言人 2 自报）

## 4. Open Questions

1. LangChain 与 LlamaIndex 复合的版本锁定策略
2. Retrieval 评测基准如何建立
3. 是否考虑未来切到 Haystack 的预案
```

---

## 库选型场景与 fork 选型的关键差异

| 维度 | fork 场景 | 库选型场景 |
|------|----------|-----------|
| 改造成本含义 | fork 后改代码人日 | 学习 + 集成 + 迁移人日 |
| 致命缺陷重点 | 项目活跃度 / bug / 缺失功能 | 性能 / API 稳定性 / 锁定风险 |
| 集成可行性 | 多 fork 拼装 | **多库共存可能**（更轻量）|
| Open Questions 重点 | 改造的具体技术问题 | **版本锁定 / 迁移预案 / 评测基准** |
| 红队的"全自建"立场 | 全自建一个项目 | **不用框架，直接写底层 LLM API** |

---

## Lead 在库选型场景的额外注意事项

1. **Phase 0 必须明确"7 维度场景版含义"**——否则代言人会写成 fork 场景版的内容
2. **集成评估师重点评估"多库共存"**——库选型场景下复合方案通常成本更低
3. **致命缺陷自述**重点应放在"性能 / 锁定 / 升级风险"而非"项目活跃度"
4. **Open Questions** 应包含**版本锁定策略**和**迁移预案**——这是库选型独特的风险

---

## 何时不应使用本 Skill 做库选型

如果出现以下情况，本 Skill 过重，建议用更轻量方法：

| 场景 | 推荐方法 |
|------|---------|
| 已有 90% 倾向，只想确认 | 单 agent devil's advocate Skill |
| 3 个候选差异极小（如 React 18 vs 19）| 直接看官方迁移指南 |
| 候选之间是"互补关系"而非"选型关系"| 跳过选型，直接做集成方案设计 |
| 团队已用过其中一个 | 倾向于已熟悉的，调研重点变为"是否值得切换" |
