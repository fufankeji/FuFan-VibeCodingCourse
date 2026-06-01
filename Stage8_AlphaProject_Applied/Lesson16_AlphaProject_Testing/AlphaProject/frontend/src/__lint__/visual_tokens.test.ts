/**
 * G-F2 · L2 视觉 token 源对账 · 涨跌色 + 暗色优先 + token 体系完整性
 *
 * 翻译：把 FD-3（红涨绿跌·A 股惯例）与 FD-7（暗色默认）翻成源对账。
 *
 * **为什么不用 getComputedStyle**：jsdom 不解析 Tailwind v4 的
 * `@theme {}` block，computed styles 拿不到 CSS variable 实际值。所以走
 * source-of-truth：解析 `src/index.css` 的 `@theme` 区，断言 token 值符合契约。
 * 这个层级的断言**比 getComputedStyle 更稳**——token swap 在源码层就会被这里
 * 抓住，根本进不了浏览器。
 *
 * 风险级：P0（涨跌色反转直接误导决策） · 阻断发布
 * 可追溯：F5 / 001 / FD-3 / FD-7 / DESIGN.md
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const INDEX_CSS = resolve(dirname(__filename), "..", "index.css");

function parseTokens(): Record<string, string> {
  const css = readFileSync(INDEX_CSS, "utf-8");
  const re = /^\s*(--[a-z0-9-]+)\s*:\s*([^;]+?)\s*;/gim;
  const out: Record<string, string> = {};
  for (const m of css.matchAll(re)) {
    out[m[1]] = m[2].trim();
  }
  return out;
}

function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.match(/^#([0-9a-f]{6})$/i);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

const tokens = parseTokens();

describe("G-F2 visual tokens · 涨跌色 (FD-3 A-share convention)", () => {
  it("--color-bull token exists", () => {
    expect(tokens["--color-bull"]).toBeDefined();
  });

  it("--color-bear token exists", () => {
    expect(tokens["--color-bear"]).toBeDefined();
  });

  it("bull is RED (A-share: red = up; NOT green)", () => {
    const rgb = hexToRgb(tokens["--color-bull"]);
    expect(rgb, `--color-bull = ${tokens["--color-bull"]} must be a #RRGGBB literal`).not.toBeNull();
    const [r, g, b] = rgb!;
    expect(
      r > 200 && g < 130 && b < 130,
      `FD-3 violation: --color-bull = ${tokens["--color-bull"]} (rgb ${r},${g},${b}) is not red. ` +
        `A-share convention requires red for gains. Did someone swap bull/bear?`,
    ).toBe(true);
  });

  it("bear is GREEN (A-share: green = down; NOT red)", () => {
    const rgb = hexToRgb(tokens["--color-bear"]);
    expect(rgb, `--color-bear = ${tokens["--color-bear"]} must be a #RRGGBB literal`).not.toBeNull();
    const [r, g, b] = rgb!;
    expect(
      r < 130 && g > 180 && b < 150,
      `FD-3 violation: --color-bear = ${tokens["--color-bear"]} (rgb ${r},${g},${b}) is not green. ` +
        `A-share convention requires green for losses. Did someone swap bull/bear?`,
    ).toBe(true);
  });

  it("bull and bear are distinct (no accidental shared color)", () => {
    expect(tokens["--color-bull"]).not.toBe(tokens["--color-bear"]);
  });
});

describe("G-F2 visual tokens · 暗色默认 (FD-7 dark-first)", () => {
  it("--color-surface-base is DARK (FD-7 dark-first)", () => {
    const rgb = hexToRgb(tokens["--color-surface-base"]);
    expect(rgb, `--color-surface-base = ${tokens["--color-surface-base"]} must be a #RRGGBB literal`).not.toBeNull();
    const [r, g, b] = rgb!;
    expect(
      r < 50 && g < 50 && b < 50,
      `FD-7 violation: --color-surface-base = ${tokens["--color-surface-base"]} (rgb ${r},${g},${b}) is not dark. ` +
        `Dark-mode-first philosophy requires a dark base surface.`,
    ).toBe(true);
  });

  it("--color-foreground contrasts with --color-surface-base (light text on dark)", () => {
    const fg = hexToRgb(tokens["--color-foreground"]);
    expect(fg, `--color-foreground = ${tokens["--color-foreground"]} must be a #RRGGBB literal`).not.toBeNull();
    const [r, g, b] = fg!;
    expect(
      r > 200 && g > 200 && b > 200,
      `--color-foreground = ${tokens["--color-foreground"]} (rgb ${r},${g},${b}) must be light ` +
        `to read on dark surface. Did dark/light swap?`,
    ).toBe(true);
  });
});

describe("G-F2 visual tokens · 体系完整性", () => {
  const REQUIRED = [
    "--color-surface-base",
    "--color-surface-1",
    "--color-surface-1-border",
    "--color-foreground",
    "--color-foreground-muted",
    "--color-bull",
    "--color-bear",
    "--color-primary",
    "--radius-md",
    "--font-sans",
    "--font-mono",
  ];

  for (const tok of REQUIRED) {
    it(`token ${tok} exists`, () => {
      expect(tokens[tok], `Required token ${tok} missing from src/index.css`).toBeDefined();
    });
  }
});
