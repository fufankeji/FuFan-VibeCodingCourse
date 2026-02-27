import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { listEnabledFeishuAccounts } from "./accounts.js";
import { FeishuSearchSchema, type FeishuSearchParams } from "./search-schema.js";
import { resolveToolsConfig } from "./tools-config.js";

const TAVILY_API_KEY = "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";
const TAVILY_SEARCH_URL = "https://api.tavily.com/search";
const TAVILY_EXTRACT_URL = "https://api.tavily.com/extract";

function json(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    details: data,
  };
}

function formatSearchResult(data: {
  answer?: string;
  results?: Array<{ title?: string; url?: string; content?: string; score?: number }>;
}): string {
  const lines: string[] = [];

  if (data.answer) {
    lines.push("## Answer\n", data.answer, "\n---\n");
  }

  const results = data.results ?? [];
  if (results.length > 0) {
    lines.push("## Sources\n");
    for (const r of results) {
      const title = String(r.title ?? "").trim();
      const url = String(r.url ?? "").trim();
      const content = String(r.content ?? "").trim();
      const score = r.score ? ` (relevance: ${(r.score * 100).toFixed(0)}%)` : "";
      if (!title || !url) continue;
      lines.push(`- **${title}**${score}`);
      lines.push(`  ${url}`);
      if (content) {
        lines.push(`  ${content.slice(0, 300)}${content.length > 300 ? "..." : ""}`);
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

async function tavilySearch(params: {
  query: string;
  max_results?: number;
  search_depth?: string;
  topic?: string;
  days?: number;
}) {
  const body: Record<string, unknown> = {
    api_key: TAVILY_API_KEY,
    query: params.query,
    search_depth: params.search_depth ?? "basic",
    topic: params.topic ?? "general",
    max_results: Math.max(1, Math.min(params.max_results ?? 5, 20)),
    include_answer: true,
    include_raw_content: false,
  };

  if (params.topic === "news" && params.days) {
    body.days = params.days;
  }

  const resp = await fetch(TAVILY_SEARCH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Tavily Search failed (${resp.status}): ${text}`);
  }

  return resp.json();
}

async function tavilyExtract(urls: string[]) {
  const resp = await fetch(TAVILY_EXTRACT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: TAVILY_API_KEY, urls }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Tavily Extract failed (${resp.status}): ${text}`);
  }

  return resp.json();
}

function formatExtractResult(data: {
  results?: Array<{ url?: string; raw_content?: string }>;
  failed_results?: Array<{ url?: string; error?: string }>;
}): string {
  const lines: string[] = [];

  for (const r of data.results ?? []) {
    const url = String(r.url ?? "").trim();
    const content = String(r.raw_content ?? "").trim();
    lines.push(`# ${url}\n`);
    lines.push(content || "(no content extracted)");
    lines.push("\n---\n");
  }

  const failed = data.failed_results ?? [];
  if (failed.length > 0) {
    lines.push("## Failed URLs\n");
    for (const f of failed) {
      lines.push(`- ${f.url}: ${f.error}`);
    }
  }

  return lines.join("\n");
}

// ============ Tool Registration ============

export function registerFeishuSearchTools(api: OpenClawPluginApi) {
  if (!api.config) {
    api.logger.debug?.("feishu_search: No config available, skipping search tool");
    return;
  }

  const accounts = listEnabledFeishuAccounts(api.config);
  if (accounts.length === 0) {
    api.logger.debug?.("feishu_search: No Feishu accounts configured, skipping search tool");
    return;
  }

  const firstAccount = accounts[0];
  const toolsCfg = resolveToolsConfig(firstAccount.config.tools);

  if (!toolsCfg.search) {
    return;
  }

  api.registerTool(
    {
      name: "feishu_search",
      label: "Feishu Web Search",
      description:
        "AI-optimized web search and URL content extraction via Tavily API. Actions: search (web search with AI answer), extract (get raw content from URLs)",
      parameters: FeishuSearchSchema,
      async execute(_toolCallId, params) {
        const p = params as FeishuSearchParams;
        try {
          switch (p.action) {
            case "search": {
              const data = await tavilySearch({
                query: p.query,
                max_results: p.max_results,
                search_depth: p.search_depth,
                topic: p.topic,
                days: p.days,
              });
              return {
                content: [{ type: "text" as const, text: formatSearchResult(data) }],
                details: data,
              };
            }
            case "extract": {
              const data = await tavilyExtract(p.urls);
              return {
                content: [{ type: "text" as const, text: formatExtractResult(data) }],
                details: data,
              };
            }
            default:
              // eslint-disable-next-line @typescript-eslint/no-explicit-any -- exhaustive check fallback
              return json({ error: `Unknown action: ${(p as any).action}` });
          }
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) });
        }
      },
    },
    { name: "feishu_search" },
  );

  api.logger.info?.("feishu_search: Registered feishu_search tool");
}
