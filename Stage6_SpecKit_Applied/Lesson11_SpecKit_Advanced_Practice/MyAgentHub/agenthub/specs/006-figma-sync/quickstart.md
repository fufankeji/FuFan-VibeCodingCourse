# Quickstart: Figma Color Token Sync

## Prerequisites

- Node.js ≥ 20 (for native `fetch`)
- `pnpm` in PATH
- A Figma personal access token with read access to file `96ECPnljhnFrOMesWfd3d2`

## One-time setup

Export the token for the current shell, or put it in `.env.local`:

```bash
export FIGMA_TOKEN=<your_token>
# or append to .env.local (gitignored):
#   FIGMA_TOKEN=<your_token>
# and then: source .env.local   (or export $(grep -v '^#' .env.local | xargs))
```

## Run the sync

From the repo root:

```bash
pnpm dlx tsx src/scripts/figma-sync.ts
```

## Expected output

### Case A — no drift

```
Figma → globals.css drift report
--------------------------------
TOKEN                       FIGMA_HEX   CSS_HEX     DRIFT%   BAND
--color-bg-base             #141A1F     #16181D     0.78     OK
--color-fg-default           ...         ...         0.41     OK
--color-primary-default      ...         ...         0.22     OK
--color-status-success       ...         ...         0.60     OK
--color-status-warning       ...         ...         0.35     OK
--color-status-error         ...         ...         0.88     OK
--------------------------------
Summary: 0 MUST-FIX, 0 WARN, 6 OK — no changes to globals.css
Exit: 0
```

### Case B — drift detected & auto-fixed

```
Figma → globals.css drift report
--------------------------------
...
--color-primary-default      #2563EB     #1F7BFF     4.52     MUST_FIX
...
Summary: 1 MUST-FIX, 0 WARN, 5 OK
Rewrote: src/app/globals.css
  --color-primary-default: hsl(217 91% 60%);   (was hsl(220 90% 60%))
Exit: 2
```

After a MUST-FIX run:

1. Review the diff: `git diff src/app/globals.css`
2. Verify the site still builds: `pnpm build`
3. Spot-check in the browser: `pnpm dev`, open Landing, confirm the recolored token still reads OK in context.
4. Commit.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `FIGMA_TOKEN env var is required.` | shell var not exported | `export FIGMA_TOKEN=...` |
| `Figma HTTP 403` | token lacks access to this file | regenerate token; make sure file is shared with the token's owner |
| `Style "status/success" not found in Figma` | style was renamed upstream | align Figma name OR update the `TARGET_STYLES` constant in the script (out-of-spec change) |
| `--color-bg-base not found in globals.css` | someone renamed the token | revert the rename OR update the script mapping (out-of-spec change) |
| `Fill is not SOLID (gradient?)` | Figma style was changed to non-solid | restore solid fill in Figma |
| exit 2 and nothing to review | script edited globals.css — that's the intended signal | `git diff` and commit |
