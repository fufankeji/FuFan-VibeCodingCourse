import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Send, Plus, ChevronRight, Clock, ExternalLink, Info } from 'lucide-react';
import { toast } from 'sonner';
import { useAppState, type ChatMessage, type ToolCall } from '../../store';
import { api, ApiError } from '../../api';
import { TYPE_COLORS } from '../../mock-data';

export function QAChat() {
  const { messages, setMessages, chatHistory, suggestedPrompts, nodes, refreshHistory } = useAppState();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [conversationHistory, setConversationHistory] = useState<{ question: string; answer: string }[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const q = searchParams.get('q');
    if (q) {
      setInput(q);
      inputRef.current?.focus();
    }
  }, [searchParams]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  // Build cited node objects from node IDs using local KG
  function resolveCitedNodes(ids: string[]) {
    return ids
      .map(id => {
        const n = nodes.find(n => n.id === id);
        return n ? { id: n.id, name: n.name, type: n.type } : null;
      })
      .filter(Boolean) as { id: string; name: string; type: string }[];
  }

  const handleSend = async () => {
    if (!input.trim() || isThinking) return;
    const question = input.trim();
    setInput('');
    setIsThinking(true);

    const userMsg: ChatMessage = {
      id: `m${Date.now()}`,
      role: 'human',
      content: question,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);

    try {
      const result = await api.query(question, conversationHistory);
      const aiMsg: ChatMessage = {
        id: result.id ?? `m${Date.now() + 1}`,
        role: 'ai',
        content: result.answer,
        timestamp: result.timestamp ?? new Date().toISOString(),
        toolCalls: result.tool_calls.map((tc, i) => ({
          step: tc.step ?? i + 1,
          tool: tc.tool_name,
          input: tc.tool_input,
          output: tc.tool_output,
        })),
        citedNodes: resolveCitedNodes(result.cited_nodes ?? []),
        duration: result.duration_seconds,
      };
      setMessages(prev => [...prev, aiMsg]);
      setConversationHistory(prev => [...prev, { question, answer: result.answer }]);
      // Refresh history sidebar
      refreshHistory();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : '问答服务异常';
      toast.error(msg);
      setMessages(prev => [...prev, {
        id: `err${Date.now()}`,
        role: 'ai',
        content: `⚠️ 请求失败：${msg}\n\n请确认：\n1. 后端服务已启动（localhost:8000）\n2. 知识图谱已有数据（请先上传并索引文档）\n3. DeepSeek API Key 已配置`,
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setInput('');
    setActiveHistoryId(null);
    setConversationHistory([]);
  };

  // Load a history item as a single Q&A session
  const handleLoadHistory = (h: typeof chatHistory[0]) => {
    setActiveHistoryId(h.id);
    const msgs: ChatMessage[] = [
      { id: `${h.id}-q`, role: 'human', content: h.question, timestamp: h.timestamp },
      {
        id: `${h.id}-a`, role: 'ai', content: h.answer, timestamp: h.timestamp,
        toolCalls: h.toolCalls,
        citedNodes: resolveCitedNodes(h.citedNodeIds ?? []),
        duration: h.duration,
      },
    ];
    setMessages(msgs);
    setConversationHistory([{ question: h.question, answer: h.answer }]);
  };

  const groupedHistory = {
    '今天': chatHistory.filter(h => h.group === '今天'),
    '昨天': chatHistory.filter(h => h.group === '昨天'),
    '更早': chatHistory.filter(h => h.group === '更早'),
  };

  return (
    <div className="flex h-full" style={{ background: 'var(--bg-base)' }}>
      {/* History Sidebar */}
      <div
        className="flex flex-col"
        style={{ width: 240, background: 'var(--bg-s1)', borderRight: '1px solid var(--border-main)', flexShrink: 0 }}
      >
        <div className="p-3">
          <button
            onClick={handleNewChat}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-md cursor-pointer"
            style={{ background: 'var(--bg-s2)', border: '1px solid var(--border-main)', color: 'var(--text-2)', fontSize: 13 }}
          >
            <Plus size={14} /> 新对话
          </button>
        </div>

        {/* 历史会话管理说明 */}
        <div className="mx-3 mb-2 px-2 py-1.5 rounded-md flex items-start gap-1.5" style={{ background: 'rgba(88,166,255,0.08)', border: '1px solid rgba(88,166,255,0.2)' }}>
          <Info size={11} style={{ color: 'var(--blue)', flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 10, color: 'var(--text-4)', lineHeight: 1.4 }}>
            点击历史记录查看单条问答；多轮对话会话管理
            <span style={{ background: 'rgba(248,81,73,0.15)', color: '#f85149', padding: '0 3px', borderRadius: 2, marginLeft: 2 }}>未开发</span>
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-2">
          {Object.entries(groupedHistory).map(([group, items]) => items.length > 0 && (
            <div key={group} className="mb-3">
              <div className="px-2 py-1" style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {group}
              </div>
              {items.map(h => (
                <button
                  key={h.id}
                  onClick={() => handleLoadHistory(h)}
                  className="w-full text-left px-2 py-1.5 rounded cursor-pointer truncate block"
                  style={{
                    background: activeHistoryId === h.id ? 'var(--bg-s2)' : 'transparent',
                    color: activeHistoryId === h.id ? 'var(--text-1)' : 'var(--text-3)',
                    fontSize: 12, border: 'none',
                  }}
                >
                  {h.question.length > 28 ? h.question.slice(0, 28) + '...' : h.question}
                </button>
              ))}
            </div>
          ))}
          {chatHistory.length === 0 && (
            <div className="px-2 py-4 text-center" style={{ color: 'var(--text-4)', fontSize: 12 }}>暂无历史记录</div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div style={{ fontSize: 32 }}>
                <span style={{ color: 'var(--blue)' }}>GraphRAG</span>{' '}
                <span style={{ color: 'var(--text-3)' }}>Studio</span>
              </div>
              <p style={{ color: 'var(--text-3)', fontSize: 14, textAlign: 'center', maxWidth: 500 }}>
                向知识图谱提问。我将使用多步推理从已索引的文档中为您找到准确答案。
              </p>
              <div className="grid grid-cols-2 gap-3 mt-4" style={{ maxWidth: 600, width: '100%' }}>
                {suggestedPrompts.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(p)}
                    className="text-left p-3 rounded-lg cursor-pointer"
                    style={{ background: 'var(--bg-s1)', border: '1px solid var(--border-main)', color: 'var(--text-2)', fontSize: 13 }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4 max-w-3xl mx-auto">
              {messages.map(msg => (
                <div key={msg.id}>
                  {msg.role === 'human' ? (
                    <div className="flex justify-end">
                      <div
                        className="rounded-lg px-4 py-3"
                        style={{ background: 'rgba(88,166,255,0.15)', color: 'var(--text-1)', fontSize: 14, maxWidth: '80%', lineHeight: 1.6 }}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-start">
                      <div
                        className="rounded-lg px-4 py-3"
                        style={{ background: 'var(--bg-s1)', border: '1px solid var(--border-main)', color: 'var(--text-2)', fontSize: 14, maxWidth: '90%', lineHeight: 1.6 }}
                      >
                        <div
                          style={{ whiteSpace: 'pre-wrap' }}
                          dangerouslySetInnerHTML={{ __html: renderSimpleMarkdown(msg.content) }}
                        />

                        {msg.toolCalls && msg.toolCalls.length > 0 && (
                          <ToolCallPanel toolCalls={msg.toolCalls} />
                        )}

                        {msg.citedNodes && msg.citedNodes.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-3 pt-3" style={{ borderTop: '1px solid var(--border-muted)' }}>
                            {msg.citedNodes.map(cn => (
                              <button
                                key={cn.id}
                                onClick={() => navigate(`/graph?node=${cn.id}`)}
                                className="flex items-center gap-1.5 px-2 py-1 rounded-full cursor-pointer"
                                style={{
                                  background: `${TYPE_COLORS[cn.type] ?? '#8b949e'}15`,
                                  border: `1px solid ${TYPE_COLORS[cn.type] ?? '#8b949e'}40`,
                                  color: TYPE_COLORS[cn.type] ?? '#8b949e',
                                  fontSize: 11, fontWeight: 500,
                                }}
                              >
                                <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: TYPE_COLORS[cn.type] ?? '#8b949e' }} />
                                {cn.name}
                                <ExternalLink size={9} />
                              </button>
                            ))}
                          </div>
                        )}

                        {msg.duration !== undefined && (
                          <div className="flex items-center gap-1 mt-2" style={{ color: 'var(--text-4)', fontSize: 11 }}>
                            <Clock size={10} /> {msg.duration.toFixed(1)}s
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {isThinking && (
                <div className="flex justify-start">
                  <div
                    className="rounded-lg px-4 py-3 flex items-center gap-1.5"
                    style={{ background: 'var(--bg-s1)', border: '1px solid var(--border-main)' }}
                  >
                    <span className="thinking-dot" />
                    <span className="thinking-dot" />
                    <span className="thinking-dot" />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4" style={{ borderTop: '1px solid var(--border-main)', background: 'var(--bg-s1)' }}>
          <div className="max-w-3xl mx-auto flex gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="向知识图谱提问..."
              disabled={isThinking}
              rows={1}
              className="flex-1 resize-none rounded-lg px-4 py-2.5 outline-none"
              style={{
                background: 'var(--bg-s2)', border: '1px solid var(--border-main)',
                color: 'var(--text-1)', fontSize: 14, minHeight: 42, maxHeight: 120,
                opacity: isThinking ? 0.5 : 1,
              }}
            />
            <button
              onClick={handleSend}
              disabled={isThinking || !input.trim()}
              className="px-4 py-2 rounded-lg cursor-pointer flex items-center gap-2"
              style={{
                background: input.trim() ? 'var(--green-btn)' : 'var(--bg-s2)',
                color: input.trim() ? '#fff' : 'var(--text-4)',
                border: 'none', fontSize: 13, fontWeight: 500,
                opacity: isThinking ? 0.5 : 1,
              }}
            >
              <Send size={14} /> 发送
            </button>
          </div>
          <div className="max-w-3xl mx-auto mt-1.5">
            <span style={{ color: 'var(--text-4)', fontSize: 11 }}>
              Enter 发送，Shift+Enter 换行 &nbsp;|&nbsp; 批量问答管理
              <span style={{ background: 'rgba(248,81,73,0.15)', color: '#f85149', padding: '0 3px', borderRadius: 2, marginLeft: 4, fontSize: 10 }}>未开发</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToolCallPanel({ toolCalls }: { toolCalls: ToolCall[] }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="mt-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 cursor-pointer"
        style={{ background: 'none', border: 'none', color: 'var(--text-3)', fontSize: 12 }}
      >
        <ChevronRight
          size={12}
          style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 150ms' }}
        />
        工具调用 ({toolCalls.length} 步)
      </button>
      {expanded && (
        <div className="mt-2 rounded-md overflow-hidden" style={{ background: 'var(--bg-s3)', border: '1px solid var(--border-muted)' }}>
          {toolCalls.map(tc => (
            <div key={tc.step} className="p-3" style={{ borderBottom: '1px solid var(--border-muted)' }}>
              <div className="flex items-center gap-2 mb-2">
                <span style={{ color: 'var(--text-4)', fontSize: 11 }}>步骤 {tc.step}</span>
                <span style={{ color: 'var(--yellow)', fontSize: 12, fontFamily: 'monospace', fontWeight: 600 }}>{tc.tool}</span>
              </div>
              <div className="mb-1" style={{ fontSize: 11, color: 'var(--text-4)' }}>输入:</div>
              <pre className="mb-2 p-2 rounded overflow-x-auto" style={{ background: 'var(--bg-base)', fontSize: 11, color: 'var(--text-3)', fontFamily: 'monospace', lineHeight: 1.5 }}>
                {tc.input}
              </pre>
              <div className="mb-1" style={{ fontSize: 11, color: 'var(--text-4)' }}>输出:</div>
              <pre className="p-2 rounded overflow-x-auto" style={{ background: 'var(--bg-base)', fontSize: 11, color: 'var(--text-3)', fontFamily: 'monospace', lineHeight: 1.5 }}>
                {tc.output}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function renderSimpleMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong style="color:var(--text-1)">$1</strong>')
    .replace(/^## (.*$)/gm, '<div style="font-size:16px;font-weight:600;color:var(--text-1);margin:8px 0 4px">$1</div>')
    .replace(/^### (.*$)/gm, '<div style="font-size:14px;font-weight:600;color:var(--text-1);margin:6px 0 4px">$1</div>')
    .replace(/^> (.*$)/gm, '<div style="border-left:3px solid var(--blue);padding-left:12px;color:var(--text-3);margin:8px 0">$1</div>')
    .replace(/^\d+\. (.*$)/gm, '<div style="padding-left:16px;margin:2px 0">$&</div>')
    .replace(/^- (.*$)/gm, '<div style="padding-left:16px;margin:2px 0">&bull; $1</div>')
    .replace(/\n/g, '<br/>');
}
