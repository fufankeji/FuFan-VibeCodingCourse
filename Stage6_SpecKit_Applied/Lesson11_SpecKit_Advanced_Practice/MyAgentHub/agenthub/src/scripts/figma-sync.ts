/**
 * figma-sync — Figma → globals.css color token drift auditor
 *
 * Usage:  pnpm dlx tsx src/scripts/figma-sync.ts
 *
 * Reads 6 canonical Color Styles from Figma, compares them to the 6
 * matching --color-* tokens in src/app/globals.css, prints a drift
 * report, and rewrites MUST-FIX token values in place.
 *
 * Bands: <1% OK · 1-3% WARN · >3% MUST_FIX
 * Exit:  0 = clean · 1 = error · 2 = rewrote globals.css
 */

import * as fs from "node:fs";
import * as path from "node:path";

// ───────────────────────────────────────────────────────────── constants

const FIGMA_FILE_KEY = "96ECPnljhnFrOMesWfd3d2";

const CSS_PATH = path.resolve(process.cwd(), "src/app/globals.css");
const ENV_PATH = path.resolve(process.cwd(), ".env.local");

/** Figma style name → globals.css token name. Exactly 6 entries, locked. */
const TARGET_STYLES: ReadonlyArray<readonly [string, string]> = [
  ["bg/base",          "--color-bg-base"],
  ["fg/default",       "--color-fg-default"],
  ["primary/default",  "--color-primary-default"],
  ["status/success",   "--color-status-success"],
  ["status/warning",   "--color-status-warning"],
  ["status/error",     "--color-status-error"],
] as const;

const BAND_OK_MAX   = 1.0;  // drift% < 1.0       → OK
const BAND_WARN_MAX = 3.0;  // 1.0 ≤ drift% ≤ 3.0 → WARN ; >3.0 → MUST_FIX

// ───────────────────────────────────────────────────────────── env loader

