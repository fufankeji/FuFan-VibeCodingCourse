// SPDX-License-Identifier: MIT
// HUMAN-ADAPTED from knife5's RED skeleton (demo_top_journey.spec.ts) — the one
// edit a human makes is binding the correlation id to how THIS app actually emits it.
// The demo's index.html mints its own cid on click and echoes it in the #out <pre>;
// it does not read window.__CID__. So we read the cid the app actually used, then poll
// the observable surface for THAT cid. Everything else (condition-based waits, no sleep,
// terminal-hop assertion) is unchanged from the generated skeleton.
//
// Journey J2 [P0]: component:order-page --http--> /api/place-order --call--> handler
//   --shared-key--> kv --shared-key--> cron job --call--> notify --cross-channel--> push
// Proves the full A->B->C chain fires in a REAL browser against the LIVE demo.
import { test, expect } from "@playwright/test";

test("journey_j2_adapted: real browser drives live demo end-to-end", async ({ page, request }) => {
  // start hop (ui): load the page and click the order button (real browser, real DOM)
  await page.goto("/");
  await page.getByRole("button", { name: /place order|下单/i }).click();

  // the app echoes its response JSON (incl. the cid it minted) into #out — read it
  // with a condition-based wait, never a fixed sleep.
  await expect.poll(async () => {
    const txt = await page.locator("#out").textContent();
    return txt && txt.includes('"cid"');
  }, { timeout: 5000 }).toBeTruthy();

  const out = JSON.parse((await page.locator("#out").textContent()) || "{}");
  expect(out.ok).toBe(true);            // http hop (A->B) confirmed
  const cid = out.cid as string;
  expect(cid).toMatch(/^cid-/);

  // terminal hop (cross-channel): poll /api/deliveries until the cron-driven push
  // fires for THIS cid — covers shared-key + cron + cross-channel hops (B->C->push).
  await expect
    .poll(async () => {
      const res = await request.get("/api/deliveries");
      const body = await res.json();
      return (body.deliveries || []).some((d: any) => d.cid === cid);
    }, { timeout: 10_000 })
    .toBe(true);
});
