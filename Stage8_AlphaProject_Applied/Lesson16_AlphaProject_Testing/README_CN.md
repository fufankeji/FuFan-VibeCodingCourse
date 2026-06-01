# Lesson 16: AlphaProject 下篇 · 全栈测试体系

<div align="center">

[English](./README.md) | 中文

</div>

AlphaProject 综合项目实战收官讲。中篇把平台端到端搭起来后，下篇负责把它打磨稳定 —— 自底向上、按层做测试：后端单测、前端交互、全链路用户旅程。

## 主题

- AI 驱动全栈项目的测试金字塔
- 后端 / 前端 / 全栈切片 / 全链路四层测试体系
- 测试路由策略：什么场景写什么测试
- 可随代码库一起扩展的测试体系蓝图
- 特性驱动开发 × 测试闭环 —— 用 `run-feature` 收口

## 课程资料

- [12_AlphaProject 综合项目实战（下）.excalidraw](./CourseWare/12_AlphaProject%20综合项目实战（下）.excalidraw)

## 课程资产

7 个 Claude Code 技能覆盖测试策略与特性工作流 —— 完整索引详见 [`Assets/README_CN.md`](./Assets/README_CN.md)。

- **策略与路由**：`testing-system-blueprint`、`test-routing-advisor`
- **分层测试**：`backend-testing`、`frontend-testing`、`fullstack-slice-testing`、`full-chain-testing`
- **特性工作流**：`run-feature`

## 项目产出 —— [`AlphaProject/`](./AlphaProject/)

AlphaProject 最终快照 —— 6 大功能由 Claude Code 全程端到端构建的后端、前端、测试全部就位。

- **[`backend/`](./AlphaProject/backend/)**：Python 服务 —— `app/`（FastAPI 应用）、`tests/`（覆盖异动检测、调度器、模型、API 的大量 pytest 用例）、`pyproject.toml`、`uv.lock`
- **[`frontend/`](./AlphaProject/frontend/)**：Vite + TypeScript 应用 —— `src/`、`vite.config.ts`、`vitest.setup.ts`、pnpm/npm 锁文件
- **[`specs/001-watchlist-crud/`](./AlphaProject/specs/001-watchlist-crud/) → [`006-morning-briefing/`](./AlphaProject/specs/006-morning-briefing/)**：从中篇延续的 6 个功能包（spec / plan / tasks）
- **[`.specify/`](./AlphaProject/.specify/)**：Spec-Kit 安装目录（memory、workflows、templates、scripts）
- **[`.claude/skills/`](./AlphaProject/.claude/skills/)**：三讲贯穿的完整技能集 —— 调研、PRD、架构、设计注入、Spec-Kit 全家桶、测试分层
- **[`docs/screenshots/`](./AlphaProject/docs/screenshots/)** + **[`scripts/`](./AlphaProject/scripts/)**：项目文档资料与辅助脚本
- **`.mcp.json`**：muyu-search MCP 接入配置 —— `MUYU_API_KEY` 已抹除，使用前请填入自己的 key
- **`.env.example`** + **`.gitignore`** + **`CLAUDE.md`** + **`README.md`**：项目引导文件（真实 `.env` 已排除）

## 关于 `.excalidraw` 文件

`.excalidraw` 文件是**原始可编辑课件**，你可以根据需要进行修改和定制。

**打开方式：**

1. 访问 [https://excalidraw.com/](https://excalidraw.com/)（需要梯子）
2. 点击菜单图标 (☰) → **打开** (Ctrl+O)
3. 选择本地的 `.excalidraw` 文件

## 相关

- [← 返回阶段八目录](../README_CN.md)
