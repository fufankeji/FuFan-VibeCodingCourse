# Lesson 11: Spec-Kit 应用进阶

<div align="center">

[English](./README.md) | 中文

</div>

本课将 Spec-Kit 推向生产级应用，通过真实的 Agent Hub 项目，体验从规范到完整 Next.js 全栈应用的 SDD 工程化落地。

## 主题

- Spec-Kit 生产级进阶工作流
- Agent Hub 项目：端到端 SDD 实战
- 基于 Spec-Kit 的 Next.js 全栈开发
- MCP 集成与 Agent 编排

## 课程资料

- [09_Spec-Kit应用进阶.pptx](./CourseWare/09_Spec-Kit应用进阶.pptx)
- [09_Spec-Kit应用进阶.excalidraw](./CourseWare/09_Spec-Kit应用进阶.excalidraw)
- [09_Spec-Kit 应用进阶项目开发文档.excalidraw](./CourseWare/09_Spec-Kit%20应用进阶项目开发文档.excalidraw)

## 实战项目

- **[MyAgentHub](./MyAgentHub/)**：Agent Hub —— Spec-Kit 全栈实战项目
- 技术栈：`Next.js` `TypeScript` `React` `Tailwind CSS` `pnpm`
- 关键目录：
  - [agenthub/](./MyAgentHub/agenthub/) —— 主 Next.js 应用
  - [agenthub/.specify/](./MyAgentHub/agenthub/.specify/) —— Spec-Kit 规范与工作流配置
  - [agenthub/.claude/](./MyAgentHub/agenthub/.claude/) —— Claude Code 项目配置与技能
  - [agenthub/specs/](./MyAgentHub/agenthub/specs/) —— 功能规范
  - [agenthub/docs/](./MyAgentHub/agenthub/docs/) —— 项目文档
  - [agenthub/src/](./MyAgentHub/agenthub/src/) —— 应用源代码
- 说明：
  - `.env.local` 未提交到仓库，请复制 `.env.example` 填入自己的 API Key
  - `node_modules/`、`.next/`、`.git/` 已从课程仓库中排除

## 关于 `.excalidraw` 文件

`.excalidraw` 文件是**原始可编辑课件**，你可以根据需要进行修改和定制。

**打开方式：**

1. 访问 [https://excalidraw.com/](https://excalidraw.com/)（需要梯子）
2. 点击菜单图标 (☰) → **打开** (Ctrl+O)
3. 选择本地的 `.excalidraw` 文件

## 相关

- [← 返回阶段六目录](../README_CN.md)
