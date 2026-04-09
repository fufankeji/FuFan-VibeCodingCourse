/**
 * ClaudeAgentService 集成测试
 * 验证新 service 的事件分发和 SDK 调用是否正常
 */
import { ClaudeAgentService } from "../services/claudeAgentService.js";
import { tmpdir } from "os";
import { join } from "path";

const DIVIDER = "─".repeat(60);
const TEST_CWD = join(tmpdir(), "fufan-cc-sdk-test");

async function main() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║   ClaudeAgentService 集成测试                          ║");
  console.log("╚══════════════════════════════════════════════════════════╝");

  const svc = new ClaudeAgentService();
  const events: string[] = [];

  // 注册所有事件监听（和 chatHandler.ts 一致）
  svc.on("session_init", (d) => {
    events.push("session_init");
    console.log(`  [event] session_init → sessionId=${d.sessionId}, model=${d.model}`);
  });
  svc.on("assistant_text", (d) => {
    if (!events.includes("assistant_text")) events.push("assistant_text");
    console.log(`  [event] assistant_text → "${String(d.text).slice(0, 60)}" (partial=${d.isPartial})`);
  });
  svc.on("assistant_thinking", (d) => {
    if (!events.includes("assistant_thinking")) events.push("assistant_thinking");
    console.log(`  [event] assistant_thinking → ${String(d.thinking).slice(0, 40)}...`);
  });
  svc.on("new_turn", () => {
    events.push("new_turn");
    console.log("  [event] new_turn");
  });
  svc.on("tool_use_start", (d) => {
    events.push("tool_use_start");
    console.log(`  [event] tool_use_start → ${d.toolName} (${d.toolCallId})`);
  });
  svc.on("tool_use_result", (d) => {
    events.push("tool_use_result");
    console.log(`  [event] tool_use_result → ${d.toolCallId} (error=${d.isError})`);
  });
  svc.on("context_compact", (d) => {
    events.push("context_compact");
    console.log("  [event] context_compact");
  });
  svc.on("context_usage", (d) => {
    if (!events.includes("context_usage")) events.push("context_usage");
  });
  svc.on("task_complete", (d) => {
    events.push("task_complete");
    console.log(`  [event] task_complete → cost=$${d.costUsd?.toFixed(4)}, turns=${d.numTurns}`);
  });
  svc.on("close", (d) => {
    events.push("close");
    console.log(`  [event] close → code=${d.code}`);
  });
  svc.on("error", (d) => {
    events.push("error");
    console.log(`  [event] error → ${d.code}: ${d.message}`);
  });
  svc.on("process_stderr", (d) => {
    events.push("process_stderr");
    console.log(`  [event] process_stderr → ${d.text.slice(0, 80)}`);
  });

  // ── 测试 1：基本 query ──
  console.log("\n" + DIVIDER);
  console.log("测试 1：基本 start() + 事件分发");
  console.log(DIVIDER);

  const startTime = Date.now();
  const sid = await svc.start({
    prompt: "Reply with exactly: AGENT_SERVICE_OK",
    projectPath: TEST_CWD,
  });
  console.log(`  start() returned: ${sid}`);

  // 等待 close 事件（close 始终会触发，即使有 error）
  await new Promise<void>((resolve) => {
    const closeHandler = () => resolve();
    svc.on("close", closeHandler);
    // 安全超时
    setTimeout(() => {
      svc.removeListener("close", closeHandler);
      console.log("  TIMEOUT: 60s elapsed without close event");
      resolve();
    }, 60_000);
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n  耗时: ${elapsed}s`);
  console.log(`  收到事件: ${events.join(", ")}`);

  // ── 验证 ──
  console.log("\n" + DIVIDER);
  console.log("验证");
  console.log(DIVIDER);

  const required = ["session_init", "assistant_text", "task_complete", "close"];
  let allOk = true;
  for (const r of required) {
    const ok = events.includes(r);
    console.log(`  ${ok ? "✓" : "✗"} ${r}`);
    if (!ok) allOk = false;
  }

  const optional = ["context_usage", "new_turn", "assistant_thinking"];
  for (const o of optional) {
    const has = events.includes(o);
    console.log(`  ${has ? "✓" : "○"} ${o} (optional)`);
  }

  console.log(DIVIDER);
  console.log(allOk ? "\n  全部通过 ✓\n" : "\n  有必需事件缺失 ✗\n");
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
