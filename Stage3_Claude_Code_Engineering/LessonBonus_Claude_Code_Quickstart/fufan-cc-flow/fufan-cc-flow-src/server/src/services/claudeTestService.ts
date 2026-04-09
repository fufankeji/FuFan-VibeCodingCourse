import { query } from "@anthropic-ai/claude-agent-sdk";
import { tmpdir } from "os";
import { join } from "path";
import net from "net";
import http from "http";
import { logger } from "../utils/logger.js";

export interface ClaudeTestResult {
  success: boolean;
  responseText: string;
  latency: number;
  error?: string;
}

export interface ProxyTestResult {
  success: boolean;
  latency: number;
  error?: string;
}

/** TCP-only probe: can we reach host:port within 5 s? */
export function testProxyPort(host: string, port: number): Promise<ProxyTestResult> {
  const start = Date.now();
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });

    const timer = setTimeout(() => {
      socket.destroy();
      resolve({ success: false, latency: Date.now() - start, error: "连接超时（5秒）" });
    }, 5_000);

    socket.on("connect", () => {
      clearTimeout(timer);
      socket.destroy();
      resolve({ success: true, latency: Date.now() - start });
    });

    socket.on("error", (err) => {
      clearTimeout(timer);
      resolve({ success: false, latency: Date.now() - start, error: err.message });
    });
  });
}

/**
 * Full connectivity test: send HTTP CONNECT through the proxy to api.anthropic.com:443.
 * This verifies the proxy can actually reach Anthropic's servers, not just that the
 * proxy port itself is open.
 */
export function testProxyConnectivity(
  proxyHost: string,
  proxyPort: number
): Promise<ProxyTestResult> {
  const start = Date.now();
  const target = "api.anthropic.com:443";

  return new Promise((resolve) => {
    const req = http.request({
      host: proxyHost,
      port: proxyPort,
      method: "CONNECT",
      path: target,
      headers: {
        Host: target,
        "Proxy-Connection": "keep-alive",
      },
    });

    const timer = setTimeout(() => {
      req.destroy();
      resolve({ success: false, latency: Date.now() - start, error: "连接超时（10秒）" });
    }, 10_000);

    req.on("connect", (res, socket) => {
      clearTimeout(timer);
      socket.destroy();
      req.destroy();
      if (res.statusCode === 200) {
        resolve({ success: true, latency: Date.now() - start });
      } else {
        resolve({
          success: false,
          latency: Date.now() - start,
          error: `代理返回状态码 ${res.statusCode}`,
        });
      }
    });

    req.on("error", (err) => {
      clearTimeout(timer);
      resolve({ success: false, latency: Date.now() - start, error: err.message });
    });

    req.end();
  });
}

/**
 * Test Claude connection using Agent SDK query().
 * Sends a minimal prompt and checks for a valid response.
 */
export async function testClaudeConnection(opts: {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  httpProxy?: string;
  httpsProxy?: string;
}): Promise<ClaudeTestResult> {
  const start = Date.now();
  const testCwd = join(tmpdir(), "fufan-cc-sdk-test");

  try {
    const env: Record<string, string | undefined> = {};
    if (opts.apiKey)     env["ANTHROPIC_API_KEY"]  = opts.apiKey;
    if (opts.baseUrl)    env["ANTHROPIC_BASE_URL"] = opts.baseUrl;
    if (opts.httpProxy)  { env["HTTP_PROXY"]  = opts.httpProxy;  env["http_proxy"]  = opts.httpProxy; }
    if (opts.httpsProxy) { env["HTTPS_PROXY"] = opts.httpsProxy; env["https_proxy"] = opts.httpsProxy; }

    let responseText = "";
    let stderrOutput = "";

    const controller = new AbortController();
    const hardTimeout = setTimeout(() => controller.abort(), 30_000);

    const stream = query({
      prompt: "Hi! Reply with exactly one word: OK",
      options: {
        cwd: testCwd,
        model: opts.model || "haiku",
        maxTurns: 1,
        maxBudgetUsd: 0.05,
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        abortController: controller,
        env,
        stderr: (data: string) => { stderrOutput += data; },
      },
    });

    for await (const msg of stream) {
      if (msg.type === "assistant") {
        const raw = msg as Record<string, unknown>;
        const message = raw.message as Record<string, unknown>;
        const content = message?.content as { type: string; text?: string }[];
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === "text" && block.text) responseText += block.text;
          }
        }
      }
    }

    clearTimeout(hardTimeout);
    const text = responseText.trim();
    return { success: !!text, responseText: text, latency: Date.now() - start };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const isAbort = errMsg.includes("abort") || (err as Error)?.name === "AbortError";
    logger.warn(`[claudeTest] connection test failed: ${errMsg}`);
    return {
      success: false,
      responseText: "",
      latency: Date.now() - start,
      error: isAbort
        ? "连接超时（30秒），请检查网络和代理配置"
        : errMsg,
    };
  }
}
