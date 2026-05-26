# Vibe Coding 工作流集成指南

> 本 Skill 不是孤立工具，它在完整的 Vibe Coding 9 步流程中扮演特定角色。

---

## 9 步流程总览（Vibe Coding 项目开发方法论）

```
┌─────────────────────────────────────────────────────────────┐
│  1. 想法                                                    │
│  2. 调研（双线：业务 + 技术）                                │
│  3. PRD ← ⭐ 本 Skill 在这里                                 │
│  4. 技术方案设计（含 API 契约 + Mock 启动）                  │
│  5. 前端设计（设计工具 + Tokens）                            │
│  6. 前端开发（Mock 优先 + TDD）                              │
│  7. 后端开发（业务主线 + 风控合规并行）                       │
│  8. 联调（测试金字塔 + 量化回测 + Code Review）              │
│  9. 部署上线 + 监控 + 日志                                   │
└─────────────────────────────────────────────────────────────┘

跨阶段贯穿：Spec 即活文档（CLAUDE.md / Skills / ADR / KB）
```

---

## 本 Skill 的精确定位

**输入**：
- Step 2 调研产出（业务/技术/合规报告）
- Brainstorming Skill 产出（design doc）

**处理**：
- 苏格拉底式 Q&A 补齐空缺
- 按 14 章结构生成 PRD

**输出**：
- `<项目>/specs/<feature-slug>/prd.md`

**下游**：
- Step 4 技术方案设计（基于 PRD 产出 TRD）
- Step 5 前端设计（基于 PRD 设计 UI）

---

## 与 Brainstorming Skill 的衔接

### 工作流
```
[调研报告 + 想法] → Brainstorming Skill → design doc → ⭐ PRD-Writer Skill → prd.md
                       ↑                                  ↑
                       发散 + 收敛                          沉淀为正式文档
```

### 边界
- **Brainstorming 做的**：探索备选、问问题、做权衡、生成 design doc
- **PRD-Writer 做的**：把 design doc 按 14 章正式结构沉淀
- **不重叠**：Brainstorming 不写 PRD 章节，PRD-Writer 不做发散

### 操作建议
1. 先跑 Brainstorming Skill 收敛设计
2. 让 Claude 把 Brainstorming 产物保存为 `brainstorming-design.md`
3. 然后启动本 Skill：「基于 brainstorming-design.md 生成标准 PRD」
4. 本 Skill 会读取 design doc + 补充 Q&A → 产出 prd.md

---

## 与 GitHub Spec-Kit 的兼容

Spec-Kit 工作流：
```
/speckit.constitution → /speckit.specify → /speckit.plan → /speckit.tasks → /speckit.implement
                              ↑
                              ↑ 本 Skill 与 /specify 等价
```

### 兼容方式
本 Skill 产出的 prd.md **可以直接作为 spec.md 用**：
- 章节结构兼容
- 用 Given/When/Then 写验收
- 包含 Out-of-Scope / Open Questions
- 不含技术细节

### 差异化
| 维度 | Spec-Kit /specify | 本 Skill |
|------|:------:|:------:|
| 语言 | 英文为主 | **中文优先** |
| 工作流 | 命令式 | 对话式 + 章节模板 |
| 教学 | 偏自动化 | **苏格拉底 Q&A 引导** |
| 输出 | 精简 spec.md | 14 章完整 PRD |

---

## 与 OpenSpec 的兼容

OpenSpec 流程：
```
/opsx:propose → /opsx:design → /opsx:verify → /opsx:apply
                   ↑
                   本 Skill 产出可作为 propose 阶段的产物
```

### 集成方式
- 本 Skill 产出 prd.md
- 用 OpenSpec 把 prd.md 包装成 proposal
- OpenSpec 会自动追踪 PRD 变更（Delta Spec）

---

## 与 Superpowers Brainstorming 的衔接

Superpowers 的官方 7 步：
```
1. Brainstorming           ← 上游
2. Using-git-worktrees
3. Writing-plans
4. Subagent-driven-development
5. TDD
6. Code Review
7. Finishing-branch
```

本 Skill 插入在 1 → 2 之间：
```
1. Brainstorming → ⭐ PRD-Writer Skill → 2. git-worktrees → 3. Writing-plans → ...
                       ↑
                       把 design doc 沉淀为正式 PRD
```

