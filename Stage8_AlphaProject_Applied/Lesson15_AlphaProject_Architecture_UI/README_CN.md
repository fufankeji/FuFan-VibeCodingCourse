# Lesson 15: AlphaProject 中篇 · 技术架构选型、UI 设计 & Claude Code 环境配置

<div align="center">

[English](./README.md) | 中文

</div>

AlphaProject 综合项目实战第二讲。上篇锁定调研与 PRD 后，本节进入工程化：完成前后端技术架构选型、前端 UI 设计，并初始化 Claude Code 开发环境。

## 主题

- 前后端技术栈选型与取舍
- 智能投研平台前端 UI 设计
- Claude Code 环境初始化与项目配置
- `CLAUDE.md` 引导生成与特性驱动开发工作流

## 课程资料

- [12_AlphaProject 综合项目实战（中）.excalidraw](./CourseWare/12_AlphaProject%20综合项目实战（中）.excalidraw)

## 课程资产

本节使用的技能 —— 完整索引详见 [`Assets/README_CN.md`](./Assets/README_CN.md)。

- **Skills**：`claude-md-bootstrap`、`run-feature`、`speckit-design-injection`

## 项目产出 —— [`AlphaProject/`](./AlphaProject/)

中篇直播的真实快照 —— 架构基线锁定、Spec-Kit 安装就绪、6 大功能完成规范化、UI 设计参考导出。

- **[`.specify/`](./AlphaProject/.specify/)**：Spec-Kit 安装目录 —— `memory/constitution.md`、工作流注册表、模板（spec / plan / tasks / checklist / constitution / agent-file）、bash 脚本、Claude 集成 manifest
- **[`specs/001-watchlist-crud/`](./AlphaProject/specs/001-watchlist-crud/) → [`006-morning-briefing/`](./AlphaProject/specs/006-morning-briefing/)**：6 个端到端功能包，每个含 `spec.md`、`plan.md`、`tasks.md`（自选股 CRUD、飞书推送通道、自选股看板、LLM 异动解读、异动检测推送、晨报）
- **[`specs/design-reference/stitch-export/`](./AlphaProject/specs/design-reference/stitch-export/)**：UI 设计导出 —— 多套看板原型（screen PNG + HTML 代码）+ `DESIGN.md`
- **[`specs/prd.md`](./AlphaProject/specs/prd.md)** + **[`specs/research/`](./AlphaProject/specs/research/)**：从上篇延续的调研与 PRD
- **`.claude/skills/`**：中篇用到的完整技能集 —— Spec-Kit 全家桶（`speckit-checklist`、`speckit-constitution`、`speckit-implement`、`speckit-clarify`、`speckit-plan`、`speckit-taskstoissues`）+ `product-research-kickoff`
- **`.mcp.json`**：muyu-search MCP 接入配置 —— `MUYU_API_KEY` 已抹除，使用前请填入自己的 key

## 关于 `.excalidraw` 文件

`.excalidraw` 文件是**原始可编辑课件**，你可以根据需要进行修改和定制。

**打开方式：**

1. 访问 [https://excalidraw.com/](https://excalidraw.com/)（需要梯子）
2. 点击菜单图标 (☰) → **打开** (Ctrl+O)
3. 选择本地的 `.excalidraw` 文件

## 相关

- [← 返回阶段八目录](../README_CN.md)
