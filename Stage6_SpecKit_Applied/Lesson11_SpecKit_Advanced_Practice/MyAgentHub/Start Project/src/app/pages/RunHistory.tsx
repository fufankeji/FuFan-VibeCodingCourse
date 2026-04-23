import React, { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { format } from 'date-fns';
import { CheckCircle2, XCircle, Clock, DollarSign, Terminal, Code2, Database, SearchCode, DatabaseBackup } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { RUN_HISTORY } from '../lib/mock-data';

// [Prep-02] 修复 #3: 时钟 SVG 空态插画
function ClockIllustration() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-fg-muted">
      <circle cx="32" cy="32" r="22" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="32" cy="32" r="2" fill="currentColor" />
      <line x1="32" y1="32" x2="32" y2="18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="32" y1="32" x2="42" y2="36" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="32" y1="8" x2="32" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="32" y1="52" x2="32" y2="56" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="8" y1="32" x2="12" y2="32" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="52" y1="32" x2="56" y2="32" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// [Prep-02] 修复 #3: 骨架屏行
function SkeletonRow() {
  return (
    <div className="flex w-full flex-col gap-[8px] rounded-[8px] border border-border-default p-[16px]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-[8px]">
          <div className="h-[16px] w-[16px] animate-pulse rounded-full bg-bg-elevated" />
          <div className="h-[14px] w-[120px] animate-pulse rounded bg-bg-elevated" />
        </div>
        <div className="h-[12px] w-[48px] animate-pulse rounded bg-bg-elevated" />
      </div>
      <div className="flex items-center gap-[16px]">
        <div className="h-[12px] w-[48px] animate-pulse rounded bg-bg-elevated" />
        <div className="h-[12px] w-[48px] animate-pulse rounded bg-bg-elevated" />
      </div>
    </div>
  );
}

export default function RunHistory() {
  const [activeRunId, setActiveRunId] = useState(RUN_HISTORY[0]?.id || '');
  const activeRun = RUN_HISTORY.find(r => r.id === activeRunId) || RUN_HISTORY[0];
  const [activeTab, setActiveTab] = useState<'input' | 'output' | 'metadata'>('output');
  // [Prep-02] 修复 #3: 模拟加载
  const [isLoading, setIsLoading] = useState(true);
  // [Prep-02] 修复 #3: 空数据 toggle（实际为假数据，总有数据，但保留空态逻辑）
  const hasData = RUN_HISTORY.length > 0;

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  // [Prep-02] 修复 #4: md 下 sidebar → 水平 tabs
  const RunListContent = () => {
    if (isLoading) {
      return (
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-[12px] space-y-[8px]">
          {Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      );
    }
    if (!hasData) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center p-[24px] text-center">
          <ClockIllustration />
          <p className="mt-[16px] mb-[16px] text-[15px] font-medium text-fg-secondary">还没有运行过 Agent</p>
          <Button asChild>
            <Link to="/gallery">去商店看看</Link>
          </Button>
        </div>
      );
    }
    return (
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-[12px] space-y-[8px]">
        {RUN_HISTORY.map((run) => (
          <button
            key={run.id}
            onClick={() => setActiveRunId(run.id)}
            className={`flex w-full flex-col items-start gap-[8px] rounded-[8px] border p-[12px] text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-default/40 ${
              activeRunId === run.id
                ? 'border-primary-default bg-bg-elevated'
                : 'border-border-default bg-bg-base hover:border-border-strong'
            }`}
          >
            <div className="flex w-full items-center justify-between">
              <div className="flex items-center gap-[8px]">
                {run.status === 'success' ? (
                  <CheckCircle2 className="h-[14px] w-[14px] text-status-success" />
                ) : (
                  <XCircle className="h-[14px] w-[14px] text-status-error" />
                )}
                <span className="text-[13px] font-medium text-fg-default line-clamp-1">{run.agent}</span>
              </div>
              <span className="text-[12px] font-mono text-fg-muted shrink-0">{format(new Date(run.timestamp), 'HH:mm:ss')}</span>
            </div>
            <div className="flex w-full items-center gap-[12px] text-[12px] text-fg-secondary">
              <span className="flex items-center gap-[4px]"><Clock className="h-[12px] w-[12px]" /> {run.duration}</span>
              <span className="flex items-center gap-[4px]"><DollarSign className="h-[12px] w-[12px]" /> {run.cost}</span>
            </div>
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col bg-bg-base overflow-hidden">
      {/* [Prep-02] 修复 #4: md 下显示水平滚动 tabs 代替 sidebar */}
      <div className="flex overflow-x-auto border-b border-border-default bg-bg-subtle px-[16px] md:hidden shrink-0">
        <div className="flex h-[48px] items-center gap-[4px] shrink-0">
          <span className="text-[14px] font-semibold text-fg-default mr-[12px] shrink-0">运行记录</span>
          {!isLoading && hasData && RUN_HISTORY.slice(0, 8).map((run) => (
            <button
              key={run.id}
              onClick={() => setActiveRunId(run.id)}
              className={`shrink-0 rounded-[8px] px-[12px] py-[4px] text-[12px] font-medium transition-colors ${
                activeRunId === run.id ? 'bg-primary-default/10 text-primary-default' : 'text-fg-secondary hover:text-fg-default'
              }`}
            >
              {run.agent.slice(0, 4)}…
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* 左侧 Sidebar（md 以上显示） */}
        <aside className="hidden w-[300px] flex-col border-r border-border-default bg-bg-subtle md:flex lg:w-[360px] shrink-0">
          <div className="flex h-[48px] items-center justify-between border-b border-border-default px-[16px] shrink-0">
            <h2 className="text-[14px] font-semibold text-fg-default">运行记录</h2>
            <Badge variant="outline" className="text-[12px]">{RUN_HISTORY.length} 条</Badge>
          </div>
          <RunListContent />
        </aside>

        {/* 右侧主区 */}
        <main className="flex flex-1 flex-col overflow-hidden bg-bg-base">
          {!isLoading && hasData && activeRun ? (
            <>
              <header className="flex flex-col gap-[16px] border-b border-border-default p-[20px] shrink-0 bg-bg-subtle">
                <div className="flex flex-wrap items-center justify-between gap-[12px]">
                  <div className="flex items-center gap-[12px]">
                    <div className="flex h-[36px] w-[36px] items-center justify-center rounded-[8px] bg-primary-default/10">
                      <Terminal className="h-[18px] w-[18px] text-primary-default" />
                    </div>
                    <div>
                      <h1 className="text-[18px] font-semibold text-fg-default">{activeRun.agent}</h1>
                      <p className="text-[12px] font-mono text-fg-secondary">{format(new Date(activeRun.timestamp), 'yyyy-MM-dd HH:mm:ss')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-[12px]">
                    <Badge variant={activeRun.status === 'success' ? 'success' : 'error'} className="px-[12px] py-[4px] text-[12px]">
                      {activeRun.status === 'success' ? '成功' : '失败'}
                    </Badge>
                    <div className="h-[20px] w-px bg-border-strong" />
                    <div className="flex flex-col text-right">
                      <span className="text-[12px] text-fg-muted">总耗时</span>
                      <span className="text-[13px] font-mono text-fg-default">{activeRun.duration}</span>
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="text-[12px] text-fg-muted">预估成本</span>
                      <span className="text-[13px] font-mono text-fg-default">{activeRun.cost}</span>
                    </div>
                  </div>
                </div>
              </header>

              <div className="flex flex-1 flex-col overflow-hidden p-[20px] gap-[16px]">
                {/* Trace 瀑布图 */}
                <section className="flex-shrink-0 flex flex-col gap-[12px] rounded-[8px] border border-border-default bg-bg-elevated p-[16px]">
                  <h3 className="text-[14px] font-medium text-fg-default flex items-center gap-[8px]">
                    <Code2 className="h-[16px] w-[16px] text-primary-default" />
                    执行瀑布图 (Trace)
                  </h3>
                  <div className="relative flex flex-col gap-[8px] py-[12px] pl-[140px] pr-[16px]">
                    <div className="absolute top-0 bottom-0 left-[140px] w-px bg-border-strong/50" />
                    {activeRun.trace.map((node, i) => (
                      <div key={i} className="relative flex items-center gap-[12px] group">
                        <div className="absolute -left-[140px] w-[120px] text-right">
                          <span className="text-[12px] font-medium text-fg-default line-clamp-1">{node.name}</span>
                          <span className="text-[12px] text-fg-muted ml-[4px]">{node.duration}</span>
                        </div>
                        <div className="relative h-[20px] flex-1">
                          <div
                            className={`absolute top-1/2 h-[14px] -translate-y-1/2 rounded-[4px] border ${
                              node.type === 'tool' ? 'bg-primary-default/20 border-primary-default/50' :
                              node.type === 'retriever' ? 'bg-status-success/20 border-status-success/50' :
                              'bg-status-warning/20 border-status-warning/50'
                            } cursor-pointer`}
                            style={{
                              left: `${i * 10}%`,
                              width: `${Math.max(10, parseFloat(node.duration) * 15)}%`
                            }}
                          >
                            <div className="absolute -top-[24px] left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity rounded-[4px] bg-bg-base px-[8px] py-[4px] text-[12px] border border-border-strong text-fg-default z-10 whitespace-nowrap pointer-events-none">
                              {node.name} ({node.duration})
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-[4px] flex items-center justify-center gap-[16px] text-[12px] text-fg-secondary">
                    <span className="flex items-center gap-[8px]"><span className="h-[8px] w-[8px] rounded-full bg-status-warning/50" /> LLM</span>
                    <span className="flex items-center gap-[8px]"><span className="h-[8px] w-[8px] rounded-full bg-primary-default/50" /> 工具调用</span>
                    <span className="flex items-center gap-[8px]"><span className="h-[8px] w-[8px] rounded-full bg-status-success/50" /> 知识检索</span>
                  </div>
                </section>

                {/* 底部标签页 */}
                <section className="flex flex-1 flex-col overflow-hidden rounded-[8px] border border-border-default bg-bg-elevated">
                  <div className="flex items-center border-b border-border-subtle bg-bg-subtle px-[12px]">
                    {/* [Prep-02] 修复 #2: tab 按钮补齐 focus 态 */}
                    <button
                      onClick={() => setActiveTab('input')}
                      className={`px-[12px] py-[12px] text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-default/40 ${activeTab === 'input' ? 'text-primary-default border-b-2 border-primary-default' : 'text-fg-secondary hover:text-fg-default'}`}
                    >
                      输入参数
                    </button>
                    <button
                      onClick={() => setActiveTab('output')}
                      className={`px-[12px] py-[12px] text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-default/40 ${activeTab === 'output' ? 'text-primary-default border-b-2 border-primary-default' : 'text-fg-secondary hover:text-fg-default'}`}
                    >
                      执行结果
                    </button>
                    <button
                      onClick={() => setActiveTab('metadata')}
                      className={`px-[12px] py-[12px] text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-default/40 ${activeTab === 'metadata' ? 'text-primary-default border-b-2 border-primary-default' : 'text-fg-secondary hover:text-fg-default'}`}
                    >
                      元数据
                    </button>
                  </div>
                  <div className="flex-1 overflow-auto p-[16px] bg-bg-base font-mono text-[13px] leading-relaxed text-fg-default">
                    {activeTab === 'input' && (
                      <pre className="whitespace-pre-wrap">{JSON.stringify({ prompt: activeRun.input, temperature: 0.7, max_tokens: 2048 }, null, 2)}</pre>
                    )}
                    {activeTab === 'output' && (
                      <pre className="whitespace-pre-wrap">{activeRun.output}</pre>
                    )}
                    {activeTab === 'metadata' && (
                      <pre className="whitespace-pre-wrap">{JSON.stringify({
                        id: activeRun.id,
                        model: 'gpt-4o-2024-05-13',
                        provider: 'OpenAI',
                        total_tokens: 1458,
                        prompt_tokens: 230,
                        completion_tokens: 1228,
                        latency_ms: parseFloat(activeRun.duration) * 1000
                      }, null, 2)}</pre>
                    )}
                  </div>
                </section>
              </div>
            </>
          ) : !isLoading && !hasData ? (
            // [Prep-02] 修复 #3: 主区空态
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <ClockIllustration />
              <p className="mt-[16px] mb-[16px] text-[15px] font-medium text-fg-secondary">还没有运行过 Agent</p>
              <Button asChild>
                <Link to="/gallery">去商店看看</Link>
              </Button>
            </div>
          ) : (
            // 加载态
            <div className="flex flex-1 items-center justify-center">
              <div className="flex items-center gap-[8px] text-[14px] text-fg-secondary">
                <div className="h-[16px] w-[16px] animate-spin rounded-full border-2 border-primary-default border-t-transparent" />
                加载中…
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}