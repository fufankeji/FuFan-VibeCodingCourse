# Tasks: Landing Hero 动态粒子背景

**Feature**: 004-particle-bg
**Branch**: evolution
**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

## Tasks

- [ ] **T1 · 新建组件骨架** — 创建 `src/components/particle-background.tsx`，含 `"use client"`、`useRef<HTMLCanvasElement>`、`useEffect` 空壳、`return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" aria-hidden="true" />`。此步仅占位，粒子逻辑留给 T3
- [ ] **T2 · 实现 reduce-motion 分支** — 在 useEffect 顶部检查 `window.matchMedia('(prefers-reduced-motion: reduce)').matches`，命中则给 canvas 以 CSS `radial-gradient` 替代背景（用 `bg-[radial-gradient(ellipse_at_top,var(--color-primary-default)/0.08,transparent_70%)]` 或等价内联 style 通过 var 读色），不启动 rAF 循环后 return。确保不硬编码任何 hex
- [ ] **T3 · 实现粒子漂浮核心** — 初始化粒子数组（桌面 60 / 移动 20，按 `window.innerWidth < 768` 分叉），每粒 `{x, y, vx, vy, r, alpha}` 随机。rAF 循环内：`ctx.clearRect` → 更新坐标（边界回绕） → 从 `getComputedStyle(document.documentElement).getPropertyValue('--color-primary-default')` 读 hsl 字符串并拼 alpha 绘制。DPR 适配：canvas `width = innerWidth * dpr` 同理 height，ctx.scale(dpr, dpr)
- [ ] **T4 · resize / visibility / 卸载清理** — 监听 `window.resize` 重算尺寸；监听 `document.visibilitychange` 切走时 `cancelAnimationFrame`、切回重启；`useEffect` return 中清理所有监听器和 rAF handle
- [ ] **T5 · 接入 Hero section** — 编辑 `src/app/page.tsx`：(a) 顶部 import ParticleBackground；(b) Hero `<section>` 现有 class 加 `overflow-hidden`；(c) 在 `<section>` 开头插入 `<ParticleBackground />`；(d) 将 Hero 现有的 Badge / h1 / p / CTA div / 说明文案整体包一层 `<div className="relative z-10 flex flex-col items-center">`。**不改任何既有文案、class、按钮 asChild / href**
- [ ] **T6 · 静态自检** — 肉眼 diff 确认：(a) 仅 `src/app/page.tsx` 和新建 `src/components/particle-background.tsx` 出现在 `git status`；(b) Hero 以外三个 section 0 字节变化；(c) 源码中 grep 不到硬编码 hex
- [ ] **T7 · 构建验证** — 运行 `pnpm build`，确保零报错 / 零新 warn；观察 `.next/static` 中 Landing 页 chunk 增量 ≤ 3KB（粗略估算）

## Dependency Graph

```
T1 → T2 → T3 → T4 → T5 → T6 → T7
```

（严格线性：T2 需要 T1 的 useEffect 存在；T3 需要 T2 的早退分支已就位；T5 需要 T1–T4 完成；T6/T7 在代码落地后）

## Parallelizable?

否。本 feature 体量极小（≈ 100 LOC），线性执行成本最低，且所有任务都操作同一个新文件 + 同一个既有文件，并行反而增加冲突风险。

## Acceptance Linkage

| Task | 对应 spec 验收 |
|------|----------------|
| T1 | Edge Cases · SSR hydration |
| T2 | User Story 3 · reduce-motion |
| T3 | User Story 1 · P1 粒子漂浮 + FR-002/003 |
| T4 | Edge Cases · resize / tab 切换 / 内存泄漏 |
| T5 | FR-005 pointer-events + FR-007 不改 Hero 文案 |
| T6 | SC-006 diff 边界 |
| T7 | SC-005 bundle ≤ 3KB + 性能预算 |
