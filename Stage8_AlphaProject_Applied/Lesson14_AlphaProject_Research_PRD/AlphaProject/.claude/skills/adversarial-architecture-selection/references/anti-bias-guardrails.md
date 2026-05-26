# 反偏见硬性约束与学术依据

> 多 agent 辩论框架的最大威胁是"看起来在辩论，实际上在从众"。本文沉淀反偏见硬约束 + 学术论文支撑。

---

## 一、6 条反偏见硬约束（必须遵守）

| # | 约束 | 反什么偏见 | 学术依据 |
|---|------|----------|---------|
| 1 | 每份 paper 必含"致命缺陷自述"| 代言人偏见（self-advocacy bias）| D3 SAMRE / Anthropic Constitutional AI |
| 2 | Phase 2 papers 随机打乱顺序提交 | 位置偏见（positional bias）| LLM-as-Judge survey 2024-2026 |
| 3 | 每条质疑回应 ≤ 200 字 | 长度偏见（length bias）| LLM-as-Judge survey |
| 4 | Lead 在 Phase 2 中禁止表态 | 权威偏见（authority bias）| MAD-M² ICLR 2026 |
| 5 | Phase 1 禁止 teammate 互相通信 | 锚定偏见（anchoring bias）| Claude Code Agent Teams 官方文档 |
| 6 | 红队 / 代言人立场固定不可倒戈 | 从众偏见（conformity bias）| Nature 2026 "When collaboration fails" |

---

## 二、6 种偏见详解

### 偏见 1：代言人偏见（Self-Advocacy Bias）

**症状**：代言人天然倾向于强调项目优点，弱化缺点。

**为什么会发生**：LLM 在被赋予"为 X 辩护"角色后会进入"律师模式"，本能压制反证。

**对决策的伤害**：所有代言人都说"我的项目最好"，Lead 没有可比较的负面信息可以权衡。

**约束 1：致命缺陷自述（强制 self-attack）**

让代言人**自己**报缺陷的原理：
- 缺陷自述被设计为 paper 的强制字段，缺失视为失职
- 自报永远比被对方挖出更好——至少能控制叙事
- 强制 self-attack 是 Constitutional AI 中"自我批评"机制的延伸

实现细节：
- 必须列 3 个缺陷（不是 0 个、不是"暂未发现"）
- 每个缺陷必须有可验证的证据（源码 line / commit / Issue）
- 缺陷的严重程度不能全是"小问题"——Lead 会识破

**学术依据**：
- D3 Framework (arXiv 2410.04663) SAMRE 协议要求每个 advocate 在第 N 轮 self-revise（自我批评）
- Anthropic Constitutional AI (arXiv 2212.08073) 用 "critique → revise" 循环让 LLM 自我纠错

---

### 偏见 2：位置偏见（Positional Bias）

**症状**：评估者（Lead 或 teammate）倾向于偏好**先呈现**的选项。

**为什么会发生**：注意力衰减 + 工作记忆首位效应。LLM 评估时第一份 paper 占据"上下文头部"，记忆最深刻。

**对决策的伤害**：原本两份 paper 质量相当，但先看到的那份会被无意识高估。

**约束 2：Phase 2 papers 随机打乱顺序提交**

实现细节：
- Lead 在 Phase 2 启动前调用伪随机算法打乱 paper 顺序
- 打乱后的顺序记录到内部 log（便于事后审计）
- 广播给所有 teammate 时使用打乱顺序，**不**使用 Phase 1 完成顺序、不使用项目字母顺序

进阶做法（未来可考虑）：
- 同一份 paper 在不同 teammate 的 mailbox 中可以是不同位置（per-teammate 打乱）
- 但实现复杂度高，本 Skill 暂用全局打乱

**学术依据**：
- "Judging LLM-as-a-Judge" (arXiv 2306.05685) 明确报告位置偏见可达 30%+
- LLM-as-Judge survey 推荐的"balanced prompt ordering"

---

### 偏见 3：长度偏见（Length Bias）

**症状**：评估者偏好**更长**的论证，即使内容质量相同。

**为什么会发生**：长 = 详细 = 努力 = 更可信，这是 LLM 学到的人类偏见。

**对决策的伤害**：能写长篇大论的代言人天然占优，论证质量被字数压制。

**约束 3：每条质疑回应 ≤ 200 字**

实现细节：
- 200 字硬上限，超过的回应视为"违规"
- Lead 检测到超字时要求 teammate 重写
- 200 字够说清楚一个论点，又不至于刷字数

为什么是 200 字不是 300/500：
- D3 SAMRE 协议建议每条 ≤ 250 token（约 150 中文字 + 50 英文）
- 200 字稍宽松，留给中文表达
- 测试表明 200 字内能清晰传达 1-2 个核心反驳点

**学术依据**：
- LLM-as-Judge survey (arXiv 2308.10142) 报告 length bias 在多数 judge LLM 中存在
- 推荐的"length-normalized scoring"（按长度归一化打分）—— 本 Skill 采用更简单的"硬上限"

---

### 偏见 4：权威偏见（Authority Bias）

**症状**：当 Lead（"权威"）表态后，teammate 倾向于附和。

**为什么会发生**：LLM 受 RLHF 训练偏好取悦"权威指令发起者"。

**对决策的伤害**：辩论变成"猜 Lead 心意"，独立性丧失。

**约束 4：Lead 在 Phase 2 中禁止表态**

