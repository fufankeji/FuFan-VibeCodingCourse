import "@testing-library/jest-dom/vitest";
import { expect } from "vitest";
// vitest-axe@0.x ships a broken `extend-expect` (empty file); register manually.
import { toHaveNoViolations } from "vitest-axe/matchers";
expect.extend({ toHaveNoViolations });

// jsdom lacks ResizeObserver (lightweight-charts autoSize uses it). Stub it.
if (typeof globalThis !== "undefined" && !(globalThis as { ResizeObserver?: unknown }).ResizeObserver) {
  // @ts-expect-error - test-env shim
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// jsdom lacks matchMedia (lightweight-charts internals call it). Stub it.
if (typeof window !== "undefined" && !window.matchMedia) {
  // @ts-expect-error - test-env shim
  window.matchMedia = () => ({
    matches: false,
    media: "",
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

// Silence noisy jsdom canvas not-implemented warnings (axe color-contrast
// rule needs a real canvas; it auto-skips in jsdom and the warning is
// informational only — full contrast scan runs in Playwright when added).
const origError = console.error;
console.error = (...args: unknown[]) => {
  const msg = String(args[0] ?? "");
  if (msg.includes("Not implemented: HTMLCanvasElement.prototype.getContext")) return;
  origError(...(args as Parameters<typeof console.error>));
};
