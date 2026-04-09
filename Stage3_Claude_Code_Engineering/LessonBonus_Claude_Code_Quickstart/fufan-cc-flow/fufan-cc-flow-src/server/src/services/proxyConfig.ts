import fs from "fs/promises";
import path from "path";
import os from "os";

// Stored separately from ~/.claude/settings.json to avoid file-lock
// contention with the Claude Code process on Windows.
const PROXY_FILE = path.join(os.homedir(), ".fufan-cc-flow", "proxy.json");

export interface ProxyData {
  httpProxy: string;
  httpsProxy: string;
  socksProxy: string;
}

export async function readProxy(): Promise<ProxyData> {
  try {
    const raw = await fs.readFile(PROXY_FILE, "utf-8");
    const d = JSON.parse(raw) as Record<string, unknown>;
    return {
      httpProxy: (d.httpProxy as string) || "",
      httpsProxy: (d.httpsProxy as string) || "",
      socksProxy: (d.socksProxy as string) || "",
    };
  } catch {
    return { httpProxy: "", httpsProxy: "", socksProxy: "" };
  }
}

export async function writeProxy(proxy: ProxyData): Promise<void> {
  const dir = path.dirname(PROXY_FILE);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(PROXY_FILE, JSON.stringify(proxy, null, 2), "utf-8");
  // intentional console so the server terminal confirms the exact path used
  console.log(`[proxyConfig] saved → ${PROXY_FILE}`);
}
