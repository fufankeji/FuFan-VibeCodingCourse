# Frontend 结构性缺口 · 闭环登记

按 `testing-system-blueprint` 蓝本 + `frontend-testing` 五层结构。

## 本次（test/001-frontend-gaps）补齐

| ID | 缺口 | 层 | 风险 | 发布门 | 实例化 | 测试文件 | 状态 |
|---|---|---|:-:|:-:|---|---|:-:|
| G-F1 | 裸 hex/rgb/hsl 进 src/* + 第二 UI 库 import | ① lint 门 | **P0** | 🚫 阻断 | Vitest + fs+regex（栈本有 Vitest，零新依赖；等价 stylelint 思想） | `no_hardcoded_colors.test.ts` | ✅ |
| G-F2 | token 体系完整性 + 涨跌色（FD-3）+ 暗色默认（FD-7） | ② L2 单测 | **P0** | 🚫 阻断 | Vitest 解析 `src/index.css` @theme block，断言 bull/bear/surface RGB 范围 | `visual_tokens.test.ts` | ✅ |
| G-F3 | Watchlist 抽屉 a11y（aria/角色/可达性） | ③ a11y | P1 | ⚠️ 告警 | vitest-axe + axe-core（jsdom 兼容、无浏览器下载）+ 显式 aria 语义断言 | `a11y_watchlist.test.tsx` | ✅ |

### 计数差量
- 之前 FE：18 tests
- 现在 FE：**45 tests**（+27 = 2 lint + 18 token + 7 a11y）
- 翻译产物（"工具 ↔ 项目契约"）：
  - FD-3 红涨绿跌 → `--color-bull` RGB ∈ (R>200, G<130, B<130)、`--color-bear` RGB ∈ (R<130, G>180, B<150)
  - FD-7 暗色默认 → `--color-surface-base` RGB ∈ (<50, <50, <50)
  - FD-1 token 唯一真理 → 11 个 token 缺一不可
  - FD-4 不引第二 UI 库 → import 黑名单（antd / @mui / @chakra-ui）

## 推后（未本轮做，登记原因）

| ID | 缺口 | 层 | 推后理由 | 触发条件 |
|---|---|---|---|---|
| G-F4 | 跨浏览器 + 响应式（FD-8 移动端断点降级） | ③ | F5 抽屉无密集表，FD-8 主战场是 F1 dashboard 30+ 股表格；现在装 Playwright（200 MB 浏览器） ROI 低 | F1（003-watchlist-dashboard）收尾时由 `frontend-testing` 重启，一并立 Playwright 多视口 |
| G-F5 | 前后端契约 mock 升级到 MSW + OpenAPI 生成 | ④ | F5 sdk 才 10 端点，手 mock 已工作；MSW + openapi-typescript 的价值在多 feature 共享 handlers + 自动消漂移 | F1/F2/F4 任一落地（端点数翻倍）后启 |
| G-F6 | 视觉回归（截图 diff + 基线裁决人审） | ⑤ | F5 是单一抽屉，无密集视觉变化；视觉回归裁决需要稳定基线 + 多页面对照 | F1（dashboard）收尾后启；那时 Playwright 也已立（与 G-F4 复用基础设施） |

## 不命中

| ID | 缺口 | 原因 |
|---|---|---|
| G-Fx | 设计样本还原度 / 装饰克制 / 认知层级 / 整体质感 | 本质语义，无机器断言；走代码评审 / 设计走查（skill 明确标"不塞进自动化"） |
| G-Fy | jsdom 下 color-contrast 自动断言 | jsdom 无 Canvas，axe 自动 skip 该 rule；完整对比度扫描随 G-F4 一并 Playwright 启 |

## 自愈护栏遵守证据

- ✅ **不重新发明工具**：vitest-axe 装上即用；G-F1/F2 的 fs+regex 利用栈既有 Vitest 运行器
- ✅ **不改产品码**：本轮零产品文件改动（仅 `vitest.setup.ts` 加 matcher 注册 + canvas 警告抑制）
- ✅ **断言不可弱化**：G-F2 涨跌色断言用数值不等式（R>200/G<130），不写 `expect(token).toBeTruthy()`；G-F1 不为 allow-list 加豁免
- ✅ **禁伪造**：a11y 测试用真 axe 在真 DOM 上跑，不 mock 渲染本身
- ✅ **产 PR 人审**：分支保留 commits 等审

## 可追溯 ID 索引

每个 G-FX 测试模块顶部含：
- `风险级`
- `可追溯：F5 / 001-watchlist-crud / FD-X`

便于 CI 报告反查到 constitution FD 原则与 PRD FR。

## 触发后续 skill 的条件

- F1 (003-watchlist-dashboard) 收尾 → 立 Playwright + G-F4 + G-F6
- F1 / F2 / F4 任一收尾 → 启 MSW + G-F5（端点契约源生成）
