# Contract: Figma REST endpoints consumed by `figma-sync.ts`

## Auth

Header: `X-Figma-Token: $FIGMA_API_KEY` (falls back to `$FIGMA_TOKEN`).
Source: `.env.local` (auto-loaded by the script) OR shell export. Missing ⇒ exit 1.

## Endpoint A — list the file's own Color Styles

**Request**: `GET https://api.figma.com/v1/files/96ECPnljhnFrOMesWfd3d2?depth=2`

> **Important finding (during implement)**: Team-library endpoint `/v1/files/:key/styles`
> returned `meta.styles: []` for this file, because the 6 Color Styles are defined
> **inside** the file, not published to a team library. The file-level response under
> the `styles` key is the correct source.

**Expected response shape** (fields we depend on):

```json
{
  "styles": {
    "<nodeId>": {
      "key": "a11df2565206084beee5dc2911214413cc48b388",
      "name": "bg/base",
      "styleType": "FILL" | "TEXT" | "EFFECT" | "GRID",
      "remote": false,
      "description": ""
    },
    ...
  },
  "document": { ... }
}
```

**Script behavior**:
1. Iterate `styles[nodeId]` entries.
2. Filter `styleType === "FILL"`.
3. Assert all 6 target names are present exactly once. Missing or duplicate → exit 1 with named error.
4. Collect the 6 `nodeId`s for Endpoint B. `depth=2` is used to keep the response small (we don't need the full node tree at this stage).

## Endpoint B — resolve style nodes to get fill paints

**Request**: `GET https://api.figma.com/v1/files/96ECPnljhnFrOMesWfd3d2/nodes?ids=<n1>,<n2>,<n3>,<n4>,<n5>,<n6>`

**Expected response shape**:

```json
{
  "nodes": {
    "<nodeId>": {
      "document": {
        "id": "string",
        "name": "string",
        "fills": [
          {
            "type": "SOLID",
            "color": { "r": 0.078, "g": 0.102, "b": 0.122, "a": 1 },
            "opacity": 1
          }
        ]
      }
    }
  }
}
```

**Script behavior**:
1. For each of 6 expected `nodeId`s, require `nodes[id].document.fills[0]`.
2. Require `fills[0].type === "SOLID"`. Non-solid → exit 1 with named error.
3. Read `r/g/b ∈ [0,1]`, convert to 0–255 via `Math.round(c * 255)`.
4. Construct hex `"#RRGGBB"` (uppercase for readability).

## Rate limit / error handling

- HTTP 429 → retry once after 2s; second failure ⇒ exit 1.
- HTTP 4xx (excl. 429) → exit 1 with status code + response body slice.
- HTTP 5xx → retry once after 2s; second failure ⇒ exit 1.
- Network error (DNS, timeout) → exit 1.

## Non-goals

- Writing back to Figma (explicit spec out-of-scope).
- Watching Figma changes (no webhook subscription).
- Caching responses (each run is fresh).
