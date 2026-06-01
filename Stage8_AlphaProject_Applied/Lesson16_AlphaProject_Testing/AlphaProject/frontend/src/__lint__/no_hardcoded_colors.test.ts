/**
 * G-F1 · lint 门 · 禁裸色值（hex / rgb / hsl / named）出现在 src/**.{ts,tsx}
 *
 * FD-1: DESIGN.md 是视觉规范的**唯一真理来源**。组件必须走 token
 * (`var(--color-*)`)；任何裸 hex / rgb / hsl / 命名色都视为对 token 体系的逃逸。
 *
 * 这是"翻译"动作：把 FD-1 翻译成机器可执行的源码级 lint 断言。
 * 没引 stylelint 全套——既有 Vitest 跑 fs+regex 即等价 stylelint 思想，零新依赖。
 *
 * 风险级：P0（涨跌色错位 / token 漂移 → 误导决策） · 阻断发布
 * 可追溯：F5 / 001 / FD-1 / FD-3 / FD-4
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const SRC = resolve(dirname(__filename), "..");   // src/
const ROOT = resolve(SRC, "..");                  // frontend/

// Patterns that escape the token system. Tailwind-with-var() like
// `bg-[color:var(--color-primary)]/15` is the COMPLIANT form.
const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g;
const RGB_RE = /\brgba?\s*\(/g;
const HSL_RE = /\bhsla?\s*\(/g;
// allow-list: source files that legitimately MAY contain literal hex —
// the test files for token regression themselves, and this very file.
const ALLOW_FILES = new Set([
  "__lint__/no_hardcoded_colors.test.ts",
  "__lint__/visual_tokens.test.ts",
]);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...walk(full));
    } else if (/\.(tsx?|jsx?)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

describe("G-F1 lint gate: no hardcoded colors in src/**.{ts,tsx}", () => {
  const offenders: { file: string; line: number; snippet: string; kind: string }[] = [];

  for (const file of walk(SRC)) {
    const rel = relative(SRC, file);
    if (ALLOW_FILES.has(rel)) continue;
    // skip the index.css-adjacent test file itself
    if (file.endsWith(".test.ts") || file.endsWith(".test.tsx")) continue;
    const source = readFileSync(file, "utf-8");
    const lines = source.split("\n");
    lines.forEach((line, i) => {
      // strip comments
      const code = line.replace(/\/\/.*$/, "").replace(/\/\*.*?\*\//g, "");
      for (const [re, kind] of [
        [HEX_RE, "hex"],
        [RGB_RE, "rgb"],
        [HSL_RE, "hsl"],
      ] as const) {
        re.lastIndex = 0;
        if (re.test(code)) {
          offenders.push({ file: relative(ROOT, file), line: i + 1, snippet: line.trim(), kind });
        }
      }
    });
  }

  it("no hex/rgb/hsl literals outside token files", () => {
    expect(offenders, formatOffenders(offenders)).toEqual([]);
  });
});

function formatOffenders(
  list: { file: string; line: number; snippet: string; kind: string }[],
): string {
  if (list.length === 0) return "";
  const lines = list.map(
    (o) => `  ${o.file}:${o.line} [${o.kind}] → ${o.snippet}`,
  );
  return (
    `\n\nFD-1 violation: ${list.length} hardcoded color value(s) found.\n` +
    `Components MUST reference DESIGN.md tokens via var(--color-*).\n\n` +
    lines.join("\n") +
    "\n"
  );
}

describe("G-F1 lint gate: no rival UI kit imports", () => {
  // FD-4: token-driven + bespoke dense components; rival kits would break
  // the token system and density. (List is conservative — adjust if a
  // future feature legitimately needs one of these.)
  const FORBIDDEN_PKGS = ["antd", "@mui/material", "@chakra-ui/react"];
  const violations: { file: string; line: number; pkg: string }[] = [];

  for (const file of walk(SRC)) {
    const source = readFileSync(file, "utf-8");
    source.split("\n").forEach((line, i) => {
      for (const pkg of FORBIDDEN_PKGS) {
        if (line.includes(`from "${pkg}"`) || line.includes(`from '${pkg}'`) ||
            line.includes(`from "${pkg}/`) || line.includes(`from '${pkg}/`)) {
          violations.push({ file: relative(ROOT, file), line: i + 1, pkg });
        }
      }
    });
  }

  it("no rival UI kit imports", () => {
    expect(
      violations,
      violations.length
        ? `\n\nFD-4 violation: rival UI kit imported:\n${violations.map((v) => `  ${v.file}:${v.line} → ${v.pkg}`).join("\n")}`
        : "",
    ).toEqual([]);
  });
});
