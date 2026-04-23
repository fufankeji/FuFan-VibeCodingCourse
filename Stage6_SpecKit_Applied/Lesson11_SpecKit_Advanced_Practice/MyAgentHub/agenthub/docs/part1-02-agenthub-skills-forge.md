# Part1-02 AgentHub · Skills 铸造手册 —— `figma-to-nextjs-migration` Skill 设计稿


# 第一部分：为什么要把搬家做成 Skill

## 1.1 这件事"值得 Skill 化"

回看 `prep-migration.md` 的 1000 多行内容——`为什么搬家（第一部分）` 和 `搬家 7 步（第三部分）`——这是一套**可抽象、可复用、有明确触发条件**的工作流：

| 特征 | 搬家流程的表现 |
|------|--------------|
| **触发条件明确** | "Figma Make 出的 Vite 项目 → Next.js"——描述得清楚，AI 能识别 |
| **步骤稳定** | 7 步固定：备份 → 起新项目 → 迁样式 → 搬 UI 库 → 重构 layout → 搬 7 个页面 → 批量替换 react-router |
| **高频率复用** | 用户未来每次用 v0.dev / Figma Make / Bolt 出原型 → 都要搬 |
| **内含工程判断** | use client 标记、Hydration 修复、next/font 换 @import、import alias 对齐——这些坑都是血泪经验 |
| **产出可验证** | 搬完能 `pnpm dev` 跑起来 + 7 个页面都能访问 = 成功判据 |

符合这五条的工作流，**放在 md 文档里是浪费**——md 要"人去读 → 人去操作"。做成 Skill 之后，是"**AI 识别场景 → AI 自动唤醒 → AI 跑完整个流程**"。


# 第二部分：目标 Skill 的架构设计

## 2.1 Skill 基本信息

| 字段 | 值 |
|------|-----|
| **Skill 名字** | `figma-to-nextjs-migration` |
| **存放位置** | `.claude/skills/figma-to-nextjs-migration/`（项目级） |
| **所有权** | 本课程专属（不进 FF-SkillsRegistry 全局仓库） |
| **生命周期** | 长期 —— 以后任何 Figma Make / v0.dev / Bolt 项目转 Next.js 都能复用 |

## 2.2 目录结构（给 skill-creator 的蓝图）

```
.claude/skills/figma-to-nextjs-migration/
├── SKILL.md                         # ← 入口文件（必须），含 frontmatter 和 body
│
├── references/                      # ← 按需加载的参考资料（SKILL.md 里 @ 引用）
│   ├── migration-steps.md           # 7 步完整流程（从 prep-migration.md §3 抽出来）
│   ├── rr-to-next-mapping.md        # React Router ↔ Next.js 对照表（§2.2）
│   ├── use-client-rules.md          # "use client" 判定规则（§2.3）
│   ├── hydration-fixes.md           # Hydration mismatch 修复模式（seededRandom 等）
│   └── common-errors.md             # 常见错误表 + 解法（§3.7）
│
├── templates/                       # ← 可复用代码模板
│   ├── next-layout-template.tsx     # Next.js App Router 的 layout.tsx 模板（含 NavLink 包装）
│   ├── not-found-template.tsx       # app/not-found.tsx 模板
│   ├── next-fonts-template.ts       # next/font/google 配置模板
│   └── globals-css-template.css     # 合并后的 globals.css（含 @theme + @custom-variant dark）
│
├── scripts/                         # ← 可直接执行的工具脚本
│   ├── backup.sh                    # 备份原项目（带时间戳）
│   ├── create-next-scaffold.sh      # 跑 pnpm create next-app 并带固定参数
│   ├── commit-baseline.sh           # Step 8：搬完立刻 git add -A + commit 固化，防 reset 回脚手架
│   └── verify.sh                    # 搬家后一键验证（启动 dev、访问 7 个路由、抓异常日志）
│
└── examples/                        # ← 可选，成功案例参考
    └── agenthub-migration-log.md    # 本课程第一次搬家的完整记录（就是 prep-migration.md 的精简版）
```

