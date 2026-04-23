import Link from 'next/link';
import { ArrowRight, Terminal, BarChart, Activity, Zap, Layers, Server } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ParticleBackground } from '@/components/particle-background';
import { AGENTS } from '@/lib/mock-data';

export default function Landing() {
  return (
    <div className="flex flex-col">
      {/* [Prep-02] 修复 #1: Hero 区 py 压缩至 48/64，max-h-[60vh] */}
      <section className="relative flex max-h-[60vh] flex-col items-center justify-center overflow-hidden px-[24px] py-[48px] text-center md:py-[64px]">
        <ParticleBackground />
        <div className="relative z-10 flex flex-col items-center">
          <Badge variant="outline" className="mb-[16px]">AgentHub 2.0 现已发布</Badge>
          {/* [Prep-02] 修复 #1: 标题 30/36px 符合规范 */}
          <h1 className="mb-[16px] max-w-[800px] text-[30px] font-bold leading-tight tracking-tight text-fg-default md:text-[36px]">
            下一代 <span className="text-primary-default">AI Agent</span><br />
            构建、编排与分发平台
          </h1>
          <p className="mb-[24px] max-w-[600px] text-[15px] text-fg-secondary md:text-[16px]">
            为专业开发者设计的高性能工具。从零开始构建你的 AI 业务逻辑，或直接探索并集成社区的精选 Agent。
          </p>
          <div className="flex flex-col items-center gap-[12px] sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/gallery">
                浏览 Agent 商店
                <ArrowRight className="ml-[8px] h-[16px] w-[16px]" />
              </Link>
            </Button>
            <Button variant="secondary" size="lg" asChild>
              <Link href="/docs">查看文档</Link>
            </Button>
          </div>
          <p className="mt-[12px] text-[13px] text-fg-muted">
            在线演示，无需注册
          </p>
        </div>
      </section>

      {/* [Prep-02] 修复 #1: section py 从 64 压缩，卡片间距缩小 */}
      <section className="border-t border-border-default bg-bg-subtle px-[24px] py-[48px]">
        <div className="mx-auto max-w-[1280px]">
          <div className="mb-[24px] flex items-end justify-between">
            <div>
              <h2 className="text-[24px] font-semibold text-fg-default">精选 Agent</h2>
              <p className="mt-[4px] text-[14px] text-fg-secondary">立即集成，加速你的 AI 应用开发。</p>
            </div>
            <Button variant="ghost" asChild>
              <Link href="/gallery">查看全部 <ArrowRight className="ml-[4px] h-[16px] w-[16px]" /></Link>
            </Button>
          </div>
          {/* [Prep-02] 修复 #1: gap 从 24 缩至 16，md 2列 lg 3列 */}
          <div className="grid grid-cols-1 gap-[16px] md:grid-cols-2 lg:grid-cols-3">
            {AGENTS.slice(0, 6).map((agent) => (
              // [Prep-02] 修复 #2: Card hover 去掉 translate/shadow，已由 Card 组件统一处理
              <Card key={agent.id} className="flex flex-col">
                <CardHeader className="p-[16px] pb-[12px]">
                  <div className="flex items-start justify-between">
                    <div className="flex h-[36px] w-[36px] items-center justify-center rounded-[8px] bg-bg-elevated">
                      <Terminal className="h-[18px] w-[18px] text-primary-default" />
                    </div>
                    <Badge variant="outline">{agent.category}</Badge>
                  </div>
                  <CardTitle className="mt-[12px] text-[15px]">{agent.name}</CardTitle>
                  <CardDescription className="line-clamp-2 min-h-[36px] text-[13px]">{agent.description}</CardDescription>
                </CardHeader>
                <CardContent className="mt-auto px-[16px] pb-[12px] pt-0">
                  <div className="flex flex-wrap gap-[4px]">
                    {agent.capabilities.map((cap) => (
                      <Badge key={cap} variant="secondary" className="px-[8px] py-0 text-[12px]">
                        {cap}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
                <CardFooter className="flex items-center justify-between border-t border-border-subtle px-[16px] py-[12px]">
                  <span className="text-[14px] font-medium text-fg-default">{agent.price}</span>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/agent/${agent.id}`}>打开 Playground</Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* [Prep-02] 修复 #1: Value Props py 压缩 */}
      <section className="bg-bg-base px-[24px] py-[48px]">
        <div className="mx-auto max-w-[1280px]">
          <div className="grid grid-cols-1 gap-[24px] md:grid-cols-3">
            <div className="flex flex-col gap-[12px]">
              <div className="flex h-[40px] w-[40px] items-center justify-center rounded-full bg-primary-default/10 text-primary-default">
                <Zap className="h-[20px] w-[20px]" />
              </div>
              <h3 className="text-[18px] font-semibold text-fg-default">生成式 UI 流式渲染</h3>
              <p className="text-[14px] leading-relaxed text-fg-secondary">
                支持 React Server Components 和流式传输，在终端用户看到第一个 Token 时即可渲染复杂的 UI 交互界面。
              </p>
            </div>
            <div className="flex flex-col gap-[12px]">
              <div className="flex h-[40px] w-[40px] items-center justify-center rounded-full bg-status-warning/10 text-status-warning">
                <BarChart className="h-[20px] w-[20px]" />
              </div>
              <h3 className="text-[18px] font-semibold text-fg-default">Token 用量事前预估</h3>
              <p className="text-[14px] leading-relaxed text-fg-secondary">
                基于输入 prompt 和工具链的静态分析，在执行前给出精准的 Token 消耗和成本预估。
              </p>
            </div>
            <div className="flex flex-col gap-[12px]">
              <div className="flex h-[40px] w-[40px] items-center justify-center rounded-full bg-status-success/10 text-status-success">
                <Activity className="h-[20px] w-[20px]" />
              </div>
              <h3 className="text-[18px] font-semibold text-fg-default">Trace 执行瀑布图</h3>
              <p className="text-[14px] leading-relaxed text-fg-secondary">
                生产级可观测性。每一条大模型调用、工具执行、检索耗时都以毫秒级瀑布图呈现。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* [Prep-02] 修复 #1: Stats py 从 48 缩至 32，数字从 36 缩至 30 */}
      <section className="border-y border-border-default bg-bg-elevated px-[24px] py-[32px]">
        <div className="mx-auto grid max-w-[1024px] grid-cols-2 gap-[24px] md:grid-cols-4">
          <div className="flex flex-col items-center gap-[4px] text-center">
            <span className="text-[30px] font-bold text-fg-default">500+</span>
            <span className="text-[13px] text-fg-secondary">个 Agent</span>
          </div>
          <div className="flex flex-col items-center gap-[4px] text-center">
            <span className="text-[30px] font-bold text-fg-default">1 万+</span>
            <span className="text-[13px] text-fg-secondary">开发者</span>
          </div>
          <div className="flex flex-col items-center gap-[4px] text-center">
            <span className="text-[30px] font-bold text-fg-default">5000 万+</span>
            <span className="text-[13px] text-fg-secondary">次运行</span>
          </div>
          <div className="flex flex-col items-center gap-[4px] text-center">
            <span className="text-[30px] font-bold text-fg-default">99.9%</span>
            <span className="text-[13px] text-fg-secondary">可用性</span>
          </div>
        </div>
      </section>
    </div>
  );
}