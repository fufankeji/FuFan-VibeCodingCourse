import React, { useState } from 'react';
import { Plus, Play, Save, Settings2, Box, Database, Code2, Link as LinkIcon, Move, ZoomIn, ZoomOut, Maximize, CircleDashed } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';

export default function Pipeline() {
  const [selectedNode, setSelectedNode] = useState<string | null>('node-3');

  const nodes = [
    { id: 'node-1', type: 'trigger', name: 'HTTP 触发器', x: 100, y: 200, icon: LinkIcon, status: 'success' },
    { id: 'node-2', type: 'retriever', name: '知识库检索', x: 400, y: 100, icon: Database, status: 'idle' },
    { id: 'node-3', type: 'llm', name: '大模型生成', x: 400, y: 300, icon: Box, status: 'active' },
    { id: 'node-4', type: 'tool', name: '代码解析器', x: 700, y: 300, icon: Code2, status: 'idle' },
    { id: 'node-5', type: 'output', name: '最终输出', x: 1000, y: 200, icon: CircleDashed, status: 'idle' },
  ];

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col bg-bg-base overflow-hidden">
      {/* [Prep-02] 修复 #1: 顶部工具栏高度从 56 缩至 48 */}
      <header className="flex h-[48px] items-center justify-between border-b border-border-default bg-bg-subtle px-[20px] shrink-0">
        <div className="flex items-center gap-[16px]">
          <h1 className="text-[16px] font-semibold text-fg-default">工作流编排</h1>
          <Badge variant="outline" className="text-[12px]">未保存更改</Badge>
        </div>
        <div className="flex items-center gap-[12px]">
          <Button variant="secondary" size="sm">
            <Plus className="mr-[8px] h-[14px] w-[14px]" /> 添加节点
          </Button>
          <Button variant="outline" size="sm">
            <Save className="mr-[8px] h-[14px] w-[14px]" /> 保存
          </Button>
          <div className="h-[24px] w-px bg-border-strong mx-[8px]"></div>
          <Button size="sm">
            <Play className="mr-[8px] h-[14px] w-[14px]" fill="currentColor" /> 运行
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* 主区：节点画布 */}
        <main className="flex-1 relative bg-bg-base overflow-hidden">
          {/* 画布控制区 */}
          <div className="absolute bottom-[24px] left-[24px] flex items-center gap-[8px] rounded-[8px] border border-border-default bg-bg-elevated p-[8px] shadow-sm">
            <Button variant="ghost" size="icon" className="h-[28px] w-[28px]"><ZoomOut className="h-[14px] w-[14px]" /></Button>
            <span className="text-[12px] font-mono w-[48px] text-center">100%</span>
            <Button variant="ghost" size="icon" className="h-[28px] w-[28px]"><ZoomIn className="h-[14px] w-[14px]" /></Button>
            <div className="h-[16px] w-px bg-border-strong mx-[4px]"></div>
            <Button variant="ghost" size="icon" className="h-[28px] w-[28px]"><Maximize className="h-[14px] w-[14px]" /></Button>
            <Button variant="ghost" size="icon" className="h-[28px] w-[28px]"><Move className="h-[14px] w-[14px]" /></Button>
          </div>

          {/* SVG 连线 */}
          <svg className="absolute inset-0 pointer-events-none w-full h-full">
            <path d="M 280 240 C 340 240, 340 140, 400 140" fill="none" stroke="var(--border-strong)" strokeWidth="2" />
            <path d="M 280 240 C 340 240, 340 340, 400 340" fill="none" stroke="var(--border-strong)" strokeWidth="2" />
            <path d="M 580 340 C 640 340, 640 340, 700 340" fill="none" stroke="var(--border-strong)" strokeWidth="2" strokeDasharray="5,5" className="animate-[dash_1s_linear_infinite]" />
            <path d="M 580 140 C 740 140, 840 240, 1000 240" fill="none" stroke="var(--border-strong)" strokeWidth="2" />
            <path d="M 880 340 C 940 340, 940 240, 1000 240" fill="none" stroke="var(--border-strong)" strokeWidth="2" />
          </svg>

          {/* 节点 */}
          {nodes.map((node) => {
            const Icon = node.icon;
            const isSelected = selectedNode === node.id;
            return (
              <div 
                key={node.id}
                onClick={() => setSelectedNode(node.id)}
                className={`absolute w-[180px] cursor-pointer rounded-[8px] border bg-bg-subtle p-[16px] shadow-sm transition-all ${
                  isSelected ? 'border-primary-default ring-2 ring-primary-default/20' : 'border-border-default hover:border-primary-default/50'
                }`}
                style={{ transform: `translate(${node.x}px, ${node.y}px)` }}
              >
                <div className="flex items-center justify-between mb-[12px]">
                  <div className={`flex h-[24px] w-[24px] items-center justify-center rounded-[8px] ${
                    node.type === 'trigger' ? 'bg-primary-default/10 text-primary-default' :
                    node.type === 'llm' ? 'bg-status-warning/10 text-status-warning' :
                    'bg-bg-elevated text-fg-secondary'
                  }`}>
                    <Icon className="h-[14px] w-[14px]" />
                  </div>
                  {node.status === 'active' && <span className="flex h-[8px] w-[8px] relative rounded-full bg-status-warning"><span className="animate-ping absolute inset-0 rounded-full bg-status-warning opacity-75"></span></span>}
                  {node.status === 'success' && <span className="h-[8px] w-[8px] rounded-full bg-status-success"></span>}
                </div>
                <h3 className="text-[14px] font-medium text-fg-default">{node.name}</h3>
                <p className="mt-[4px] text-[12px] text-fg-muted">{node.type}</p>
                
                {/* 连线端点 */}
                <div className="absolute -left-[6px] top-1/2 h-[12px] w-[12px] -translate-y-1/2 rounded-full border-2 border-border-default bg-bg-base" />
                <div className="absolute -right-[6px] top-1/2 h-[12px] w-[12px] -translate-y-1/2 rounded-full border-2 border-border-default bg-bg-base" />
              </div>
            );
          })}
        </main>

        {/* 右侧：属性面板 */}
        <aside className="w-[320px] border-l border-border-default bg-bg-subtle flex flex-col shrink-0">
          <div className="flex h-[48px] items-center border-b border-border-default px-[16px]">
            <h2 className="text-[14px] font-semibold text-fg-default flex items-center gap-[8px]">
              <Settings2 className="h-[16px] w-[16px]" />
              节点属性
            </h2>
          </div>
          
          {selectedNode ? (
            <div className="flex-1 overflow-y-auto p-[20px] flex flex-col gap-[24px]">
              <div className="flex flex-col gap-[8px]">
                <label className="text-[13px] font-medium text-fg-secondary">节点名称</label>
                <Input defaultValue={nodes.find(n => n.id === selectedNode)?.name} className="h-[32px] text-[13px]" />
              </div>
              
              {nodes.find(n => n.id === selectedNode)?.type === 'llm' && (
                <>
                  <div className="flex flex-col gap-[8px]">
                    <label className="text-[13px] font-medium text-fg-secondary">模型提供商</label>
                    <select className="h-[32px] w-full rounded-[8px] border border-border-default bg-bg-base px-[12px] text-[13px] text-fg-default focus:outline-none focus:ring-1 focus:ring-primary-default">
                      <option>OpenAI</option>
                      <option>Anthropic</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-[8px]">
                    <label className="text-[13px] font-medium text-fg-secondary">Prompt 模板</label>
                    <textarea 
                      className="min-h-[160px] w-full rounded-[8px] border border-border-default bg-bg-base p-[12px] text-[13px] font-mono text-fg-default placeholder-fg-muted focus:border-primary-default focus:outline-none focus:ring-1 focus:ring-primary-default"
                      defaultValue="你是一个专业的代码审查助手。请仔细阅读以下代码，并指出可能存在的逻辑漏洞和性能问题：\n\n{{input_code}}"
                    />
                  </div>
                  <div className="flex flex-col gap-[8px]">
                    <div className="flex justify-between items-center">
                      <label className="text-[13px] font-medium text-fg-secondary">Temperature</label>
                      <span className="text-[12px] text-fg-muted font-mono">0.7</span>
                    </div>
                    <input type="range" min="0" max="2" step="0.1" defaultValue="0.7" className="w-full accent-primary-default" />
                  </div>
                </>
              )}

              <Button variant="outline" className="mt-auto border-status-error/50 text-status-error hover:bg-status-error/10 hover:border-status-error">
                删除此节点
              </Button>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center p-[20px] text-center">
              <p className="text-[13px] text-fg-secondary">请在左侧画布选择一个节点以编辑属性</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}