**为什么这么切分**：
- `SKILL.md` 只放**总览 + 索引**（500 行以内），打开 Skill 时 AI 先读这个
- `references/*.md` 是**按需加载**的深度资料，AI 需要时才 `@references/xxx.md` 引用进来
- `templates/*` 是**可直接 copy 的代码**，AI 会把它们写到用户项目里
- `scripts/*` 是**可执行的 bash**，AI 直接调用而不用重写
- 符合 Claude 官方推荐的"三层渐进加载"最佳实践

## 2.3 SKILL.md 的 description 怎么写（这是触发的灵魂）

SKILL.md 的 frontmatter 里 `description` 字段决定了 **AI 什么时候会调用这个 Skill**。写得太窄 → 漏触发；写得太宽 → 误触发。

### description 设计原则

1. **覆盖多个"用户原话"模式**——用户不会说"我要做 figma-to-nextjs migration"，他们会说：
   - "帮我把 Figma Make 的项目搬到 Next.js"
   - "这个 Vite 项目跑不了流式 API"
   - "我用 Figma Make 做了个前端，现在想接后端"
   - "把这个项目换成 Next.js App Router"
   - "v0.dev 出的代码怎么改成能部署的"

2. **列出关键触发词**——把上面这些原话的高频词都塞进 description：
   - 产品名：`Figma Make` / `v0.dev` / `Bolt` / `Lovable`
   - 技术栈：`Vite` / `React Router` / `Next.js` / `App Router`
   - 动作词：`迁移` / `搬家` / `搬运` / `改造` / `换成` / `migrate` / `port`
   - 场景词：`流式 API` / `服务端组件` / `部署`（这些是触发搬家的典型上下文）

3. **说清楚"能做什么"**——让 AI 判断是否匹配当前任务
4. **说清楚"不做什么"**——避免被误用到不相关的迁移（比如 Next.js → Remix）

### description 范例（给 skill-creator 参考）

```yaml
---
name: figma-to-nextjs-migration
description: >
  把 Figma Make / v0.dev / Bolt / Lovable 等 UI 原型生成器产出的 Vite + React Router
  项目，搬家到 Next.js 15 App Router 脚手架。处理路由迁移（react-router → next/navigation）、
  样式系统合并（globals.css + theme.css）、字体切换（@import → next/font/google）、
  客户端组件标注（"use client"）、Hydration mismatch 修复、shadcn/ui 组件库复用。
  典型触发场景：用户说"把 Figma Make 项目换成 Next.js"、"Vite 项目跑不了流式 API"、
  "v0.dev 出的代码怎么部署"、"React Router 搬家到 App Router"。
  不处理 Next.js → Remix 或其他反向迁移。
---
```

> **注意**：skill-creator 会帮你打磨这段 description，但**方向要由你定**。上面这段是给它的"初稿锚点"。

## 2.4 SKILL.md body 的核心内容（给 skill-creator 的蓝图）

body 是 AI 读完 frontmatter 后看到的"工作指令"，500 行以内。建议结构：

