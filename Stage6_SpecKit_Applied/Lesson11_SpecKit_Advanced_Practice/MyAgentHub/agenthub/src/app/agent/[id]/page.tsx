"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ChevronRight,
  Play,
  Settings2,
  Plus,
  Check,
  Terminal,
  RefreshCw,
  MessageSquare,
  Copy,
  AlertTriangle,
} from "lucide-react";
import { experimental_useObject as useObject } from "@ai-sdk/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AGENTS } from "@/lib/mock-data";
import {
  agentOutputSchema,
  type AgentOutputSection,
} from "@/lib/schemas/agent-output";
import { useMyAgents } from "@/lib/hooks/use-my-agents";

const MODEL_OPTIONS = [
  { id: "openai/gpt-5.4-mini", label: "GPT-5.4 Mini" },
  { id: "openai/gpt-5.4", label: "GPT-5.4" },
  { id: "anthropic/claude-haiku-4.5", label: "Claude Haiku 4.5" },
  { id: "anthropic/claude-sonnet-4.6", label: "Claude Sonnet 4.6" },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { id: "deepseek/deepseek-v3.2", label: "DeepSeek V3.2" },
] as const;

function SkeletonLine({ className = "" }: { className?: string }) {
  return (
    <div
      className={
        "h-[12px] w-full animate-pulse rounded bg-bg-elevated " + className
      }
    />
  );
}

function ThinkingDots() {
  return (
    <div className="flex items-center gap-[8px] px-[16px] py-[12px]">
      <span className="text-[13px] text-fg-secondary">思考中</span>
      <span className="flex gap-[4px]">
        <span
          className="h-[6px] w-[6px] rounded-full bg-primary-default animate-bounce"
          style={{ animationDelay: "0ms" }}
        />
        <span
          className="h-[6px] w-[6px] rounded-full bg-primary-default animate-bounce"
          style={{ animationDelay: "150ms" }}
        />
        <span
          className="h-[6px] w-[6px] rounded-full bg-primary-default animate-bounce"
          style={{ animationDelay: "300ms" }}
        />
      </span>
    </div>
  );
}

function SectionBlock({ section }: { section: Partial<AgentOutputSection> | undefined }) {
  if (!section) return <SkeletonLine className="h-[16px]" />;
  const { type, content } = section;
  if (!content) return <SkeletonLine className="h-[16px]" />;

  if (type === "heading") {
    return (
      <h3 className="text-[15px] font-semibold text-fg-default">{content}</h3>
    );
  }
  if (type === "bullet") {
    return (
      <div className="flex gap-[8px] text-[13px] leading-relaxed text-fg-default">
        <span className="mt-[6px] h-[4px] w-[4px] shrink-0 rounded-full bg-primary-default" />
        <span>{content}</span>
      </div>
    );
  }
  return (
    <p className="text-[13px] leading-relaxed text-fg-default">{content}</p>
  );
}

