# PRD-Writer · 标准产品需求文档生成 Skill

> 一个 Claude Code Skill，把"想法 + 调研 + 头脑风暴结论"转化为符合行业标准的 14 章 PRD 文档。

---

## ✨ 核心特性

- 🇨🇳 **中文优先**，章节命名保留中英对照
- 📐 **14 章完整结构**，覆盖背景、用户、功能、验收、度量、风险全维度
- 🔗 **Vibe Coding 工作流深度对接**：Brainstorming → PRD → TRD
- 🤖 **AI Agent 友好**：Spec-Driven Development 范式，PRD 可被 AI 直接消费
- 📊 **场景化完整示例**：内置量化交易项目 PRD 全版
- ⚖️ **What/How 边界明确**：清晰的 PRD vs TRD 判定指南
- ✅ **反模式自检清单**：24 条 + 速查表，写完即查
- 🧩 **三种使用强度**：完整版（14 章）/ 精简版（9 章）/ 极简版（5 章）

---

## 📦 安装

### 方式 1：Claude Code 项目本地 Skill

```bash
# 把整个 prd-writer/ 目录复制到项目的 .claude/skills/ 下
cp -r prd-writer /path/to/your/project/.claude/skills/

# Claude Code 会自动发现并加载
```

### 方式 2：Claude Code 全局 Skill

```bash
# 复制到全局 Skills 目录
cp -r prd-writer ~/.claude/skills/

# 重启 Claude Code 生效
```

### 方式 3：作为 SkillsRegistry 一部分

```bash
# 如果有自己的 Skills Registry 仓库
cp -r prd-writer /path/to/SkillsRegistry/skills/
# 然后在 .claude/skills/ 创建软链接
ln -s /path/to/SkillsRegistry/skills/prd-writer ~/.claude/skills/prd-writer
```

---

## 🚀 使用方式

### 触发方式（任一即可）

向 Claude Code 说：
- "帮我写一份 PRD"
- "把我的想法变成产品需求文档"
- "整理这些调研成产品规约"
- "用 prd-writer Skill 生成 PRD"
- 「请基于 brainstorming-design.md 写一份 PRD」

Claude Code 会自动识别并调用本 Skill。

### 标准工作流

```
Step 1：用户准备上游产物
   ├─ 调研报告（业务 / 技术 / 合规）
   ├─ Brainstorming design doc
   └─ MVP 范围声明

Step 2：触发 Skill
   "帮我写一份 PRD"

Step 3：Skill 引导补齐信息
   - 项目一句话定义
   - 主画像 / 反画像
   - MVP 范围（做什么 / 不做什么）
   - 成功指标
   - 非功能需求底线
   - Open Questions

Step 4：Skill 生成 14 章 PRD
   - 输出到 specs/<feature-slug>/prd.md
   - 自检 4 个关键边界

Step 5：衔接下一步
   - 启动技术方案设计（Step 4）
```

---

## 📁 Skill 目录结构

```
prd-writer/
├── SKILL.md                                  # 主入口（必读）
├── README.md                                 # 本文件
└── references/
    ├── 14-chapters-detailed.md               # 14 章详细模板与填充指南
    ├── prd-vs-trd-boundary.md                # What/How 边界判定
    ├── quant-trading-example.md              # 完整量化交易 PRD 示例
    ├── prd-anti-patterns.md                  # 反模式清单（24 条）
    └── workflow-integration.md               # Vibe Coding 9 步流程集成
```

---

## 📐 14 章 PRD 标准结构

| # | 章节 | 必/推/可 |
|:-:|------|:-:|
| 1 | 文档信息 | ★ |
| 2 | 项目背景与目标 | ★ |
| 3 | 目标用户与画像 | ★ |
| 4 | 用户故事 | ★ |
| 5 | 功能列表与范围 | ★ |
| 6 | 详细功能描述 | ★ |
| 7 | 非功能需求 | ★ |
| 8 | UI / 交互说明 | ☆ |
| 9 | 验收标准 | ★ |
| 10 | 优先级 / MVP 范围 | ★ |
| 11 | 度量指标 | ★ |
| 12 | 依赖与约束 | ☆ |
| 13 | 风险与开放问题 | ★ |
| 14 | 里程碑 / 时间计划 | ☆ |

详见 `references/14-chapters-detailed.md`

---

## 🎯 三种使用强度

### 完整版（适用于：中大型项目 / 跨团队 / B 端 SaaS）
全部 14 章

### 精简版（适用于：个人项目 / 小团队 / 探索性 MVP）
保留 #1, #2, #3, #5, #6, #9, #10, #11, #13（9 章）

### 极简版（适用于：1 人项目 / 1 周内交付）
保留 #2, #5, #6, #9, #13（5 章）

Skill 会根据项目规模自动推荐合适的强度。

---

## 🔗 兼容性

| 工具 / 框架 | 兼容性 |
|------|:-----:|
| GitHub Spec-Kit `/specify` | ✅ 完全兼容 |
| OpenSpec | ✅ 兼容 |
| Superpowers Brainstorming | ✅ 完美衔接 |
| Claude Code 内置 | ✅ 原生 |
| Cursor / Codex / Gemini Code Assist | ✅ Markdown 通用 |

---

## 🧪 测试这个 Skill

测试 prompt 示例：

```
# 测试 1：从零开始
"我有个想法：做一个 7×24 帮我盯 A 股的 AI 助手。请用 prd-writer 帮我写 PRD。"

# 测试 2：基于已有材料
"我有调研报告和 brainstorming-design.md，请用 prd-writer 生成 PRD。"

# 测试 3：精简版
"我是 1 人项目，1 周内要交付，请用 prd-writer 极简版（5 章）写 PRD。"
```

---

## 📄 License

MIT License - 自由使用 / 修改 / 分发

---

## 📮 反馈

发现问题或建议改进？请通过以下方式反馈：
- Issues：<your-repo-url>/issues
- Email：<your-email>

---

**版本**：v1.0
**最后更新**：2026-05-19
