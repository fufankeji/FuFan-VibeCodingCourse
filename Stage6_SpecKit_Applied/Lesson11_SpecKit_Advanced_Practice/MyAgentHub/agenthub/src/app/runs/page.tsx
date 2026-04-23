"use client";

import React, { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  Terminal,
  Code2,
  ChevronRight,
  ChevronDown,
  Brain,
  Wrench,
  Database,
  Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RUN_HISTORY } from "@/lib/mock-data";
import { type Trace, type TraceStep } from "@/lib/schemas/trace";

type RawTraceNode = { name: string; duration: string; type: string };

function toMs(durationStr: string): number {
  const n = parseFloat(durationStr);
  if (Number.isNaN(n)) return 0;
  return Math.round(n * 1000);
}

function normalizeType(t: string): TraceStep["type"] {
  if (t === "llm") return "llm";
  if (t === "tool") return "tool";
  if (t === "retriever" || t === "retrieval") return "retrieval";
  return "agent";
}

function buildTrace(runId: string, flat: RawTraceNode[]): Trace {
  const rootChildren: TraceStep[] = [];
  let i = 0;
  while (i < flat.length) {
    const node = flat[i];
    const stepId = `${runId}-s${i}`;
    const children: TraceStep[] = [];
    if (normalizeType(node.type) === "llm" && i + 1 < flat.length) {
      const next = flat[i + 1];
      if (next.type === "tool") {
        children.push({
          stepId: `${stepId}-c0`,
          parentStepId: stepId,
          type: "tool",
          name: next.name,
          durationMs: toMs(next.duration),
          status: "success",
          children: [],
        });
        i += 1;
      }
    }
    rootChildren.push({
      stepId,
      parentStepId: `${runId}-root`,
      type: normalizeType(node.type),
      name: node.name,
      durationMs: toMs(node.duration),
      status: "success",
      children,
    });
    i += 1;
  }
  const totalMs = rootChildren.reduce((acc, s) => acc + s.durationMs, 0);
  const rootStep: TraceStep = {
    stepId: `${runId}-root`,
    parentStepId: null,
    type: "agent",
    name: "Agent Run",
    durationMs: totalMs,
    status: "success",
    children: rootChildren,
  };
  return { traceId: runId, rootStep };
}

function typeIcon(type: TraceStep["type"]) {
  const cls = "h-[12px] w-[12px]";
  if (type === "llm") return <Brain className={cls} />;
  if (type === "tool") return <Wrench className={cls} />;
  if (type === "retrieval") return <Database className={cls} />;
  return <Bot className={cls} />;
}

function barColor(durationMs: number): string {
  if (durationMs < 200) return "bg-status-success/30 border-status-success/60";
  if (durationMs <= 1000) return "bg-status-warning/30 border-status-warning/60";
  return "bg-status-error/30 border-status-error/60";
}

