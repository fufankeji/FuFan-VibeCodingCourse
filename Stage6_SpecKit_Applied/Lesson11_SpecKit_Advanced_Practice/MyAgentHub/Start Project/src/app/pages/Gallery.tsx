import React, { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Search, SlidersHorizontal, ChevronLeft, ChevronRight, Terminal } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { AGENTS, CATEGORIES, PROVIDERS } from '../lib/mock-data';

// [Prep-02] 修复 #3: 骨架屏卡片组件
function SkeletonCard() {
  return (
    <div className="flex flex-col rounded-[8px] border border-border-default bg-bg-subtle p-[16px] shadow-sm">
      <div className="flex items-start justify-between mb-[12px]">
        <div className="h-[36px] w-[36px] animate-pulse rounded-[8px] bg-bg-elevated" />
        <div className="h-[24px] w-[48px] animate-pulse rounded-full bg-bg-elevated" />
      </div>
      <div className="h-[16px] w-[60%] animate-pulse rounded bg-bg-elevated mb-[8px]" />
      <div className="h-[14px] w-full animate-pulse rounded bg-bg-elevated mb-[4px]" />
      <div className="h-[14px] w-[80%] animate-pulse rounded bg-bg-elevated mb-[16px]" />
      <div className="flex gap-[4px] mb-[16px]">
        <div className="h-[20px] w-[48px] animate-pulse rounded-full bg-bg-elevated" />
        <div className="h-[20px] w-[56px] animate-pulse rounded-full bg-bg-elevated" />
      </div>
      <div className="flex items-center justify-between border-t border-border-subtle pt-[12px]">
        <div className="h-[14px] w-[40px] animate-pulse rounded bg-bg-elevated" />
        <div className="h-[32px] w-[100px] animate-pulse rounded-[8px] bg-bg-elevated" />
      </div>
    </div>
  );
}

// [Prep-02] 修复 #3: 望远镜 SVG 线条插画
function TelescopeIllustration() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-fg-muted">
      <circle cx="22" cy="18" r="10" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="22" cy="18" r="4" stroke="currentColor" strokeWidth="1.5" />
      <line x1="29" y1="25" x2="48" y2="52" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="15" y1="25" x2="10" y2="52" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="22" y1="28" x2="30" y2="52" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="6" y1="52" x2="52" y2="52" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default function Gallery() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('');
  // [Prep-02] 修复 #3: 模拟加载态
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  const filteredAgents = AGENTS.filter(a => {
    if (activeCategory && a.category !== activeCategory) return false;
    if (searchTerm && !a.name.includes(searchTerm) && !a.description.includes(searchTerm)) return false;
    return true;
  });

  return (
    <div className="flex flex-1 flex-col">
      {/* [Prep-02] 修复 #1: 搜索栏高度从 56 缩至 40 */}
      <div className="border-b border-border-subtle bg-bg-base px-[24px] py-[16px]">
        <div className="mx-auto max-w-[800px] relative">
          <Search className="absolute left-[12px] top-1/2 h-[16px] w-[16px] -translate-y-1/2 text-fg-muted" />
          <Input
            className="h-[40px] pl-[36px] text-[14px] rounded-[8px] bg-bg-subtle border-border-default focus-visible:ring-primary-default"
            placeholder="搜索 Agent 名称、能力、作者…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* [Prep-02] 修复 #1: 间距压缩 */}
      <div className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-[24px] px-[24px] py-[24px] md:flex-row">
        {/* 左侧筛选面板 */}
        <aside className="w-full shrink-0 md:w-[200px]">
          <div className="sticky top-[80px] flex flex-col gap-[24px]">
            <div className="flex items-center gap-[8px] text-[14px] font-semibold text-fg-default">
              <SlidersHorizontal className="h-[16px] w-[16px]" />
              筛选器
            </div>

            <div className="flex flex-col gap-[12px]">
              <h3 className="text-[13px] font-medium text-fg-secondary">分类</h3>
              <div className="flex flex-col gap-[4px]">
                {/* [Prep-02] 修复 #2: 筛选按钮补齐 focus 态 */}
                <button
                  className={`flex items-center justify-between rounded-[8px] px-[12px] py-[8px] text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-default/40 focus-visible:ring-offset-2 ${!activeCategory ? 'bg-primary-default/10 text-primary-default font-medium' : 'text-fg-default hover:bg-bg-subtle'}`}
                  onClick={() => setActiveCategory('')}
                >
                  全部
                </button>
                {CATEGORIES.slice(0, 10).map(cat => (
                  <button
                    key={cat}
                    className={`flex items-center justify-between rounded-[8px] px-[12px] py-[8px] text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-default/40 focus-visible:ring-offset-2 ${activeCategory === cat ? 'bg-primary-default/10 text-primary-default font-medium' : 'text-fg-default hover:bg-bg-subtle'}`}
                    onClick={() => setActiveCategory(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-[12px]">
              <h3 className="text-[13px] font-medium text-fg-secondary">提供商</h3>
              <div className="flex flex-col gap-[8px]">
                {PROVIDERS.map(provider => (
                  <label key={provider} className="flex items-center gap-[8px] cursor-pointer">
                    <input type="checkbox" className="h-[14px] w-[14px] rounded-[4px] border-border-strong bg-bg-base text-primary-default accent-primary-default" />
                    <span className="text-[13px] text-fg-default">{provider}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-[12px]">
              <h3 className="text-[13px] font-medium text-fg-secondary">能力</h3>
              <div className="flex flex-wrap gap-[8px]">
                {['代码生成', '数据分析', '视觉分析', '文本总结', '知识库'].map(cap => (
                  <Badge key={cap} variant="secondary" className="px-[8px] py-0 text-[12px]">
                    {cap}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* 右侧主区 */}
        <main className="flex-1 pb-[32px]">
          <div className="mb-[16px] flex items-center justify-between">
            <span className="text-[13px] text-fg-secondary">共找到 {filteredAgents.length} 个 Agent</span>
          </div>

          {/* [Prep-02] 修复 #3: 加载态骨架屏 6 张 */}
          {isLoading ? (
            <div className="grid grid-cols-1 gap-[16px] md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : filteredAgents.length === 0 ? (
            // [Prep-02] 修复 #3: 空态 SVG 望远镜 + 引导文案
            <div className="flex h-[300px] flex-col items-center justify-center rounded-[8px] border border-dashed border-border-strong bg-bg-base text-center">
              <TelescopeIllustration />
              <p className="mt-[16px] mb-[16px] text-[15px] font-medium text-fg-secondary">没找到匹配的 Agent</p>
              <Button variant="outline" onClick={() => { setSearchTerm(''); setActiveCategory(''); }}>清除筛选</Button>
            </div>
          ) : (
            // [Prep-02] 修复 #4: md 2列，lg 3列
            <div className="grid grid-cols-1 gap-[16px] md:grid-cols-2 lg:grid-cols-3">
              {filteredAgents.map(agent => (
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
                      <Link to={`/agent/${agent.id}`}>打开 Playground</Link>
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}

          {!isLoading && filteredAgents.length > 0 && (
            <div className="mt-[32px] flex items-center justify-center gap-[12px]">
              <Button variant="outline" size="icon" disabled><ChevronLeft className="h-[16px] w-[16px]" /></Button>
              <span className="text-[13px] text-fg-secondary">第 1 页，共 3 页</span>
              <Button variant="outline" size="icon"><ChevronRight className="h-[16px] w-[16px]" /></Button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}