```markdown
# figma-to-nextjs-migration — UI 原型到生产脚手架的工程化迁移

## 触发条件
（重复 description 的要点，告诉 AI 在什么对话里加载这个 Skill）

## 核心心智模型
Figma Make/v0.dev 是"UI 原型生成器"，不是"脚手架生成器"。
产出代码的定位是设计参考，不是生产起点。
搬家不是返工，是工程化必经之路。
（这段话的来源是 prep-migration.md §1.1-1.4）

## 工作流（8 步）
Step 1: 备份 → 运行 scripts/backup.sh
Step 2: 起 Next.js 脚手架 → 运行 scripts/create-next-scaffold.sh
        ↑ 注意：脚手架会**预装** src/app/{page,layout,globals.css} 三个默认文件，
        后续 Step 3/5/6 是**覆盖**它们，不是新建
Step 3: 合并样式系统（**覆盖** 脚手架预装的 src/app/globals.css）
        → 参考 templates/globals-css-template.css
Step 4: 复制 shadcn/ui 组件 → 路径 @/components/ui/*
Step 5: 重构 layout.tsx（**覆盖** 脚手架预装的 src/app/layout.tsx）
        → 参考 templates/next-layout-template.tsx
Step 6: 搬 7 个页面，其中 Landing → **覆盖** src/app/page.tsx（脚手架预装）
        其余 6 页落到新路由目录。查表 @references/rr-to-next-mapping.md
Step 7: 批量替换 react-router + 修 use client + 修 Hydration
        → 详见 @references/migration-steps.md §7
Step 8: **固化基线** → 运行 scripts/commit-baseline.sh
        （`git add -A && git commit -m "migration complete"`——没这一步，
        一条 `git reset --hard HEAD` 就会把 Step 3/5/6 对脚手架预装文件的
        覆盖全部打回默认，首页变 Next.js 欢迎页，样式丢 token，见反模式 #5）

## 关键决策规则
- 哪些页面要标 "use client"？→ @references/use-client-rules.md
- 遇到 Hydration mismatch 怎么办？→ @references/hydration-fixes.md
- Gallery 里 Math.random() 怎么处理？→ 改成 seededRandom(42)
- 发现 Landing 页还是 Next.js 欢迎页？→ Step 6 漏覆盖 page.tsx，或 Step 8 没 commit

## 验收标准
- pnpm dev 能启动，7 个路由都能访问
- **首页 `/` 显示的是 Figma Make 的 Landing，不是 Next.js "Welcome" 欢迎页**（这是最容易被忽略的验收点）
- 无 Hydration warning（控制台干净）
- Lighthouse 跑一下无严重报错
- 运行 scripts/verify.sh 全绿
- `git log --oneline` 有一条 "migration complete" commit（Step 8 落地凭证）

## 反模式（AI 要主动规避）
- ❌ 不要在 Vite 项目上直接加 Next.js 依赖硬改——要起新项目
- ❌ 不要把 @import Google Fonts 留在 globals.css——Next.js 有 next/font
- ❌ 不要在 Server Component 里用 useState——必须标 "use client"
- ❌ 不要把 Figma Make 的 path alias ~/ 照搬——统一改成 @/
- ❌ **不要跳过 Step 8 的 git commit**——create-next-app 自动初始化了 git 仓库（commit 是 "Initial commit from Create Next App"），你对 `src/app/page.tsx` / `layout.tsx` / `globals.css` 的修改目前还在 working tree。不 commit 这些修改就做任何 `git reset --hard` = 修改被抹、搬家被吞。
```

> 具体每段的文字细节**不用我在这里定死**——交给 skill-creator 和在新窗口里对话打磨。

---

# 第三部分：Skill 内容的"原料产地"

skill-creator 在新窗口里要"从哪里抓内容"填进 references、templates、scripts？答案是**本课程现有的三份资料**：

| 目标文件 | 原料来源 | 抽取动作 |
|---------|---------|---------|
| `references/migration-steps.md` | `prep-migration.md` §3.1-3.7（7 步完整流程） | 复制 + 精简叙事口吻，留技术要点 |
| `references/rr-to-next-mapping.md` | `prep-migration.md` §2.2（核心技术对应表） | 直接复制表格 |
| `references/use-client-rules.md` | `prep-migration.md` §2.3（客户端组件标记） | 直接复制 + 补几个边界 case |
| `references/hydration-fixes.md` | `prep-migration.md` §3.7（Step 7 的 seededRandom 修复） | 抽出来独立成文 |
| `references/common-errors.md` | `prep-migration.md` §3.7 错误表 + §6 用户 FAQ | 合并 |
| `templates/next-layout-template.tsx` | `prep-migration.md` §3.5（Step 5 的 layout.tsx 代码） | 直接 copy |
| `templates/next-fonts-template.ts` | `prep-migration.md` §3.2（next/font/google 示范） | 抽出独立文件 |
| `templates/globals-css-template.css` | `prep-migration.md` §3.2（合并后的 globals.css） | 抽出独立文件 |
| `scripts/backup.sh` | `prep-migration.md` §3.1（`cp -r Start\ 用户 Start\ 用户.backup-xxx`） | 改成带时间戳的 shell |
| `scripts/commit-baseline.sh` | `prep-migration.md` §3.7.5 "固化基线"（git add -A + commit） | 写成 `#!/usr/bin/env bash`，先 `git add -A`，若工作树非空再 `git commit -m "migration complete"`；先 `git rev-parse` 检测仓库已存在再做 |
| `scripts/create-next-scaffold.sh` | `prep-migration.md` §3.1.2（pnpm create next-app 完整命令行） | 直接改成 shell |
| `scripts/verify.sh` | `prep-migration.md` §5（最终验证清单） | 翻译成 bash 自动化 |
| `examples/agenthub-migration-log.md` | 整份 `prep-migration.md` 压缩版 | 精简到 200 行以内，当做成功案例 |

