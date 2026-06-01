// SPDX-License-Identifier: MIT
// AUTO-GENERATED RED E2E SKELETON (knife5) — starts FAILING on purpose.
// Journey J2 [P0] : component:order-page → … → external:push-channel
// crosses features: A, B, C | hop types: ui, http, call, shared-key, cross-channel
// P0 启发式命中: irreversible-delivery, money + cross-channel 不可撤销投递 — 需人确认 (heuristic, needs human confirm)
//
// Hops (provenance-backed):
// [trace-confirmed] component:order-page --http--> route:POST /api/place-order   (cid-pipeline:component:order-page->route:POST /api/place-order)
// [trace-confirmed] route:POST /api/place-order --call--> handler:place_order   (cid-pipeline:route:POST /api/place-order->handler:place_order)
// [trace-confirmed] handler:place_order --shared-key--> datastore:kv:demo   (cid-pipeline:handler:place_order->datastore:kv:demo)
// [trace-confirmed] datastore:kv:demo --shared-key--> job:order_sweep   (cid-pipeline:datastore:kv:demo->job:order_sweep)
// [trace-confirmed] job:order_sweep --call--> handler:notify   (cid-pipeline:job:order_sweep->handler:notify)
// [trace-confirmed] handler:notify --cross-channel--> external:push-channel   (cid-pipeline:handler:notify->external:push-channel)
//
// RULES: condition-based waits only (expect.poll / waitFor). NO page.waitForTimeout() for sync.
import { test, expect } from "@playwright/test";

test("journey_j2", async ({ page, request }) => {
  const cid = "cid-e2e-J2";

  // start hop (ui): drive the UI that triggers the journey
  await page.goto("/");
  // attach the correlation id the same way the app does
  await page.addInitScript((c) => (window.__CID__ = c), cid);
  await page.getByRole("button").first().click();

  // terminal hop (cross-channel): poll the observable surface until it fires for THIS cid
  await expect
    .poll(async () => {
      const res = await request.get("/api/deliveries");
      const body = await res.json();
      return (body.deliveries || []).some((d) => d.cid === cid);
    }, { timeout: 5000 })
    // RED until the chain is wired end-to-end:
    .toBe(true);
});