function TraceRow({
  step,
  depth,
  totalMs,
}: {
  step: TraceStep;
  depth: number;
  totalMs: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = step.children.length > 0;
  const widthPct = totalMs > 0 ? Math.max(4, (step.durationMs / totalMs) * 100) : 4;

  return (
    <div className="flex flex-col gap-[4px]">
      <div className="flex items-center gap-[8px]">
        <div
          className="flex items-center gap-[6px] shrink-0"
          style={{ paddingLeft: `${depth * 24}px`, width: "220px" }}
        >
          {hasChildren ? (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex h-[16px] w-[16px] items-center justify-center rounded-[4px] text-fg-muted hover:bg-bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-default/40"
              aria-label={expanded ? "折叠" : "展开"}
            >
              {expanded ? (
                <ChevronDown className="h-[12px] w-[12px]" />
              ) : (
                <ChevronRight className="h-[12px] w-[12px]" />
              )}
            </button>
          ) : (
            <span className="h-[16px] w-[16px]" aria-hidden />
          )}
          <span className="text-fg-muted">{typeIcon(step.type)}</span>
          <span className="truncate text-[12px] font-medium text-fg-default">
            {step.name}
          </span>
        </div>
        <div className="relative h-[16px] flex-1">
          <div
            className={`absolute top-1/2 h-[12px] -translate-y-1/2 rounded-[4px] border ${barColor(step.durationMs)}`}
            style={{ left: 0, width: `${widthPct}%` }}
            title={`${step.durationMs}ms`}
          />
        </div>
        <span className="w-[56px] shrink-0 text-right font-mono text-[11px] text-fg-muted">
          {step.durationMs}ms
        </span>
      </div>
      {hasChildren && expanded && (
        <div className="flex flex-col gap-[4px] border-l border-dashed border-border-subtle pl-[2px]">
          {step.children.map((child) => (
            <TraceRow
              key={child.stepId}
              step={child}
              depth={depth + 1}
              totalMs={totalMs}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TraceWaterfall({ trace }: { trace: Trace }) {
  const totalMs = Math.max(trace.rootStep.durationMs, 1);
  return (
    <div className="flex flex-col gap-[4px]">
      <TraceRow step={trace.rootStep} depth={0} totalMs={totalMs} />
    </div>
  );
}

function ClockIllustration() {
  return (
    <svg
      width="64"
      height="64"
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="text-fg-muted"
    >
      <circle cx="32" cy="32" r="22" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="32" cy="32" r="2" fill="currentColor" />
      <line x1="32" y1="32" x2="32" y2="18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="32" y1="32" x2="42" y2="36" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default function RunHistory() {
  const [activeRunId, setActiveRunId] = useState(RUN_HISTORY[0]?.id || "");
  const [isLoading, setIsLoading] = useState(true);
  const hasData = RUN_HISTORY.length > 0;
  const activeRun = RUN_HISTORY.find((r) => r.id === activeRunId) || RUN_HISTORY[0];

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 400);
    return () => clearTimeout(timer);
  }, []);

  const activeTrace = useMemo(
    () =>
      activeRun
        ? buildTrace(activeRun.id, activeRun.trace as RawTraceNode[])
        : null,
    [activeRun],
  );

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col bg-bg-base overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden w-[300px] flex-col border-r border-border-default bg-bg-subtle md:flex lg:w-[360px] shrink-0">
          <div className="flex h-[48px] items-center justify-between border-b border-border-default px-[16px] shrink-0">
            <h2 className="text-[14px] font-semibold text-fg-default">运行记录</h2>
            <Badge variant="outline" className="text-[12px]">
              {RUN_HISTORY.length} 条
            </Badge>
          </div>
          {!isLoading && hasData ? (
            <div className="flex-1 overflow-y-auto p-[12px] space-y-[8px]">
              {RUN_HISTORY.map((run) => (
                <button
                  key={run.id}
                  onClick={() => setActiveRunId(run.id)}
                  className={`flex w-full flex-col items-start gap-[8px] rounded-[8px] border p-[12px] text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-default/40 ${
                    activeRunId === run.id
                      ? "border-primary-default bg-bg-elevated"
                      : "border-border-default bg-bg-base hover:border-border-strong"
                  }`}
                >
                  <div className="flex w-full items-center justify-between">
                    <div className="flex items-center gap-[8px]">
                      {run.status === "success" ? (
                        <CheckCircle2 className="h-[14px] w-[14px] text-status-success" />
                      ) : (
                        <XCircle className="h-[14px] w-[14px] text-status-error" />
                      )}
                      <span className="line-clamp-1 text-[13px] font-medium text-fg-default">
                        {run.agent}
                      </span>
                    </div>
                    <span className="shrink-0 font-mono text-[12px] text-fg-muted">
                      {format(new Date(run.timestamp), "HH:mm:ss")}
                    </span>
                  </div>
                  <div className="flex w-full items-center gap-[12px] text-[12px] text-fg-secondary">
                    <span className="flex items-center gap-[4px]">
                      <Clock className="h-[12px] w-[12px]" /> {run.duration}
                    </span>
                    <span className="flex items-center gap-[4px]">
                      <DollarSign className="h-[12px] w-[12px]" /> {run.cost}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : !isLoading ? (
            <div className="flex flex-1 flex-col items-center justify-center p-[24px] text-center">
              <ClockIllustration />
              <p className="mb-[16px] mt-[16px] text-[15px] font-medium text-fg-secondary">
                空空如也，先去聊一次吧
              </p>
              <Button asChild>
                <Link href="/gallery">去商店看看</Link>
              </Button>
            </div>
          ) : (
            <div className="flex-1 p-[12px] text-[12px] text-fg-muted">加载中…</div>
          )}
        </aside>

        <main className="flex flex-1 flex-col overflow-hidden bg-bg-base">
          {!isLoading && activeRun && activeTrace ? (
            <>
              <header className="flex flex-col gap-[16px] border-b border-border-default bg-bg-subtle p-[20px]">
                <div className="flex flex-wrap items-center justify-between gap-[12px]">
                  <div className="flex items-center gap-[12px]">
                    <div className="flex h-[36px] w-[36px] items-center justify-center rounded-[8px] bg-primary-default/10">
                      <Terminal className="h-[18px] w-[18px] text-primary-default" />
                    </div>
                    <div>
                      <h1 className="text-[18px] font-semibold text-fg-default">
                        {activeRun.agent}
                      </h1>
                      <p className="font-mono text-[12px] text-fg-secondary">
                        {format(new Date(activeRun.timestamp), "yyyy-MM-dd HH:mm:ss")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-[12px]">
                    <Badge
                      variant={activeRun.status === "success" ? "success" : "error"}
                      className="px-[12px] py-[4px] text-[12px]"
                    >
                      {activeRun.status === "success" ? "成功" : "失败"}
                    </Badge>
                    <div className="h-[20px] w-px bg-border-strong" />
                    <div className="flex flex-col text-right">
                      <span className="text-[12px] text-fg-muted">总耗时</span>
                      <span className="font-mono text-[13px] text-fg-default">
                        {activeRun.duration}
                      </span>
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="text-[12px] text-fg-muted">预估成本</span>
                      <span className="font-mono text-[13px] text-fg-default">
                        {activeRun.cost}
                      </span>
                    </div>
                  </div>
                </div>
              </header>

              <div className="flex flex-1 flex-col gap-[16px] overflow-auto p-[20px]">
                <section className="flex flex-col gap-[12px] rounded-[8px] border border-border-default bg-bg-elevated p-[16px]">
                  <h3 className="flex items-center gap-[8px] text-[14px] font-medium text-fg-default">
                    <Code2 className="h-[16px] w-[16px] text-primary-default" />
                    执行瀑布图 (Trace)
                  </h3>
                  <TraceWaterfall trace={activeTrace} />
                  <div className="mt-[4px] flex items-center justify-center gap-[16px] text-[12px] text-fg-secondary">
                    <span className="flex items-center gap-[8px]">
                      <span className="h-[8px] w-[8px] rounded-full bg-status-success/60" />
                      &lt;200ms
                    </span>
                    <span className="flex items-center gap-[8px]">
                      <span className="h-[8px] w-[8px] rounded-full bg-status-warning/60" />
                      200-1000ms
                    </span>
                    <span className="flex items-center gap-[8px]">
                      <span className="h-[8px] w-[8px] rounded-full bg-status-error/60" />
                      &gt;1000ms
                    </span>
                  </div>
                </section>

                <section className="flex flex-col gap-[8px] rounded-[8px] border border-border-default bg-bg-elevated p-[16px]">
                  <h3 className="text-[14px] font-medium text-fg-default">输入 / 输出</h3>
                  <div className="grid grid-cols-1 gap-[12px] md:grid-cols-2">
                    <pre className="max-h-[160px] overflow-auto rounded-[6px] bg-bg-base p-[12px] font-mono text-[13px] leading-[1.5] text-fg-default">
                      {activeRun.input}
                    </pre>
                    <pre className="max-h-[160px] overflow-auto rounded-[6px] bg-bg-base p-[12px] font-mono text-[13px] leading-[1.5] text-fg-default whitespace-pre-wrap">
                      {activeRun.output}
                    </pre>
                  </div>
                </section>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-[14px] text-fg-secondary">
              {isLoading ? "加载中…" : "空空如也，先去聊一次吧"}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