**这张表就是 skill-creator 的"物料清单"**——在新窗口对话时，把这张表贴给它，它就知道从哪抓什么。

---

# 第四部分 ⭐⭐⭐：放到新窗口里跑的自然语言提示词

这是本文件的**核心交付物**。操作流程：

1. 新开一个终端窗口
2. `cd /Users/muyu/MuyuWorkSpace/FF-JiuTianForge`
3. 启动一个新的 Claude Code：`claude`（或用 teacher-vb 等角色也可以，关键是普通窗口）
4. **把下面整段 Prompt A 复制进去**，等 Claude Code 响应
5. 按 Claude Code 的追问一步步回答
6. 中途它可能会问要不要用 skill-creator，直接说"是，用 skill-creator 走完整流程"
7. 全部做完后回到本文件走第五部分的验证清单

## 4.1 Prompt A：启动会话 + 让 skill-creator 接手（整段复制）

> **复制粘贴进新的 Claude Code 窗口**：

````markdown
我需要你帮我创建一个 Claude Code Skill。请优先使用 **skill-creator 插件** 来引导整个生成流程——我知道它提供了完整的 Skill 编写规范、评估框架和描述优化流程。请在开始工作前先确认 skill-creator 是否已安装/可用，如果不可用就告诉我怎么装。

## 我要造的 Skill

**名字**：`figma-to-nextjs-migration`
**存放位置**：`.claude/skills/figma-to-nextjs-migration/`（项目级，不进全局 skills 目录）

## 这个 Skill 要解决什么问题（一句话）

把 Figma Make / v0.dev / Bolt / Lovable 等 UI 原型生成器产出的 Vite + React Router 项目，搬家到 Next.js 15 App Router 脚手架，同时正确处理：路由迁移、样式合并、字体切换、"use client" 标注、Hydration mismatch 修复、shadcn/ui 复用。

## 核心原料（Skill 的内容都从这两份文档里抽）

- 完整搬家流程：`courses/vibe-coding-speckit/writing-plans/part1-02-agenthub-prep-migration.md`（1000+ 行，第三部分是 7 步详细操作）
- 架构规划（就是我现在和你对话的蓝图）：`courses/vibe-coding-speckit/writing-plans/part1-02-agenthub-skills-forge.md`

**请先把 skills-forge.md 完整读一遍**——它的第二部分有完整的目录结构设计，第三部分有"物料清单"告诉你每个文件从 prep-migration.md 的哪一节抽。**你不用自己发明内容**，按清单抽取即可。

## 我希望你按以下顺序工作

**Phase 1：准备**
1. 读 `skills-forge.md` 全文（特别是第二部分"架构设计"和第三部分"原料产地"）
2. 读 `prep-migration.md` 全文（搬家的真实内容在这里）
3. 确认 skill-creator 插件可用，加载它的规范
4. 列一个详细的 TODO 清单给我看（我要知道你接下来要写哪些文件）

**Phase 2：构建 SKILL.md**
5. 先写 frontmatter 的 `description`——这是触发的灵魂，skill-creator 的描述优化流程必须用上
6. 写完 description 先给我 review，**我说 OK 你再写 body**
7. body 控制在 500 行以内，包含：触发条件 / 心智模型 / 7 步工作流 / 关键决策规则 / 验收标准 / 反模式
8. body 里该 `@references/xxx.md` 的地方用 `@` 引用，不要把 references 的内容复制进来

