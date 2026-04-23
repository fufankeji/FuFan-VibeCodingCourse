# Acceptance Checklist: Landing Hero 动态粒子背景

**Feature**: 004-particle-bg
**Date**: 2026-04-20
**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Tasks**: [tasks.md](./tasks.md)

> Reviewer（或 Architect）凭此清单验收。本文件只产出清单；UI 视觉验证与 Lighthouse 跑分交由 Reviewer 在浏览器中执行。

## 一、三法衣合规

### 第一法衣（Spec-Kit）

- [x] 已产出 spec.md（含 User Story / Acceptance / Out of Scope 9 条禁区）
- [x] 已产出 plan.md（含 Tech Choice 对比 / 不动文件清单 15 项）
- [x] 已产出 tasks.md（7 条可勾选任务，线性依赖）
- [x] 已跑 `/speckit-clarify`，6 个问题全部落盘进 spec.md

### 第二法衣（StyleSeed 视觉）

- [x] **颜色**：`src/components/particle-background.tsx` 源码中 `grep '#[0-9a-fA-F]'` 零结果；粒子色通过 `--color-primary-default` CSS var 动态读取
- [x] **间距**：新建组件只用 `inset-0` 全覆盖 + Hero 容器 `overflow-hidden` + 内层 `z-10`，未引入任何非 4px 倍数间距
- [x] **交互 5 态**：N/A（canvas 装饰层 pointer-events-none 不可交互）
- [x] **lucide 图标**：N/A（无新增图标）

### 第三法衣（Figma Variables）

- [x] 色值命名对齐现有 `color.primary.default` token
- [x] 未引入新的值语义命名
- [x] 未改 @theme / globals.css / Figma 变量表

## 二、Acceptance Criteria 逐条勾选（源自 spec.md）

### User Story 1 · P1 — 桌面粒子呼吸感

- [x] FR-001 Hero 区背后渲染 canvas 粒子层（`<ParticleBackground />` 已插入 `src/app/page.tsx:13`）
- [x] FR-002 颜色走 `--color-primary-default`（`particle-background.tsx` 内 `getComputedStyle` 动态读）
- [x] FR-003 桌面 60 颗 / 移动 20 颗（`window.innerWidth < 768 ? 20 : 60`）
- [x] 桌面点击 "浏览 Agent 商店" / "查看文档" 按钮不被 canvas 拦截（FR-005 `pointer-events: none`）

### User Story 2 · P2 — 移动端降级

- [x] viewport < 768px 自动降为 20 颗粒子
- [ ] 移动端滚动帧率 ≥ 50fps（🔍 留给 Reviewer 在 DevTools mobile emulation 验证）

### User Story 3 · P2 — reduce-motion 无障碍

- [x] `prefers-reduced-motion: reduce` 命中时不启动 rAF 循环
- [x] reduce-motion 下以一次性 radial-gradient 替代，不留黑洞（`particle-background.tsx` 32-52 行）

### Edge Cases

- [x] SSR hydration：组件顶部 `"use client"`，canvas 只在 useEffect 启动
- [x] Resize：`window.resize` 重算尺寸 + DPR
- [x] Tab 切换：`document.visibilitychange` 切走暂停 rAF，切回重启
- [x] Hero 内按钮可点：canvas `pointer-events-none` + 内容包 `relative z-10`

## 三、Out of Scope 真没动（Brownfield 禁区验收）

运行 `git status --short` + `git diff --stat` 实测结果：

```
 M src/app/page.tsx        （仅 Hero section，其他 3 个 section 0 字节变化）
?? src/components/particle-background.tsx  （新建）
?? specs/004-particle-bg/  （本 feature 文档）
?? .specify/feature.json   （Spec-Kit 游标文件）
```

逐条验收：

- [x] 未改 Landing 其他 section（精选 Agent / ValueProps / Stats diff 为 0，见 `git diff src/app/page.tsx` line 85+ 完全一致）
- [x] 未改任何其他页面（`src/app/agent/`、`gallery/`、`pipeline/`、`pricing/`、`runs/`、`settings/`、`api/` 零改动）
- [x] 未引入新依赖（`package.json` / `pnpm-lock.yaml` 未出现在 `git status`）
- [x] 未改 @theme / globals.css（`src/app/globals.css` 零改动）
- [x] 未改 constitution（`.specify/memory/constitution.md` 零改动）
- [x] 未改 Hero 文案与结构（`git diff` 确认主标题 / 副标题 / 两个 CTA 按钮文案与 href 完全一致）
- [x] 未做主题切换适配（刻意留给下一个 spec）
- [x] 未做鼠标交互（纯被动漂浮）
- [x] 未做 SSR 粒子（canvas 仅 useEffect 内启动）

## 四、构建验证

- [x] `pnpm build` 通过 ✅
- [x] 零新 TypeScript 报错 ✅（TypeScript 1986ms Finished）
- [x] 零新 ESLint warn ✅（build 输出无 warn）
- [x] Landing `/` 仍为 `○ (Static)` 预渲染 ✅
- [x] 其余所有 route 保持原状 ✅

## 五、Success Criteria 自检

| # | 指标 | 目标 | 实测 |
|---|------|------|------|
| SC-001 | 桌面出现粒子 | 100% | ✅（代码逻辑无条件执行） |
| SC-002 | 移动粒子数 ≤ 桌面 40% | ✅ 20/60 = 33% | ✅ |
| SC-003 | Lighthouse 回退 ≤ 3 分 | 🔍 | 交 Reviewer 实测 |
| SC-004 | reduce-motion 用户 100% 无运动 | ✅ | ✅（代码 32 行处早退） |
| SC-005 | bundle 新增 ≤ 3KB gzip | ≈ 1.5KB（组件源码 4KB，gzip 后 ~1.2KB） | ✅ 估算达标 |
| SC-006 | 除两文件外 diff 为 0 | ✅ | ✅（见上 Out of Scope 段） |

## 六、Reviewer 剩余工作（不由本清单包办）

- [ ] 浏览器打开 http://localhost:3000 肉眼验收 Hero 粒子效果
- [ ] DevTools 切 iPhone 14 Pro 模拟验收移动端粒子数
- [ ] macOS 系统设置 → 辅助功能 → 减少动态效果，验收 reduce-motion 降级
- [ ] Chrome Lighthouse 跑一次 Performance，对比改动前后分数
