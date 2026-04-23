# Lesson 11: Spec-Kit Advanced Practice

<div align="center">

English | [中文](./README_CN.md)

</div>

This lesson takes Spec-Kit into production-grade territory through a real Agent Hub project — from specification to a full-stack Next.js application driven by SDD methodology.

## Topics

- Spec-Kit advanced workflow in production
- Agent Hub project: end-to-end SDD implementation
- Next.js full-stack development with Spec-Kit
- MCP integration and agent orchestration

## Course Materials

- [09_Spec-Kit应用进阶.pptx](./CourseWare/09_Spec-Kit应用进阶.pptx)
- [09_Spec-Kit应用进阶.excalidraw](./CourseWare/09_Spec-Kit应用进阶.excalidraw)
- [09_Spec-Kit 应用进阶项目开发文档.excalidraw](./CourseWare/09_Spec-Kit%20应用进阶项目开发文档.excalidraw)

## Project Assets

- **[MyAgentHub](./MyAgentHub/)**: Agent Hub — full-stack Spec-Kit practice project
- Tech stack: `Next.js` `TypeScript` `React` `Tailwind CSS` `pnpm`
- Key directories:
  - [agenthub/](./MyAgentHub/agenthub/) — main Next.js application
  - [agenthub/.specify/](./MyAgentHub/agenthub/.specify/) — Spec-Kit specifications and workflow config
  - [agenthub/.claude/](./MyAgentHub/agenthub/.claude/) — Claude Code project configuration and skills
  - [agenthub/specs/](./MyAgentHub/agenthub/specs/) — feature specifications
  - [agenthub/docs/](./MyAgentHub/agenthub/docs/) — project documentation
  - [agenthub/src/](./MyAgentHub/agenthub/src/) — application source code
- Notes:
  - `.env.local` is not committed — copy `.env.example` and fill in your own API keys
  - `node_modules/`, `.next/`, `.git/` are excluded from the course repo

## About `.excalidraw` Files

The `.excalidraw` files are the **original editable courseware**. You can modify and customize them as needed.

**How to Open:**

1. Visit [https://excalidraw.com/](https://excalidraw.com/) (VPN required)
2. Click the menu icon (☰) → **Open** (Ctrl+O)
3. Select the `.excalidraw` file from your local drive

## Related

- [← Back to Stage 6](../README.md)