**Phase 3：生成 references/（5 个文件）**
9. 按 skills-forge.md 第三部分"原料产地"表格，从 prep-migration.md 抽取内容
10. 每个 reference 文件自包含（不依赖其他 reference），但可以相互 `@` 引用
11. 每个文件写完立即保存，不要积攒

**Phase 4：生成 templates/（4 个文件）**
12. 从 prep-migration.md 抽代码块，每个 template 就是一段可直接 copy 的完整代码
13. 在每个 template 文件顶部用注释写清楚"这段代码放在哪里、替代什么"

**Phase 5：生成 scripts/（3 个 bash 脚本）**
14. 每个脚本可直接执行，带 `#!/usr/bin/env bash` 和 `set -e`
15. 生成后 `chmod +x`
16. 脚本里的路径用相对路径或环境变量，不要硬编码 `/Users/muyu/...`

**Phase 6：生成 examples/agenthub-migration-log.md**
17. 把 prep-migration.md 压缩成 200 行以内的"成功案例"叙事

**Phase 7：自测 + 交付**
18. 用 skill-creator 的评估框架跑一遍自评
19. 按以下清单自测：
    - SKILL.md frontmatter 的 description 是否覆盖 "Figma Make" / "v0.dev" / "Vite" / "React Router" / "搬家" / "migrate" / "Next.js" / "App Router" / "流式 API" 等关键触发词
    - SKILL.md body 是否 ≤ 500 行
    - references 每个文件是否自包含
    - templates 每个代码块是否完整可 copy
    - scripts 每个是否可执行（`bash -n` 语法检查通过）
    - 目录结构是否完全对齐 skills-forge.md §2.2
20. 最后输出一段话告诉我：
    - 创建了哪些文件
    - 文件总大小
    - 用什么样的一句话可以触发这个 Skill
    - 我如何验证 Skill 工作正常（给我一个最小测试对话）

## 重要约束

- **严禁跳过 skill-creator**——如果它不可用，先帮我装，装不上就停下来问我
- **严禁自己发明 Skill 内容**——内容全部从 prep-migration.md 来
- **严禁写成通用 Next.js 教程**——这个 Skill 专门做迁移，不教 Next.js 入门
- **严禁硬编码我本机路径**——所有脚本用 `$PWD` 或相对路径
- **Phase 间必须停下来等我确认**（至少 Phase 1、Phase 2 的 description 这两个节点要给我 review）

## 开始工作前请先回答我

1. skill-creator 是否可用？
2. 读完两份 md 后，你对这个 Skill 的理解是什么？（用你自己的话讲一遍）
3. Phase 1 的 TODO 清单是什么？

确认无误我说"开始"你再进入 Phase 2。
````

## 4.2 Prompt B：description 阶段 review（等 Claude Code 给出 description 初稿后用）

如果第一版 description 不够好，用这段追问：

````markdown
这版 description 有两个问题我想你再打磨：

1. **覆盖面**：请在 description 里明确提到以下场景触发词（至少覆盖 80%）：
   - 工具名：Figma Make、v0.dev、Bolt、Lovable
   - 技术栈：Vite、React Router（v6/v7 都算）、Next.js 15、App Router
   - 动作词：搬家、迁移、搬运、换成、改造、migrate、port
   - 场景词：流式 API、服务端组件、Edge Runtime、部署
   - 反面否定："不处理 Next.js → Remix 的迁移"要写进去（避免误触发）

2. **skill-creator 的 description 优化流程**：请把你用它跑出来的"触发场景测试对话"也贴给我看——比如用户说 "v0.dev 出的代码怎么部署" 这句话，你的 Skill 会不会被匹配上？给我跑 5-8 个边界 case 看看命中率。

跑完这两步，再给我一版 description。
````

## 4.3 Prompt C：有问题的时候的纠偏（按需使用）

如果中途它偏离了：

