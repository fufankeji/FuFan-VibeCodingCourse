@AGENTS.md

## Active Technologies
- TypeScript (`tsx` transient runner via `pnpm dlx tsx`), Node.js ≥ 20 (native `fetch`) + Figma REST `GET /v1/files/:key/styles` + `GET /v1/files/:key/nodes?ids=...`; no new runtime deps (evolution)
- Filesystem only — reads `src/app/globals.css`, writes the same file in place (evolution)

## Recent Changes
- evolution: Added TypeScript (`tsx` transient runner via `pnpm dlx tsx`), Node.js ≥ 20 (native `fetch`) + Figma REST `GET /v1/files/:key/styles` + `GET /v1/files/:key/nodes?ids=...`; no new runtime deps
