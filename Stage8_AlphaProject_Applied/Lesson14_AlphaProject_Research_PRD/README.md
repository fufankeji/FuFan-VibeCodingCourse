# Lesson 14: AlphaProject Part 1 — Deep Market Research & PRD Generation

<div align="center">

English | [中文](./README_CN.md)

</div>

The first session of the AlphaProject comprehensive practice — Intelligent Investment Research (quantitative-trading focus). Build the foundation: market research, user analysis, and a production-grade PRD generated with AI assistance.

## Topics

- Intelligent investment research: industry landscape and target users
- Quantitative-trading domain modeling and competitor analysis
- Deep market research methodology with AI assistance
- Product Requirements Document (PRD) — structure, depth, and AI-driven generation

## Course Materials

- [12_AlphaProject 综合项目实战（上）.excalidraw](./CourseWare/12_AlphaProject%20综合项目实战（上）.excalidraw)

## Course Assets

Skills, MCP server, and editor configs that power the research-to-PRD workflow used in this lesson — see [`Assets/README.md`](./Assets/README.md) for the full index.

- **Skills**: `prd-writer`, `product-research-kickoff`, `speckit-design-injection`, `adversarial-architecture-selection`
- **MCP**: `muyu-search-mcp` (multi-provider web search)
- **Configs**: `claude-hud-config.json`

## Project Output — [`AlphaProject/`](./AlphaProject/)

The research-and-PRD phase output, generated live with Claude Code.

- **[`specs/prd.md`](./AlphaProject/specs/prd.md)**: production-grade Product Requirements Document
- **[`specs/research/`](./AlphaProject/specs/research/)**: 6 research notes — product form, data sources, open-source survey, implementation options, decision summary, architecture baseline
- **[`specs/research/debate/`](./AlphaProject/specs/research/debate/)**: adversarial architecture-selection debate — position papers, red-team attacks, advocate responses, integration assessment
- **`.claude/skills/`**: the skills used to produce the above (`product-research-kickoff`, `adversarial-architecture-selection`, `prd-writer`)
- **`.mcp.json`**: muyu-search MCP wiring — `MUYU_API_KEY` is redacted, fill in your own key before use

## About `.excalidraw` Files

The `.excalidraw` files are the **original editable courseware**. You can modify and customize them as needed.

**How to Open:**

1. Visit [https://excalidraw.com/](https://excalidraw.com/) (VPN required)
2. Click the menu icon (☰) → **Open** (Ctrl+O)
3. Select the `.excalidraw` file from your local drive

## Related

- [← Back to Stage 8](../README.md)