---

## 文件组织建议

### 标准项目结构
```
<项目根>/
├── CLAUDE.md                        # 项目宪法（如有）
├── knowledge-base/                  # Step 2 调研沉淀
│   ├── 业务调研/
│   ├── 技术调研/
│   └── 合规调研/
├── specs/                           # PRD 产物目录
│   ├── 0001-self-stock-dashboard/
│   │   ├── prd.md                   ← ⭐ 本 Skill 产物
│   │   ├── plan.md                  ← Step 4 产物（不本 skill 负责）
│   │   ├── tasks.md
│   │   └── README.md
│   └── 0002-ai-stock-picker/
├── docs/
│   ├── adr/                         # 架构决策记录
│   └── domain/                      # 领域模型
└── ...
```

### 命名规则
- PRD 目录：`<4 位序号>-<kebab-case-feature-slug>/`
- PRD 文件：固定为 `prd.md`
- 序号自增：0001, 0002, ...

---

## 多 PRD 项目的索引管理

当项目有多个 PRD 时，建议在 `specs/README.md` 维护索引：

```markdown
# Specs 索引

| 序号 | 主题 | 状态 | 优先级 | 文档 |
|---|---|:---:|:---:|---|
| 0001 | 自选股 Dashboard | Approved | P0 | [prd.md](0001-self-stock-dashboard/prd.md) |
| 0002 | AI 智能选股 | Draft | P0 | [prd.md](0002-ai-stock-picker/prd.md) |
| 0003 | 早盘简报 | Draft | P0 | [prd.md](0003-morning-briefing/prd.md) |
| 0004 | 异动预警 | Backlog | P1 | [prd.md](0004-alert-system/prd.md) |
```

每个 PRD 状态可以是：Draft / Review / Approved / Implemented / Deprecated

---

## 跨阶段贯穿：Spec 即活文档

本 Skill 产出的 PRD **不是一次性的**，要随项目演化：

### PRD 何时需要更新
- 验收标准被新发现的需求修改
- Out-of-Scope 被砍 / 加项
- 风险评估有更新
- 度量指标根据上线数据校准

### 更新机制
1. 改 PRD 必须更新版本号（v1.0 → v1.1）
2. 必须在变更记录中说明改动原因
3. 重大变更（V → V+1）需要重新评审
4. 通过 git 追溯所有变更

---

## 与 Cursor / Codex 的兼容

PRD 产物是标准 Markdown，所有 AI Coding 工具都能消费：

| 工具 | 兼容性 | 用法 |
|------|:------:|------|
| Claude Code | ✅ 原生 | 自动加载 |
| Cursor | ✅ Markdown | @file 引用 |
| Codex (VS Code) | ✅ Markdown | 选择上下文 |
| Gemini Code Assist | ✅ Markdown | 同上 |

---

## 团队协作模式

### 个人项目（1 人 + AI）
- 自己跑 Skill → 自己评审
- PRD 简版（9 章足够）

### 小团队（2-5 人）
- PM 跑 Skill → 团队评审 → Approved
- PRD 中版（12 章）

### 中大型团队（>5 人）
- PM 跑 Skill → 多轮评审 → Approved
- PRD 完整版（14 章）
- 配合 OpenSpec 做变更管理

---

## 常见集成场景

### 场景 1：从零开始的新项目
1. 想法 + MVP 砍范围
2. 调研（双线）
3. Brainstorming（探索方案）
4. **PRD-Writer**（沉淀文档）⭐
5. 技术方案 / Figma / 开发 ...

### 场景 2：已有项目加新功能
1. 写新功能的 mini PRD（精简版 9 章）
2. 引用现有项目宪法
3. 与已有 PRD 做兼容性说明

### 场景 3：重构 / 改版
1. 写"重构 PRD"
2. 明确"为什么重构"+ "保留什么 + 改什么"
3. 加 Migration Plan 章节

---

## 反集成模式（不要这么用）

- ❌ 跳过 Brainstorming 直接用本 Skill（PRD 会缺深度）
- ❌ 在调研之前用本 Skill（PRD 会失真）
- ❌ 用本 Skill 写技术方案（边界混乱）
- ❌ 一份 PRD 涵盖 10 个不相关功能（拆开）
