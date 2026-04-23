# Implementation Plan: Landing Hero 动态粒子背景

**Branch**: `evolution`（复用，不新建 feature 分支）
**Date**: 2026-04-20
**Spec**: [spec.md](./spec.md)

## Summary

在 Landing 页 Hero section 背后新增一层 canvas 粒子动画，用原生 Canvas 2D API 实现、零新依赖、响应 `prefers-reduced-motion`。只新建 1 个客户端组件，只改 `src/app/page.tsx` 的 Hero section 容器（加 `overflow-hidden` + 插入组件 + 内容包 `relative z-10`）。其余文件零改动。

## Technical Context

- **Language/Version**: TypeScript 5.x（项目已使用）
- **Primary Dependencies**: React 19 + Next.js 15 App Router（均为项目已有，**不新增**）
- **Storage**: N/A（纯视觉层）
- **Testing**: 手动视觉验证（浏览器 + DevTools mobile emulation + macOS reduce-motion 开关）；本期不新增单测
- **Target Platform**: Chrome / Safari / Firefox / Edge 近两年版本
- **Project Type**: Web（Next.js 15 App Router）
- **Performance Goals**: 桌面稳定 60fps；标签页切走时暂停动画循环
- **Constraints**:
  - 新增 gzip 后 bundle ≤ 3KB
  - 零新 npm 依赖
  - 不改 @theme / globals.css / tailwind 配置
- **Scale/Scope**: 一个页面、一个 Hero section、一个新组件

## Constitution Check

> 对齐 `.specify/memory/constitution.md` 三法衣。

### 第一法衣 Spec-Kit 业务法衣

- ✅ Spec First：spec.md 已完成（含 User Story / Acceptance / Out of Scope）
- ✅ Plan Before Implement：本 plan.md 即此步骤
- ✅ Quality Gate：已完成 `/speckit-clarify`，后续走 `/speckit-checklist`
- ✅ 本期不跳过 analyze（可选步骤，由 plan 末尾 ship 前做一次轻量 diff 审视替代）

### 第二法衣 StyleSeed 视觉法衣

| 红线 | 本功能对齐方式 |
|------|----------------|
| 颜色走 @theme，禁 hardcoded hex | 粒子色从 `getComputedStyle(document.documentElement).getPropertyValue('--color-primary-default')` 读取，运行时 alpha 乘系数；源码里不写 `#xxx` |
| 4px 间距阶梯 | 组件为 canvas 绝对定位，不涉及 padding/margin（inset-0 全覆盖）；Hero 内部间距不改 |
| 交互 5 态 | N/A（纯装饰，不可交互，pointer-events: none） |
| lucide 图标 | N/A（不含图标） |

### 第三法衣 Figma Variables 设计法衣

- ✅ 色值来自 `--color-primary-default`（对应 Figma 的 `color.primary.default`）
- ✅ 不引入新的值语义命名
- ✅ 无需改 Figma Variables

**Gate 结论**：三法衣全部通过，无需 Complexity Tracking 段。

## Technology Choice (Phase 0 Research)

三套可行方案对比：

| 方案 | bundle 增量 | 新依赖 | 可控性 | 性能 | 学习成本 | 结论 |
|------|-------------|--------|--------|------|----------|------|
| **A. 原生 Canvas 2D API 自己写** | ≈ 1.5KB（gzip） | 0 | 高（逐行可读） | 60 颗粒子 60fps 无压力 | 低 | **✅ 推荐** |
| B. tsparticles | ≈ 35KB（gzip，含 engine） | +1 | 中（配置式） | 高 | 中（需学 options schema） | ❌ 超预算 + 违反零依赖 |
| C. react-tsparticles | ≈ 38KB（gzip，含 React wrapper） | +2 | 中 | 高 | 中 | ❌ 同上，更重 |

**决策**：选 A。60 颗粒子 + 漂浮逻辑不超过 80 行代码，完全可控，零风险引入。

## Project Structure

### Documentation (this feature)

```text
specs/004-particle-bg/
├── spec.md              # ✅ /speckit-specify 产出
├── plan.md              # ✅ 当前文件
├── tasks.md             # ⏭ /speckit-tasks 待产出
├── checklist.md         # ⏭ /speckit-checklist 待产出
└── checklists/
    └── requirements.md  # ✅ spec 质量清单
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── page.tsx              # ✏️ 仅改 Hero section 容器（3 处微改）
│   ├── layout.tsx            # 🔒 不动
│   ├── globals.css           # 🔒 不动
│   └── …                      # 🔒 其余 app/ 子目录全部不动
├── components/
│   ├── particle-background.tsx   # ➕ 新建（client component）
│   ├── ui/                    # 🔒 shadcn 组件不动
│   └── figma/                 # 🔒 不动
└── lib/                       # 🔒 不动
```

