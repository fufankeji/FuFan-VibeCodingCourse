# Lesson 14: AlphaProject 上篇 · 深度调研 & 产品需求文档生成

<div align="center">

[English](./README.md) | 中文

</div>

AlphaProject 综合项目实战系列首讲 —— 智能投研（量化交易方向）。先打地基：完成行业调研、用户分析，并借助 AI 产出生产级 PRD。

## 主题

- 智能投研：行业全景与目标用户画像
- 量化交易领域建模与竞品分析
- AI 协同下的深度市场调研方法论
- 产品需求文档（PRD）—— 结构、深度与 AI 驱动生成

## 课程资料

- [12_AlphaProject 综合项目实战（上）.excalidraw](./CourseWare/12_AlphaProject%20综合项目实战（上）.excalidraw)

## 课程资产

支撑本节「调研 → PRD」工作流的技能、MCP 服务与编辑器配置 —— 完整索引详见 [`Assets/README_CN.md`](./Assets/README_CN.md)。

- **Skills**：`prd-writer`、`product-research-kickoff`、`speckit-design-injection`、`adversarial-architecture-selection`
- **MCP**：`muyu-search-mcp`（多源 Web 搜索）
- **Configs**：`claude-hud-config.json`

## 项目产出 —— [`AlphaProject/`](./AlphaProject/)

调研与 PRD 阶段的真实产出，由 Claude Code 直播现场生成。

- **[`specs/prd.md`](./AlphaProject/specs/prd.md)**：生产级产品需求文档
- **[`specs/research/`](./AlphaProject/specs/research/)**：6 篇调研笔记 —— 产品形态、数据来源、开源项目、实现方案、决策汇总、架构基线决策
- **[`specs/research/debate/`](./AlphaProject/specs/research/debate/)**：对抗式架构选型辩论 —— 立场陈述、红队攻击、拥护方回应、集成评估
- **`.claude/skills/`**：产出上述内容所用的技能（`product-research-kickoff`、`adversarial-architecture-selection`、`prd-writer`）
- **`.mcp.json`**：muyu-search MCP 接入配置 —— `MUYU_API_KEY` 已抹除，使用前请填入自己的 key

## 关于 `.excalidraw` 文件

`.excalidraw` 文件是**原始可编辑课件**，你可以根据需要进行修改和定制。

**打开方式：**

1. 访问 [https://excalidraw.com/](https://excalidraw.com/)（需要梯子）
2. 点击菜单图标 (☰) → **打开** (Ctrl+O)
3. 选择本地的 `.excalidraw` 文件

## 相关

- [← 返回阶段八目录](../README_CN.md)
