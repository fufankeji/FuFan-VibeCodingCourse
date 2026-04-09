#!/usr/bin/env node
/**
 * Verify that the backend loads custom model providers from config (e.g. Qwen3).
 * Run from repo root: node --import tsx scripts/verify-custom-models.ts
 * Uses same config path as gateway. For dev gateway config:
 *   OPENCLAW_STATE_DIR=$HOME/.openclaw-dev node --import tsx scripts/verify-custom-models.ts
 */
import { loadConfig } from "../src/config/config.js";
import { resolveModel } from "../src/agents/pi-embedded-runner/model.js";
import { resolveOpenClawAgentDir } from "../src/agents/agent-paths.js";

const CUSTOM_PREFIX = "custom-";

function main() {
  const cfg = loadConfig();
  const providers = cfg?.models?.providers ?? {};
  const customEntries = Object.entries(providers).filter(([id]) =>
    id.startsWith(CUSTOM_PREFIX),
  );

  console.log("Config models.providers (custom-* only):");
  if (customEntries.length === 0) {
    console.log("  (none)");
    console.log("\nAdd a custom model in the UI (Control → Models) and save, then run this again.");
    process.exit(0);
    return;
  }

  for (const [providerId, provider] of customEntries) {
    const baseUrl = (provider as { baseUrl?: string }).baseUrl ?? "(missing)";
    const models = (provider as { models?: Array<{ id: string; name?: string }> }).models ?? [];
    console.log(`  ${providerId}: baseUrl=${baseUrl}, models=${models.map((m) => m.id).join(", ")}`);
    for (const model of models) {
      const agentDir = resolveOpenClawAgentDir();
      const result = resolveModel(providerId, model.id, agentDir, cfg);
      if (result.model) {
        console.log(`    ✓ ${providerId}/${model.id} resolves (baseUrl=${result.model.baseUrl})`);
      } else {
        console.log(`    ✗ ${providerId}/${model.id} failed: ${result.error ?? "unknown"}`);
      }
    }
  }
  console.log("\nBackend will use these providers when Chat requests this model (no restart needed).");
}

main();