**Structure Decision**：沿用现有 Next.js 15 App Router 结构。粒子组件放 `src/components/` 顶层（与 shadcn ui 子目录并列，表示"自研通用组件"），不放进 `ui/` 以免污染 shadcn 空间。

## 文件影响面清单（权威）

### 新建（1）

| 路径 | 类型 | 预估 LOC |
|------|------|----------|
| `src/components/particle-background.tsx` | 客户端 React 组件 | 80–100 |

### 修改（1，仅 Hero section 三处微改）

| 路径 | 修改内容 | 预估改动行数 |
|------|----------|--------------|
| `src/app/page.tsx` | (a) 顶部新增 `import { ParticleBackground }`；(b) Hero `<section>` 加 `overflow-hidden` class；(c) Hero 开头插 `<ParticleBackground />`；(d) Hero 现有子元素包一层 `<div className="relative z-10 flex flex-col items-center">` | +6 / -0（仅加不删） |

## Brownfield 安全承诺（不会动的文件）

> 本清单是对 spec Out of Scope 段的落地版。以下文件**在本 feature 中 diff 必须为 0**：

1. `src/app/page.tsx` 中"精选 Agent"section（line 39–84）— 一字不动
2. `src/app/page.tsx` 中"ValueProps"section（line 87–119）— 一字不动
3. `src/app/page.tsx` 中"Stats"section（line 122–141）— 一字不动
4. `src/app/layout.tsx` — 不动
5. `src/app/globals.css`（含 @theme / @layer base） — 不动
6. `src/app/not-found.tsx` — 不动
7. `src/app/api/` 目录所有文件 — 不动
8. `src/app/agent/`、`src/app/gallery/`、`src/app/pipeline/`、`src/app/playground` 相关、`src/app/pricing/`、`src/app/runs/`、`src/app/settings/` — 全部不动
9. `src/components/ui/` 下全部 shadcn 组件 — 不动
10. `src/components/figma/` 目录 — 不动
11. `src/lib/` 下全部文件（包含 mock-data、utils） — 不动
12. `.specify/memory/constitution.md` — 不动
13. `package.json` / `pnpm-lock.yaml` — 不动（零新依赖）
14. `next.config.js` / `tsconfig.json` / `tailwind.config.*` — 不动
15. `.styleseed/rules.md` — 不动

## 实现大纲（Phase 2 前的技术预设）

`src/components/particle-background.tsx` 关键逻辑：

- 顶部 `"use client"` 指令
- `useRef<HTMLCanvasElement>` 持有 canvas 节点
- `useEffect` 中：
  1. 读 `window.matchMedia('(prefers-reduced-motion: reduce)').matches` → 命中则直接渲染一次静态渐变（CSS `radial-gradient` 背景已由 React className 提供，canvas 不启动），`return` 提前退出
  2. 读 `window.innerWidth < 768 ? 20 : 60` 决定粒子数
  3. 初始化粒子数组 `{x, y, vx, vy, r, alpha}`
  4. `requestAnimationFrame` 循环：清屏 → 逐粒更新 x/y（边界反弹或穿越回绕） → `ctx.fillStyle = 'hsla(220, 90%, 60%, ' + alpha + ')'` — **不对**，为避免硬编码，实际从 `getComputedStyle(document.documentElement).getPropertyValue('--color-primary-default')` 取 hsl 字符串并拼 alpha；若解析失败降级到 CSS var `rgba(var(...))` 的 `color-mix` 兜底
  5. `window.addEventListener('resize', …)` → 重算 canvas 尺寸 + DPR（devicePixelRatio）
  6. `document.visibilitychange` → 切走时 `cancelAnimationFrame`，切回时重启
  7. 清理：组件卸载时 cancelAnimationFrame + removeEventListener
- Canvas 样式：`absolute inset-0 pointer-events-none`
- Fallback 渐变：reduce-motion 命中时用 Tailwind `bg-[radial-gradient(...)]` 的 arbitrary value + @theme var（仍不硬编码）

## Performance Budget

| 指标 | 目标 | 验证方式 |
|------|------|----------|
| 粒子动画帧率（桌面） | ≥ 60fps | Chrome DevTools Performance tab |
| 粒子动画帧率（移动） | ≥ 50fps | DevTools mobile emulation |
| Bundle 新增 | ≤ 3KB（gzip） | `pnpm build` 后对比 chunk 变化 |
| Landing Lighthouse Performance | 回退 ≤ 3 分 | Lighthouse 跑两次对比 |
| 新增 npm 依赖 | 0 | `git diff package.json pnpm-lock.yaml` 必须为空 |

## Complexity Tracking

> 无宪法违规，本段空。