````markdown
暂停。你现在偏离了 skills-forge.md §2.2 的目录结构设计——[具体说问题]。

请回到 skills-forge.md §2.2 重新对齐，把 [有问题的文件] 重新生成。其他已经生成的文件不动。
````

---

# 第五部分：skill-creator 跑完之后的验证清单

新窗口的 Claude Code 声称"全部完成"之后，**不要立刻相信**，回到主窗口（或另起一个终端）走以下检查：

## 5.1 文件结构验证

```bash
# 1. 目录和必要文件都在？
tree .claude/skills/figma-to-nextjs-migration/

# 预期输出（对齐 §2.2）：
# .claude/skills/figma-to-nextjs-migration/
# ├── SKILL.md
# ├── references/
# │   ├── migration-steps.md
# │   ├── rr-to-next-mapping.md
# │   ├── use-client-rules.md
# │   ├── hydration-fixes.md
# │   └── common-errors.md
# ├── templates/
# │   ├── next-layout-template.tsx
# │   ├── not-found-template.tsx
# │   ├── next-fonts-template.ts
# │   └── globals-css-template.css
# ├── scripts/
# │   ├── backup.sh
# │   ├── create-next-scaffold.sh
# │   └── verify.sh
# └── examples/
#     └── agenthub-migration-log.md
```

## 5.2 SKILL.md 质量检查

- [ ] frontmatter 的 `name` 是 `figma-to-nextjs-migration`
- [ ] `description` 覆盖 ≥ 8 个关键触发词（参照 §2.3）
- [ ] body 总行数 ≤ 500
- [ ] body 中 `@references/xxx` 引用数量 ≥ 3 个（证明启用了渐进加载）
- [ ] 没有把任何一个 reference 的全文塞进 body

## 5.3 scripts 可执行性检查

```bash
cd .claude/skills/figma-to-nextjs-migration/scripts
bash -n backup.sh && echo "backup.sh 语法OK"
bash -n create-next-scaffold.sh && echo "scaffold.sh 语法OK"
bash -n verify.sh && echo "verify.sh 语法OK"

# 检查可执行权限
ls -l *.sh | grep "x"  # 应看到三个脚本都有 x 权限
```

## 5.4 **触发测试**（最关键的一步）

**新开一个 Claude Code 窗口**（不用 skill-creator 那个脏了的会话），说这五句话里任选一句：

| # | 测试句子 | 预期行为 |
|---|---------|---------|
| 1 | "帮我把 Figma Make 做的项目换成 Next.js" | Skill 被识别、Claude 提议加载 |
| 2 | "v0.dev 出的代码怎么部署？" | Skill 被识别 |
| 3 | "我这个 Vite 项目想跑流式 API" | Skill 被识别 |
| 4 | "React Router 搬家到 App Router 怎么弄" | Skill 被识别 |
| 5 | "Next.js → Remix 怎么迁" | Skill **不应**被识别（反向测试）|

**5 句命中 ≥ 4 句、第 5 句不命中** = Skill 触发设计合格。

**如果命中率不足**：回到新窗口让 Claude Code 调 skill-creator 的 description 优化流程再跑一遍。

## 5.5 **端到端实跑**（可选但强烈建议）

找一个干净的临时目录：

```bash
mkdir -p /tmp/skill-test && cd /tmp/skill-test
# 假装有一个 Figma Make 出的项目
cp -r "/Users/muyu/MuYuCourseSpace/MyAgentHub/Start 用户.backup-XXXXXX" ./figma-make-output
claude  # 启动 Claude Code
```

然后在 Claude Code 里说：

````
我这个 /tmp/skill-test/figma-make-output 是 Figma Make 出的 Vite 项目，
帮我搬到 Next.js 15 App Router，生成一个叫 agenthub-test 的新项目。
````

**验收**：
- Claude 主动加载 `figma-to-nextjs-migration` Skill
- 按 7 步走完
- 最后 `cd agenthub-test && pnpm dev` 能跑起来
- 7 个路由都能访问
- 控制台无 Hydration warning

**跑通 = Skill 真正落地。**

---