export default function AgentDetail() {
  const { id } = useParams();
  const agent = AGENTS.find((a) => a.id === id) || AGENTS[0];

  const [prompt, setPrompt] = useState("");
  const [modelId, setModelId] = useState<string>(MODEL_OPTIONS[0].id);

  const { object, submit, isLoading, error, stop } = useObject({
    api: "/api/agent-run",
    schema: agentOutputSchema,
    onError: (err) => {
      console.error("[playground] useObject error:", err);
    },
  });

  const { has, toggle, isHydrated } = useMyAgents();

  const handleSend = () => {
    const text = prompt.trim();
    if (!text || isLoading) return;
    submit({ prompt: text, model: modelId });
  };

  const handleCopyJson = () => {
    if (!object) return;
    navigator.clipboard.writeText(JSON.stringify(object, null, 2)).catch(() => {});
  };

  const hasOutput = Boolean(object);
  const showEmpty = !hasOutput && !isLoading && !error;

  return (
    <div className="flex flex-1 flex-col bg-bg-base">
      <div className="mx-auto flex w-full max-w-[1280px] flex-col px-[24px] py-[20px]">
        <nav className="mb-[20px] flex items-center text-[13px] text-fg-muted">
          <Link href="/gallery" className="hover:text-primary-default transition-colors">
            商店
          </Link>
          <ChevronRight className="mx-[8px] h-[12px] w-[12px]" />
          <span>{agent.category}</span>
          <ChevronRight className="mx-[8px] h-[12px] w-[12px]" />
          <span className="font-medium text-fg-default">{agent.name}</span>
        </nav>

        <div className="flex flex-col gap-[24px] lg:flex-row">
          {/* 左：Agent 元信息卡 */}
          <aside className="w-full shrink-0 lg:w-[360px]">
            <Card className="flex flex-col border-border-default bg-bg-subtle lg:sticky lg:top-[80px]">
              <CardHeader className="flex flex-col items-center text-center p-[20px] pb-[12px]">
                <div className="flex h-[64px] w-[64px] items-center justify-center rounded-full bg-primary-default/10 text-primary-default mb-[12px]">
                  <Terminal className="h-[32px] w-[32px]" />
                </div>
                <CardTitle className="text-[20px]">{agent.name}</CardTitle>
                <div className="mt-[8px] flex items-center justify-center gap-[8px] text-[13px] text-fg-secondary">
                  <span>由 {agent.author} 提供</span>
                  <span className="h-[4px] w-[4px] rounded-full bg-fg-disabled" />
                  <Badge variant="outline">{agent.price}</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-[16px] px-[20px] pb-[16px] pt-0 text-[13px]">
                <div>
                  <h3 className="mb-[8px] font-medium text-fg-default text-[13px]">能力标签</h3>
                  <div className="flex flex-wrap gap-[8px]">
                    {agent.capabilities.map((cap) => (
                      <Badge
                        key={cap}
                        variant="secondary"
                        className="bg-bg-elevated px-[8px] py-[4px] text-[12px]"
                      >
                        {cap}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="mb-[8px] font-medium text-fg-default text-[13px]">Agent 描述</h3>
                  <p className="leading-relaxed text-fg-secondary text-[13px]">{agent.description}</p>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col border-t border-border-subtle px-[20px] py-[16px]">
                <Button
                  className="w-full font-medium"
                  onClick={() => toggle(agent.id)}
                >
                  {isHydrated && has(agent.id) ? (
                    <Check className="mr-[8px] h-[16px] w-[16px]" />
                  ) : (
                    <Plus className="mr-[8px] h-[16px] w-[16px]" />
                  )}
                  {isHydrated && has(agent.id)
                    ? "已添加到我的 Agent ✓"
                    : "添加到我的 Agent"}
                </Button>
                <div className="mt-[12px] flex w-full justify-between text-[12px] text-fg-muted">
                  <span>{agent.runs.toLocaleString()} 次运行</span>
                  <span>评分: {agent.rating} / 5.0</span>
                </div>
              </CardFooter>
            </Card>
          </aside>

          {/* 右：Playground 区 */}
          <main className="flex-1 flex flex-col min-h-[500px] rounded-[8px] border border-border-default bg-bg-elevated overflow-hidden">
            {/* 顶部工具栏 */}
            <div className="flex items-center justify-between border-b border-border-subtle bg-bg-subtle px-[16px] py-[12px]">
              <div className="flex items-center gap-[12px]">
                <div className="flex items-center gap-[8px]">
                  <span className="text-[12px] font-medium text-fg-secondary">模型</span>
                  <select
                    value={modelId}
                    onChange={(e) => setModelId(e.target.value)}
                    disabled={isLoading}
                    className="h-[28px] rounded-[8px] border border-border-default bg-bg-base px-[8px] text-[12px] text-fg-default focus:outline-none focus:ring-2 focus:ring-primary-default/40 focus:ring-offset-2 disabled:opacity-60"
                  >
                    {MODEL_OPTIONS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-[8px]">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-[28px] gap-[6px] px-[10px] text-[12px]"
                  onClick={handleCopyJson}
                  disabled={!hasOutput}
                  title="复制原始 JSON"
                >
                  <Copy className="h-[12px] w-[12px]" />
                  复制 JSON
                </Button>
                <Button variant="ghost" size="icon" className="h-[28px] w-[28px] text-fg-secondary">
                  <Settings2 className="h-[14px] w-[14px]" />
                </Button>
              </div>
            </div>

            {/* 输出区 */}
            <div className="flex-1 overflow-auto p-[20px] bg-bg-base">
              {showEmpty ? (
                <div className="flex h-full flex-col items-center justify-center text-center text-fg-muted">
                  <MessageSquare className="mb-[12px] h-[40px] w-[40px] stroke-1" />
                  <p className="text-[14px] font-medium text-fg-secondary">试着问点什么...</p>
                  <p className="mt-[4px] text-[12px]">
                    输入你想让 Agent 做的事，返回的不是一坨文本，而是流式生成的结构化 UI 卡片。
                  </p>
                </div>
              ) : (
                <div className="flex gap-[12px]">
                  <div className="mt-[4px] flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-[8px] bg-primary-default/10">
                    <Terminal className="h-[14px] w-[14px] text-primary-default" />
                  </div>

                  <div className="flex-1 space-y-[24px]">
                    {/* 错误卡 */}
                    {error && (
                      <div className="flex items-start gap-[10px] rounded-[8px] border border-red-500/40 bg-red-500/10 p-[12px] text-[13px] text-fg-default">
                        <AlertTriangle className="mt-[2px] h-[16px] w-[16px] shrink-0 text-red-500" />
                        <div className="flex-1 space-y-[4px]">
                          <p className="font-medium">生成失败</p>
                          <p className="text-fg-secondary">
                            {error.message || "后端异常，请检查 OPENAI_API_KEY 是否为 dummy 值或稍后重试。"}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* 思考中 */}
                    {isLoading && !hasOutput && <ThinkingDots />}

                    {/* 摘要卡 */}
                    {(hasOutput || isLoading) && (
                      <section className="rounded-[8px] border border-border-default bg-bg-subtle p-[16px]">
                        <p className="mb-[8px] text-[12px] font-medium uppercase tracking-wide text-fg-muted">
                          摘要
                        </p>
                        {object?.summary ? (
                          <p className="text-[13px] leading-relaxed text-fg-secondary">
                            {object.summary}
                          </p>
                        ) : (
                          <SkeletonLine className="h-[14px]" />
                        )}
                      </section>
                    )}

                    {/* 标题 + 分段正文 */}
                    {(hasOutput || isLoading) && (
                      <section className="rounded-[8px] border border-border-default bg-bg-subtle p-[16px]">
                        {object?.title ? (
                          <h2 className="mb-[16px] text-[18px] font-semibold text-fg-default">
                            {object.title}
                          </h2>
                        ) : (
                          <div className="mb-[16px]">
                            <SkeletonLine className="h-[18px] w-[60%]" />
                          </div>
                        )}

                        <div className="space-y-[12px]">
                          {object?.sections && object.sections.length > 0 ? (
                            object.sections.map((s, i) => (
                              <SectionBlock
                                key={i}
                                section={s as Partial<AgentOutputSection> | undefined}
                              />
                            ))
                          ) : (
                            <>
                              <SkeletonLine />
                              <SkeletonLine className="w-[85%]" />
                              <SkeletonLine className="w-[70%]" />
                            </>
                          )}
                        </div>
                      </section>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 输入区 */}
            <div className="border-t border-border-subtle bg-bg-subtle p-[16px]">
              <div className="relative rounded-[8px] border border-border-default bg-bg-base focus-within:border-primary-default focus-within:ring-1 focus-within:ring-primary-default transition-all">
                <textarea
                  className="w-full resize-none bg-transparent px-[12px] py-[12px] text-[13px] text-fg-default placeholder-fg-muted focus:outline-none min-h-[80px]"
                  placeholder="输入你想让 Agent 做的事，cmd+enter 提交…"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                />
                <div className="absolute bottom-[12px] right-[12px] flex items-center gap-[12px]">
                  <span className="text-[12px] font-mono text-fg-muted">
                    Token 预估: {prompt.length > 0 ? (prompt.length * 1.5).toFixed(0) : 0}
                  </span>
                  {isLoading ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-[28px] px-[12px] font-medium gap-[8px]"
                      onClick={() => stop()}
                    >
                      <RefreshCw className="h-[12px] w-[12px] animate-spin" />
                      停止
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="h-[28px] px-[12px] font-medium gap-[8px]"
                      onClick={handleSend}
                      disabled={!prompt.trim()}
                    >
                      <Play className="h-[12px] w-[12px]" fill="currentColor" />
                      发送
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </main>
        </div>

        <div className="mt-[48px] pt-[24px] border-t border-border-default">
          <h2 className="mb-[16px] text-[18px] font-semibold text-fg-default">相似精选 Agent</h2>
          <div className="grid grid-cols-1 gap-[16px] sm:grid-cols-2 lg:grid-cols-4">
            {AGENTS.slice(1, 5).map((a) => (
              <Card key={a.id} className="flex flex-col cursor-pointer">
                <CardHeader className="p-[16px] pb-[12px]">
                  <div className="flex items-center gap-[12px]">
                    <div className="flex h-[28px] w-[28px] items-center justify-center rounded-[8px] bg-bg-elevated">
                      <Terminal className="h-[14px] w-[14px] text-primary-default" />
                    </div>
                    <div>
                      <CardTitle className="text-[14px]">{a.name}</CardTitle>
                      <CardDescription className="text-[12px]">{a.author}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
