# Lesson 16: AlphaProject Part 3 — Full-Stack Testing Strategy

<div align="center">

English | [中文](./README_CN.md)

</div>

The third and final session of the AlphaProject comprehensive practice. With the platform built end-to-end in Part 2, Part 3 hardens it: layer-by-layer testing — from backend units to frontend interactions to full-chain user journeys.

## Topics

- Testing pyramid for AI-driven full-stack projects
- Backend, frontend, fullstack-slice, and full-chain testing layers
- Test-routing strategy: when to write which kind of test
- Building a testing system blueprint that scales with the codebase
- Feature-driven dev × testing — closing the loop with `run-feature`

## Course Materials

- [12_AlphaProject 综合项目实战（下）.excalidraw](./CourseWare/12_AlphaProject%20综合项目实战（下）.excalidraw)

## Course Assets

Seven Claude Code skills covering the testing strategy and feature workflow — see [`Assets/README.md`](./Assets/README.md) for the full index.

- **Strategy & routing**: `testing-system-blueprint`, `test-routing-advisor`
- **Layered testing**: `backend-testing`, `frontend-testing`, `fullstack-slice-testing`, `full-chain-testing`
- **Feature workflow**: `run-feature`

## Project Output — [`AlphaProject/`](./AlphaProject/)

The final AlphaProject snapshot — backend, frontend, and tests for all six features built end-to-end with Claude Code.

- **[`backend/`](./AlphaProject/backend/)**: Python service — `app/` (FastAPI app), `tests/` (extensive pytest suites covering anomaly detection, scheduler, models, APIs), `pyproject.toml`, `uv.lock`
- **[`frontend/`](./AlphaProject/frontend/)**: Vite + TypeScript app — `src/`, `vite.config.ts`, `vitest.setup.ts`, pnpm/npm lockfiles
- **[`specs/001-watchlist-crud/`](./AlphaProject/specs/001-watchlist-crud/) → [`006-morning-briefing/`](./AlphaProject/specs/006-morning-briefing/)**: six feature bundles (spec / plan / tasks), carried through from Part 2
- **[`.specify/`](./AlphaProject/.specify/)**: Spec-Kit installation (memory, workflows, templates, scripts)
- **[`.claude/skills/`](./AlphaProject/.claude/skills/)**: full skill set used across the three parts — research, PRD, architecture, design injection, Spec-Kit family, testing layers
- **[`docs/screenshots/`](./AlphaProject/docs/screenshots/)** + **[`scripts/`](./AlphaProject/scripts/)**: project documentation assets and helper scripts
- **`.mcp.json`**: muyu-search MCP wiring — `MUYU_API_KEY` is redacted, fill in your own key before use
- **`.env.example`** + **`.gitignore`** + **`CLAUDE.md`** + **`README.md`**: project bootstrap files (real `.env` is excluded)

## About `.excalidraw` Files

The `.excalidraw` files are the **original editable courseware**. You can modify and customize them as needed.

**How to Open:**

1. Visit [https://excalidraw.com/](https://excalidraw.com/) (VPN required)
2. Click the menu icon (☰) → **Open** (Ctrl+O)
3. Select the `.excalidraw` file from your local drive

## Related

- [← Back to Stage 8](../README.md)
