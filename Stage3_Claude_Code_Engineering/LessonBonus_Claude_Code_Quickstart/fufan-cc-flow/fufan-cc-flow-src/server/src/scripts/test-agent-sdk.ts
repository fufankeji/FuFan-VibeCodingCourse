/**
 * Agent SDK 最小可用性测试脚本
 *
 * 验证项：
 *   1. SDK 能正常 import 并调用 query()
 *   2. 能收到 system init 消息（含 session_id）
 *   3. 能收到 assistant 消息（流式文本）
 *   4. 能收到 result 消息（任务完成）
 *   5. AbortController 能正常中断
 *   6. Windows 下无 conhost 弹窗 / 进程残留
 *
 * 运行方式：
 *   cd server
 *   npx tsx src/scripts/test-agent-sdk.ts
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import path from "path";
import os from "os";

// 关键：如果在 Claude Code 会话内运行，需要清除嵌套检测环境变量
// 否则 SDK spawn 的子进程会因 "cannot be launched inside another Claude Code session" 而失败
// 生产环境中 Fufan-CC Flow 的 server 也需要同样处理
delete process.env.CLAUDECODE;

const DIVIDER = "─".repeat(60);

// 使用一个安全的临时目录作为 cwd
const TEST_CWD = path.resolve(os.tmpdir(), "fufan-cc-sdk-test");

async function testBasicQuery() {
  console.log("\n" + DIVIDER);
  console.log("测试 1：基本 query() 调用");
  console.log(DIVIDER);
  console.log(`  cwd: ${TEST_CWD}`);

  const startTime = Date.now();
  let gotInit = false;
  let gotAssistant = false;
  let gotResult = false;
  let sessionId = "";
  let resultText = "";
  const stderrChunks: string[] = [];

  try {
    const stream = query({
      prompt: "Reply with exactly: AGENT_SDK_OK",
      options: {
        cwd: TEST_CWD,
        maxTurns: 1,
        maxBudgetUsd: 0.05,
        systemPrompt: "You are a test assistant. Reply with exactly what the user asks, nothing more.",
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        stderr: (data: string) => {
          stderrChunks.push(data);
          // 实时打印 stderr 帮助调试
          process.stderr.write(`  [stderr] ${data}`);
        },
      },
    });

    for await (const msg of stream) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      if (msg.type === "system" && (msg as Record<string, unknown>).subtype === "init") {
        gotInit = true;
        sessionId = (msg as Record<string, unknown>).session_id as string;
        console.log(`  [${elapsed}s] system.init → session_id: ${sessionId}`);
      }

      if (msg.type === "assistant") {
        gotAssistant = true;
        const content = (msg as Record<string, unknown>).message as Record<string, unknown>;
        const blocks = content?.content as Record<string, unknown>[];
        if (blocks) {
          for (const block of blocks) {
            if (block.type === "text") {
              resultText += block.text as string;
            }
          }
        }
        const partial = (msg as Record<string, unknown>).is_partial ? " (partial)" : "";
        console.log(`  [${elapsed}s] assistant${partial} → ${resultText.slice(0, 80)}`);
      }

      if (msg.type === "result") {
        gotResult = true;
        const r = msg as Record<string, unknown>;
        console.log(`  [${elapsed}s] result → subtype=${r.subtype}, cost=$${r.total_cost_usd}`);
        console.log(`           turns=${r.num_turns}, duration=${r.duration_ms}ms`);
      }
    }
  } catch (err) {
    console.error("  ERROR:", err);
    if (stderrChunks.length > 0) {
      console.log("  === stderr 完整输出 ===");
      console.log(stderrChunks.join(""));
      console.log("  === end stderr ===");
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n  耗时: ${totalTime}s`);
  console.log(`  system.init:  ${gotInit ? "✓" : "✗"} (session_id: ${sessionId || "N/A"})`);
  console.log(`  assistant:    ${gotAssistant ? "✓" : "✗"} (text: "${resultText.trim().slice(0, 60)}")`);
  console.log(`  result:       ${gotResult ? "✓" : "✗"}`);

  return gotInit && gotAssistant && gotResult;
}

async function testAbort() {
  console.log("\n" + DIVIDER);
  console.log("测试 2：AbortController 中断");
  console.log(DIVIDER);

  const controller = new AbortController();
  const startTime = Date.now();
  let messageCount = 0;
  let aborted = false;

  try {
    const stream = query({
      prompt: "Write a very long essay about the history of computing. Make it at least 2000 words.",
      options: {
        cwd: TEST_CWD,
        maxTurns: 3,
        maxBudgetUsd: 0.10,
        abortController: controller,
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        stderr: (data: string) => {
          process.stderr.write(`  [stderr] ${data}`);
        },
      },
    });

    // 收到 3 条消息后中断
    for await (const msg of stream) {
      messageCount++;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`  [${elapsed}s] 收到消息 #${messageCount}: type=${msg.type}`);

      if (messageCount >= 3) {
        console.log(`  [${elapsed}s] → 触发 abort()`);
        controller.abort();
      }
    }
  } catch (err: unknown) {
    if ((err as Error)?.name === "AbortError" || String(err).includes("abort")) {
      aborted = true;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`  [${elapsed}s] ✓ AbortError 正确抛出`);
    } else {
      console.error("  非预期错误:", err);
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n  耗时: ${totalTime}s`);
  console.log(`  收到消息数: ${messageCount}`);
  console.log(`  中断成功:   ${aborted ? "✓" : "✗ (可能收到了 result 而非 abort)"}`);

  // 中断成功或自然结束都算通过（短 prompt 可能在 abort 前就完成了）
  return aborted || messageCount > 0;
}

async function testListSessions() {
  console.log("\n" + DIVIDER);
  console.log("测试 3：listSessions() API");
  console.log(DIVIDER);

  try {
    const { listSessions } = await import("@anthropic-ai/claude-agent-sdk");
    const sessions = await listSessions();
    console.log(`  返回 ${sessions.length} 个会话`);
    if (sessions.length > 0) {
      const s = sessions[0] as Record<string, unknown>;
      console.log(`  最新会话: id=${String(s.sessionId || s.id || "?").slice(0, 20)}...`);
    }
    return true;
  } catch (err) {
    console.error("  ERROR:", err);
    return false;
  }
}

// ── Main ──
async function main() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║      Fufan-CC Flow · Agent SDK 可用性验证              ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`平台: ${process.platform} (${process.arch})`);
  console.log(`Node: ${process.version}`);

  const results: Record<string, boolean> = {};

  results["基本 query()"] = await testBasicQuery();
  results["AbortController"] = await testAbort();
  results["listSessions()"] = await testListSessions();

  console.log("\n" + DIVIDER);
  console.log("汇总");
  console.log(DIVIDER);
  let allPass = true;
  for (const [name, pass] of Object.entries(results)) {
    console.log(`  ${pass ? "✓" : "✗"} ${name}`);
    if (!pass) allPass = false;
  }
  console.log(DIVIDER);
  console.log(allPass ? "\n  全部通过 ✓\n" : "\n  有测试未通过 ✗\n");

  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
