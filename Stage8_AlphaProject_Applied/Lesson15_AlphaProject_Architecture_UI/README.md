# Lesson 15: AlphaProject Part 2 — Architecture Selection, UI Design & Claude Code Setup

<div align="center">

English | [中文](./README_CN.md)

</div>

The second session of the AlphaProject comprehensive practice. With research and the PRD locked in Part 1, move into engineering: select the full-stack architecture, design the frontend UI, and initialize the Claude Code development environment.

## Topics

- Frontend / backend tech-stack selection and trade-offs
- Frontend UI design for the Intelligent Investment Research platform
- Claude Code environment initialization and project configuration
- Bootstrapping `CLAUDE.md` and feature-driven development workflow

## Course Materials

- [12_AlphaProject 综合项目实战（中）.excalidraw](./CourseWare/12_AlphaProject%20综合项目实战（中）.excalidraw)

## Course Assets

Skills used in this lesson — see [`Assets/README.md`](./Assets/README.md) for the full index.

- **Skills**: `claude-md-bootstrap`, `run-feature`, `speckit-design-injection`

## Project Output — [`AlphaProject/`](./AlphaProject/)

The Part 2 snapshot of the live build — architecture baseline locked, Spec-Kit scaffolding installed, six features specced out, and UI design references exported.

- **[`.specify/`](./AlphaProject/.specify/)**: Spec-Kit installation — `memory/constitution.md`, workflow registry, templates (spec / plan / tasks / checklist / constitution / agent-file), bash scripts, Claude integration manifest
- **[`specs/001-watchlist-crud/`](./AlphaProject/specs/001-watchlist-crud/) → [`006-morning-briefing/`](./AlphaProject/specs/006-morning-briefing/)**: six end-to-end feature bundles, each with `spec.md`, `plan.md`, `tasks.md` (watchlist CRUD, Feishu push channel, watchlist dashboard, LLM anomaly explain, anomaly-detection push, morning briefing)
- **[`specs/design-reference/stitch-export/`](./AlphaProject/specs/design-reference/stitch-export/)**: UI design exports — multiple dashboard variants (screen PNGs + HTML code) plus `DESIGN.md`
- **[`specs/prd.md`](./AlphaProject/specs/prd.md)** + **[`specs/research/`](./AlphaProject/specs/research/)**: research and PRD carried over from Part 1
- **`.claude/skills/`**: full skill set used through Part 2 — including the Spec-Kit family (`speckit-checklist`, `speckit-constitution`, `speckit-implement`, `speckit-clarify`, `speckit-plan`, `speckit-taskstoissues`) plus `product-research-kickoff`
- **`.mcp.json`**: muyu-search MCP wiring — `MUYU_API_KEY` is redacted, fill in your own key before use

## About `.excalidraw` Files

The `.excalidraw` files are the **original editable courseware**. You can modify and customize them as needed.

**How to Open:**

1. Visit [https://excalidraw.com/](https://excalidraw.com/) (VPN required)
2. Click the menu icon (☰) → **Open** (Ctrl+O)
3. Select the `.excalidraw` file from your local drive

## Related

- [← Back to Stage 8](../README.md)