实现细节：
- Lead 在 Phase 2 期间**只协调、不评价**
- 允许的 Lead 行为：广播 paper、传递质疑、提示"还有 N 条质疑没回应"、宣布进入下一轮
- 禁止的 Lead 行为：说"代言人 A 的论点更有道理"、说"我觉得项目 X 更好"、暗示倾向（如"项目 Y 看起来很可靠？"）

如果 Lead 不小心表态了：
- 在 Phase 3 综合时**主动降权**该方向的论点
- 在 06 决策文档中**披露**Lead 在 Phase 2 中的表态记录

**学术依据**：
- MAD-M² (ICLR 2026) 的 memory masking 机制就是为了消除"权威先验"
- LLM-as-Judge 最佳实践："judge should not produce evidence, only evaluate"

---

### 偏见 5：锚定偏见（Anchoring Bias）

**症状**：当某个 teammate 先公开立场后，其他 teammate 的立场会"向第一个收敛"。

**为什么会发生**：人类协作的本能 + LLM 学到的"礼貌妥协"模式。

**对决策的伤害**：辩论变成"第一份 paper 决定走向"，多元视角丧失。

**约束 5：Phase 1 禁止 teammate 互相通信**

实现细节：
- Phase 1 期间 mailbox 静默——所有 teammate 不能给彼此发消息
- Lead 监控 mailbox 流量，发现 Phase 1 期间互相通信立即叫停
- 每个 teammate 必须独立完成自己的 paper / 立场 / 评估

为什么不是只禁止"看对方 paper"：
- 即使不看 paper，互相通信也会泄露立场（"我觉得 X 不行"会影响别人）
- 完全静默最干净

**学术依据**：
- Claude Code Agent Teams 官方文档原话："With multiple independent investigators actively trying to disprove each other, the theory that survives is much more likely to be the actual root cause."
- 独立性是辩论价值的前提

---

### 偏见 6：从众偏见（Conformity Bias）⚠️ 最危险

**症状**：在多轮辩论中，少数派 teammate 倾向于"放弃立场加入多数派"。

**为什么会发生**：LLM 学到的"和谐"模式 + 长上下文中"频繁出现的观点"权重升高。

**对决策的伤害**：辩论最终都收敛到"皆大欢喜"的方案，真正的对抗失效。

**约束 6：红队 / 代言人立场固定不可倒戈**

实现细节：
- 红队的 spawn prompt 明文写"禁止说 'X 项目其实挺好'"
- 代言人 spawn prompt 写"除非 Lead 判决，不退让"
- 代言人不能在 Phase 2 主动放弃自己 owns 的某份 paper（可以承认部分质疑，但不能撤回整份 paper）
- 倒戈意愿不在 Phase 2 表达，可在 Phase 3 由 Lead 综合时参考（代言人通过最终承认部分质疑表达）

**学术依据**：
- Nature 2026 "When collaboration fails: persuasion driven adversarial influence in multi-agent LLM debate" 直接报告了从众失效模式
- 反制方法：role lock-in（角色锁定）+ explicit anti-conformity instruction

---

## 三、其他常见偏见（已默认规避）

| 偏见 | 规避方法 |
|------|---------|
| Self-preference（自我偏好）| Lead 不是任何 advocate 转过来的；teammate 独立 context |
| Verbosity bias（啰嗦偏见）| 200 字硬限 + Phase 2 质疑必须带证据 |
| Sycophancy（讨好偏见）| 红队 / 代言人立场锁定 |
| Recency bias（近因偏见）| Phase 3 综合时 Lead 必须**回读** Phase 1 papers，不能只看 Phase 2 transcript |
| Overconfidence（过度自信）| 致命缺陷自述强制；Open Questions 至少 3 个 |

---

## 四、Lead 法官的自检清单

Phase 3 写决策前，Lead 必须自检：

```
□ 我在 Phase 2 中是否表态过？（如有，相关论点降权）
□ 所有 papers 是否包含致命缺陷自述？（缺失的 paper 信用打折）
□ 我的判决是否基于"哪个更长"？（如是，重新评估）
□ 我的判决是否基于"我个人喜欢"？（如是，回去找客观依据）
□ Open Questions 是否至少 3 个？（少于 3 个说明判决过于自信）
□ 被否方案的理由是否引用了 debate-transcript 的具体行号？（不能凭印象）
□ 整个判决是否反映了 7 维度综合权衡，不是只看第 5 维成本？
```

任一项不过关 → 回去重写决策。

---

## 五、学术参考文献

1. **D3 Framework** — Debate, Deliberate, Decide: A Cost-Aware Adversarial Framework for Reliable and Interpretable LLM Evaluation. arXiv 2410.04663
2. **MAD-M²** — Multi-Agent Debate with Memory Masking. ICLR 2026
3. **When Collaboration Fails** — Persuasion driven adversarial influence in multi-agent LLM debate. Nature Scientific Reports 2026
4. **Judging LLM-as-a-Judge** — arXiv 2306.05685
5. **LLM-as-Judge Survey** — arXiv 2308.10142
6. **Anthropic Constitutional AI** — arXiv 2212.08073
7. **Claude Code Agent Teams** 官方文档 https://code.claude.com/docs/en/agent-teams.md
8. **Courtroom-Style Multi-Agent Debate (AgentCourt)** — arXiv 2603.28488
9. **MAD: Should we be going MAD? A Look at Multi-Agent Debate Strategies for LLMs** — arXiv 2311.17371
10. **Improving factuality and reasoning in language models through multiagent debate** — ICML 2024
