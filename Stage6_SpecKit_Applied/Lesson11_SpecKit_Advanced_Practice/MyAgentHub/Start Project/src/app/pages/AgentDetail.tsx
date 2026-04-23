import React, { useState } from 'react';
import { useParams, Link } from 'react-router';
import { ChevronRight, Play, Settings2, Plus, Terminal, RefreshCw, MessageSquare } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { AGENTS } from '../lib/mock-data';

// [Prep-02] 修复 #3: Playground 三点跳动加载动画
function ThinkingDots() {
  return (
    <div className="flex items-center gap-[8px] px-[16px] py-[12px]">
      <span className="text-[13px] text-fg-secondary">思考中</span>
      <span className="flex gap-[4px]">
        <span className="h-[6px] w-[6px] rounded-full bg-primary-default animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="h-[6px] w-[6px] rounded-full bg-primary-default animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="h-[6px] w-[6px] rounded-full bg-primary-default animate-bounce" style={{ animationDelay: '300ms' }} />
      </span>
    </div>
  );
}

export default function AgentDetail() {
  const { id } = useParams();
  const agent = AGENTS.find(a => a.id === id) || AGENTS[0];

  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [output, setOutput] = useState('');

  const handleSend = () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setOutput('');

    let i = 0;
    const text = '这是一段流式生成的测试返回内容。由于你没有连接真实的后端，这只是一段预设的回复。根据你的输入，Agent 已经开始处理并返回结果了。在真实的业务场景下，这里会呈现 Generative UI 组件或具体的 JSON 格式化数据...马上好...';

    const interval = setInterval(() => {
      setOutput(prev => prev + text.charAt(i));
      i++;
      if (i >= text.length) {
        clearInterval(interval);
        setIsGenerating(false);
      }
    }, 50);
  };

  return (
    <div className="flex flex-1 flex-col bg-bg-base">
      <div className="mx-auto flex w-full max-w-[1280px] flex-col px-[24px] py-[20px]">
        {/* [Prep-02] 修复 #5: 面包屑 Gallery → 商店 */}
        <nav className="mb-[20px] flex items-center text-[13px] text-fg-muted">
          <Link to="/gallery" className="hover:text-primary-default transition-colors">商店</Link>
          <ChevronRight className="mx-[8px] h-[12px] w-[12px]" />
          <span>{agent.category}</span>
          <ChevronRight className="mx-[8px] h-[12px] w-[12px]" />
          <span className="font-medium text-fg-default">{agent.name}</span>
        </nav>

        {/* [Prep-02] 修复 #4: md 下从左右并排变上下堆叠，Playground 在下 */}
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
                      <Badge key={cap} variant="secondary" className="bg-bg-elevated px-[8px] py-[4px] text-[12px]">
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
                <Button className="w-full font-medium">
                  <Plus className="mr-[8px] h-[16px] w-[16px]" />
                  添加到我的 Agent
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
                  {/* [Prep-02] 修复 #2: select 补齐 focus 态 */}
                  <select className="h-[28px] rounded-[8px] border border-border-default bg-bg-base px-[8px] text-[12px] text-fg-default focus:outline-none focus:ring-2 focus:ring-primary-default/40 focus:ring-offset-2">
                    <option>GPT-4o</option>
                    <option>Claude 3.5 Sonnet</option>
                    <option>Gemini 1.5 Pro</option>
                  </select>
                </div>
                <div className="flex items-center gap-[8px] pl-[12px] border-l border-border-subtle">
                  <span className="text-[12px] font-medium text-fg-secondary">温度</span>
                  <input type="range" min="0" max="2" step="0.1" defaultValue="0.7" className="w-[60px] accent-primary-default" />
                  <span className="text-[12px] font-mono text-fg-default w-[24px]">0.7</span>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-[28px] w-[28px] text-fg-secondary">
                <Settings2 className="h-[14px] w-[14px]" />
              </Button>
            </div>

            {/* 输出区 */}
            <div className="flex-1 overflow-auto p-[20px] bg-bg-base">
              {output || isGenerating ? (
                <div className="flex gap-[12px]">
                  <div className="mt-[4px] flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-[8px] bg-primary-default/10">
                    <Terminal className="h-[14px] w-[14px] text-primary-default" />
                  </div>
                  <div className="flex-1 space-y-[12px]">
                    {/* [Prep-02] 修复 #3: 加载态顶部显示"思考中" */}
                    {isGenerating && !output && <ThinkingDots />}
                    {output && (
                      <div className="rounded-[8px] bg-bg-subtle p-[12px] text-[13px] leading-relaxed text-fg-default border border-border-default">
                        {output}
                        {isGenerating && <span className="ml-[4px] inline-block h-[12px] w-[6px] animate-pulse bg-primary-default align-middle" />}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                // [Prep-02] 修复 #3: 初始空态
                <div className="flex h-full flex-col items-center justify-center text-center text-fg-muted">
                  <MessageSquare className="mb-[12px] h-[40px] w-[40px] stroke-1" />
                  <p className="text-[14px] font-medium text-fg-secondary">试着问点什么...</p>
                  <p className="mt-[4px] text-[12px]">输入你想让 Agent 做的事，开始对话。</p>
                </div>
              )}
            </div>

            {/* 输入区 */}
            <div className="border-t border-border-subtle bg-bg-subtle p-[16px]">
              <div className="relative rounded-[8px] border border-border-default bg-bg-base focus-within:border-primary-default focus-within:ring-1 focus-within:ring-primary-default transition-all">
                <textarea
                  className="w-full resize-none bg-transparent px-[12px] py-[12px] text-[13px] text-fg-default placeholder-fg-muted focus:outline-none min-h-[80px]"
                  placeholder="输入你想让 Agent 做的事…"
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                />
                <div className="absolute bottom-[12px] right-[12px] flex items-center gap-[12px]">
                  <span className="text-[12px] font-mono text-fg-muted">
                    Token 预估: {prompt.length > 0 ? (prompt.length * 1.5).toFixed(0) : 0}
                  </span>
                  <Button
                    size="sm"
                    className="h-[28px] px-[12px] font-medium gap-[8px]"
                    onClick={handleSend}
                    disabled={isGenerating || !prompt.trim()}
                  >
                    {isGenerating ? (
                      <RefreshCw className="h-[12px] w-[12px] animate-spin" />
                    ) : (
                      <Play className="h-[12px] w-[12px]" fill="currentColor" />
                    )}
                    发送
                  </Button>
                </div>
              </div>
            </div>
          </main>
        </div>

        {/* [Prep-02] 修复 #1: 底部相似 Agent 间距压缩 */}
        <div className="mt-[48px] pt-[24px] border-t border-border-default">
          <h2 className="mb-[16px] text-[18px] font-semibold text-fg-default">相似精选 Agent</h2>
          <div className="grid grid-cols-1 gap-[16px] sm:grid-cols-2 lg:grid-cols-4">
            {AGENTS.slice(1, 5).map(a => (
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