function loadDotEnvLocal(): void {
  if (!fs.existsSync(ENV_PATH)) return;
  for (const line of fs.readFileSync(ENV_PATH, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

// ───────────────────────────────────────────────────────────── color math

type Rgb = { r: number; g: number; b: number };
type Hsl = { h: number; s: number; l: number };

function hexToRgb(hex: string): Rgb {
  const m = hex.replace(/^#/, "").match(/^([0-9a-f]{6})$/i);
  if (!m) throw new Error(`invalid hex: ${hex}`);
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

function rgbToHex({ r, g, b }: Rgb): string {
  const h = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}

function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const d = max - min;
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn: h = ((gn - bn) / d) + (gn < bn ? 6 : 0); break;
      case gn: h = ((bn - rn) / d) + 2; break;
      case bn: h = ((rn - gn) / d) + 4; break;
    }
    h *= 60;
  }
  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

function hslToRgb({ h, s, l }: Hsl): Rgb {
  const sn = s / 100, ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = ln - c / 2;
  let rp = 0, gp = 0, bp = 0;
  if      (h <  60) { rp = c; gp = x; bp = 0; }
  else if (h < 120) { rp = x; gp = c; bp = 0; }
  else if (h < 180) { rp = 0; gp = c; bp = x; }
  else if (h < 240) { rp = 0; gp = x; bp = c; }
  else if (h < 300) { rp = x; gp = 0; bp = c; }
  else              { rp = c; gp = 0; bp = x; }
  return {
    r: Math.round((rp + m) * 255),
    g: Math.round((gp + m) * 255),
    b: Math.round((bp + m) * 255),
  };
}

function driftPercent(a: Rgb, b: Rgb): number {
  const dr = a.r - b.r, dg = a.g - b.g, db = a.b - b.b;
  const dist = Math.sqrt(dr * dr + dg * dg + db * db);
  const max  = Math.sqrt(3 * 255 * 255);
  return (dist / max) * 100;
}

// ───────────────────────────────────────────────────────────── figma client

type FigmaFileStyleEntry = { key: string; name: string; styleType: string; remote: boolean };
type FigmaSolidPaint = { type: "SOLID"; color: { r: number; g: number; b: number; a?: number }; opacity?: number };

async function figmaGet<T>(url: string, token: string, retry = 1): Promise<T> {
  const res = await fetch(url, { headers: { "X-Figma-Token": token } });
  if (res.status === 429 || res.status >= 500) {
    if (retry > 0) {
      await new Promise(r => setTimeout(r, 2000));
      return figmaGet<T>(url, token, retry - 1);
    }
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Figma HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Read the file-level styles object. This is where Color Styles defined inside
 * the file live. The team-library endpoint (/v1/files/:key/styles) only lists
 * styles that have been *published* to a team library — unrelated to this flow.
 */
async function fetchStyleNodeIds(fileKey: string, token: string): Promise<Map<string, string>> {
  type Resp = { styles: Record<string, FigmaFileStyleEntry> };
  const data = await figmaGet<Resp>(`https://api.figma.com/v1/files/${fileKey}?depth=2`, token);
  const byName = new Map<string, string>();
  for (const [nodeId, s] of Object.entries(data.styles ?? {})) {
    if (s.styleType === "FILL") byName.set(s.name, nodeId);
  }
  const missing = TARGET_STYLES.filter(([fname]) => !byName.has(fname)).map(([fname]) => fname);
  if (missing.length > 0) {
    throw new Error(`Figma file ${fileKey} is missing required Color Style(s): ${missing.join(", ")}`);
  }
  const out = new Map<string, string>();
  for (const [fname, cssName] of TARGET_STYLES) out.set(cssName, byName.get(fname)!);
  return out;
}

type FigmaColorResult = { hex: string; opacityWarn: boolean };

async function fetchNodeFills(fileKey: string, ids: string[], token: string): Promise<Map<string, FigmaColorResult>> {
  type Resp = { nodes: Record<string, { document: { fills: FigmaSolidPaint[] } } | null> };
  const qs = ids.join(",");
  const data = await figmaGet<Resp>(`https://api.figma.com/v1/files/${fileKey}/nodes?ids=${encodeURIComponent(qs)}`, token);
  const out = new Map<string, FigmaColorResult>();
  for (const id of ids) {
    const node = data.nodes[id];
    if (!node) throw new Error(`Figma node ${id} missing in response`);
    const fill = node.document.fills?.[0];
    if (!fill) throw new Error(`Figma node ${id} has no fills`);
    if (fill.type !== "SOLID") throw new Error(`Figma node ${id} fill is not SOLID (got ${fill.type})`);
    const { r, g, b } = fill.color;
    for (const [name, v] of Object.entries({ r, g, b })) {
      if (v < 0 || v > 1) throw new Error(`Figma node ${id} channel ${name} out of range: ${v}`);
    }
    const hex = rgbToHex({ r: r * 255, g: g * 255, b: b * 255 });
    const opacityWarn = fill.opacity != null && fill.opacity !== 1;
    out.set(id, { hex, opacityWarn });
  }
  return out;
}

// ───────────────────────────────────────────────────────────── css parser

type CssTokenParse = { hsl: Hsl; lineMatch: string };

function parseGlobalsCss(text: string): Map<string, CssTokenParse> {
  const out = new Map<string, CssTokenParse>();
  for (const [, cssName] of TARGET_STYLES) {
    const safe = cssName.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
    const re = new RegExp(`^\\s*${safe}:\\s*hsl\\(\\s*(\\d+)\\s+(\\d+)%\\s+(\\d+)%\\s*\\);`, "m");
    const m = text.match(re);
    if (!m) throw new Error(`${cssName} not found in globals.css`);
    out.set(cssName, {
      hsl: { h: +m[1], s: +m[2], l: +m[3] },
      lineMatch: m[0],
    });
  }
  return out;
}

function rewriteToken(text: string, cssName: string, newHsl: Hsl): string {
  const safe = cssName.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  const re = new RegExp(`(^(\\s*)${safe}:\\s*)hsl\\([^)]*\\)(;)`, "m");
  return text.replace(re, `$1hsl(${newHsl.h} ${newHsl.s}% ${newHsl.l}%)$3`);
}

// ───────────────────────────────────────────────────────────── drift & report

type Band = "OK" | "WARN" | "MUST_FIX";

type DriftRow = {
  token: string;
  figmaHex: string;
  figmaRgb: Rgb;
  figmaHsl: Hsl;
  cssHex: string;
  cssHsl: Hsl;
  driftPct: number;
  band: Band;
  opacityWarn: boolean;
};

function classify(pct: number): Band {
  if (pct <  BAND_OK_MAX)   return "OK";
  if (pct <= BAND_WARN_MAX) return "WARN";
  return "MUST_FIX";
}

function renderReport(rows: DriftRow[]): string {
  const header = ["TOKEN", "FIGMA_HEX", "CSS_HEX", "DRIFT%", "BAND"];
  const widths = [28, 10, 10, 7, 9];
  const lines: string[] = [];
  lines.push("Figma → globals.css drift report");
  lines.push("-".repeat(widths.reduce((a, b) => a + b + 2, 0)));
  const pad = (s: string, w: number) => s.padEnd(w);
  lines.push(header.map((h, i) => pad(h, widths[i])).join("  "));
  for (const r of rows) {
    lines.push([
      pad(r.token, widths[0]),
      pad(r.figmaHex, widths[1]),
      pad(r.cssHex, widths[2]),
      pad(r.driftPct.toFixed(2), widths[3]),
      pad(r.band + (r.opacityWarn ? "*" : ""), widths[4]),
    ].join("  "));
  }
  lines.push("-".repeat(widths.reduce((a, b) => a + b + 2, 0)));
  const counts = { OK: 0, WARN: 0, MUST_FIX: 0 } as Record<Band, number>;
  for (const r of rows) counts[r.band]++;
  lines.push(`Summary: ${counts.MUST_FIX} MUST-FIX, ${counts.WARN} WARN, ${counts.OK} OK`);
  if (rows.some(r => r.opacityWarn)) {
    lines.push("  (* = Figma style had non-opaque alpha; treated as 1)");
  }
  return lines.join("\n");
}

// ───────────────────────────────────────────────────────────── main

async function main(): Promise<number> {
  loadDotEnvLocal();
  const token = process.env.FIGMA_API_KEY ?? process.env.FIGMA_TOKEN;
  if (!token) {
    console.error(
      "FIGMA_API_KEY (or FIGMA_TOKEN) env var is required.\n" +
      "Add it to .env.local or export it in your shell."
    );
    return 1;
  }

  const idMap = await fetchStyleNodeIds(FIGMA_FILE_KEY, token);
  const figmaResults = await fetchNodeFills(FIGMA_FILE_KEY, [...idMap.values()], token);

  const cssText = fs.readFileSync(CSS_PATH, "utf8");
  const cssMap = parseGlobalsCss(cssText);

  const rows: DriftRow[] = [];
  for (const [, cssName] of TARGET_STYLES) {
    const nodeId = idMap.get(cssName)!;
    const fig = figmaResults.get(nodeId)!;
    const figmaRgb = hexToRgb(fig.hex);
    const figmaHsl = rgbToHsl(figmaRgb);
    const cssEntry = cssMap.get(cssName)!;
    const cssRgb = hslToRgb(cssEntry.hsl);
    const cssHex = rgbToHex(cssRgb);
    const pct = driftPercent(figmaRgb, cssRgb);
    rows.push({
      token: cssName,
      figmaHex: fig.hex,
      figmaRgb,
      figmaHsl,
      cssHex,
      cssHsl: cssEntry.hsl,
      driftPct: pct,
      band: classify(pct),
      opacityWarn: fig.opacityWarn,
    });
  }

  console.log(renderReport(rows));

  const mustFix = rows.filter(r => r.band === "MUST_FIX");
  if (mustFix.length === 0) return 0;

  let nextText = cssText;
  for (const r of mustFix) {
    nextText = rewriteToken(nextText, r.token, r.figmaHsl);
    console.log(`Rewrote: ${r.token}: hsl(${r.figmaHsl.h} ${r.figmaHsl.s}% ${r.figmaHsl.l}%)   (was hsl(${r.cssHsl.h} ${r.cssHsl.s}% ${r.cssHsl.l}%))`);
  }
  fs.writeFileSync(CSS_PATH, nextText, "utf8");
  console.log(`\nRewrote: ${CSS_PATH}`);
  return 2;
}

main()
  .then(code => process.exit(code))
  .catch(err => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
