## Context

当前页面结构为 `Navbar + HeroSection + ProjectSection`。新增的"关于我"区域将放在 ProjectSection 下方。`index.css` 已有 `section[id] { scroll-margin-top: 4rem }` 和 `scroll-behavior: smooth`，新 Section 自动受益。

## Goals / Non-Goals

**Goals:**

- 左右分栏布局展示照片和简介，移动端改为上下堆叠
- 品牌标签「赋范空间」作为视觉锚点
- 照片 lazy loading

**Non-Goals:**

- 不做联系我表单
- 不做时间线/履历展示

## Decisions

### 1. 布局方案：Flexbox 左右分栏

**选择**：`flex flex-col md:flex-row` — 移动端上下堆叠，桌面端左右分栏

**理由**：两个区块（照片 + 文字），Flexbox 比 Grid 更自然。

### 2. 照片处理

**选择**：`<img loading="lazy">` + `rounded-2xl` 圆角 + `aspect-square object-cover` 固定比例 + 灰色占位背景

**理由**：个人照片通常为正方形或近似正方形，`aspect-square` 保证一致性。初期可使用占位。

### 3. 品牌标签展示

**选择**：Section 底部居中的文字标签，使用较大字号 + 特殊色调作为视觉锚点

**理由**：「赋范空间」是品牌标识，需要突出但不喧宾夺主。

### 4. 组件结构

```
src/components/
└── AboutSection.tsx    # 单组件，包含照片 + 简介 + 品牌标签
```

**理由**：内容简单，无需拆分子组件。

### 5. Section 锚点

**选择**：`<section id="about">`

**理由**：Navbar 中「首页」对应 `#home`（Hero），后续可在 Navbar 添加「关于」链接指向 `#about`。但本次不修改 Navbar（不在 scope 内）。

## Risks / Trade-offs

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 无真实照片时视觉效果差 | 品牌感缺失 | 使用灰色占位 + alt 文字，后续替换 |
| 照片尺寸过大影响加载 | 性能 | `loading="lazy"` + 建议后续压缩图片 |
| 三段文字在小屏过长 | 滚动疲劳 | 保持每段简洁，2-3 行为宜 |
