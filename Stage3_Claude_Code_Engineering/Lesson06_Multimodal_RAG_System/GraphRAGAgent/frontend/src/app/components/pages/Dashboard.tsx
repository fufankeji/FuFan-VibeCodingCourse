import React from 'react';
import { useNavigate } from 'react-router';
import { Share2, MessageSquare, Search, Zap, Upload, FileText, ExternalLink } from 'lucide-react';
import { useAppState } from '../../store';

const statCards = [
  { key: 'kg_nodes', label: '图谱节点', color: '#58a6ff', icon: '◈' },
  { key: 'kg_edges', label: '图谱边', color: '#8957e5', icon: '◇' },
  { key: 'documents', label: '文档数', color: '#3fb950', icon: '▤' },
  { key: 'queries', label: '查询次数', color: '#d29922', icon: '◆' },
] as const;

const statusStyles: Record<string, { bg: string; color: string }> = {
  indexed: { bg: '#1a3a22', color: '#3fb950' },
  indexing: { bg: '#2d2a16', color: '#d29922' },
  uploaded: { bg: '#1c2128', color: '#8b949e' },
  failed: { bg: '#3b1a1a', color: '#f85149' },
};

export function Dashboard() {
  const { stats, health, documents } = useAppState();
  const navigate = useNavigate();
  const recentDocs = documents.slice(0, 5);

  return (
    <div className="p-6" style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Page Title + Upload Button */}
      <div className="flex items-center justify-between mb-6">
        <h1 style={{ color: 'var(--text-1)', fontSize: 20, fontWeight: 600 }}>仪表盘</h1>
        <button
          onClick={() => navigate('/documents')}
          className="flex items-center gap-2 px-4 py-2 rounded-md cursor-pointer"
          style={{ background: 'var(--green-btn)', color: '#fff', fontSize: 13, fontWeight: 500, border: 'none' }}
        >
          <Upload size={14} /> 上传 & 索引
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6" style={{ minWidth: 0 }}>
        {statCards.map(c => (
          <div
            key={c.key}
            className="rounded-lg p-4"
            style={{ background: 'var(--bg-s1)', border: '1px solid var(--border-main)' }}
          >
            <div className="flex items-center justify-between mb-2">
              <span style={{ color: 'var(--text-3)', fontSize: 13 }}>{c.label}</span>
              <span style={{ fontSize: 18, color: c.color }}>{c.icon}</span>
            </div>
            <div style={{ color: c.color, fontSize: 28, fontWeight: 700 }}>
              {stats[c.key].toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* System Health */}
        <div
          className="rounded-lg p-4 col-span-1"
          style={{ background: 'var(--bg-s1)', border: '1px solid var(--border-main)' }}
        >
          <h2 className="mb-4" style={{ color: 'var(--text-1)', fontSize: 16, fontWeight: 600 }}>系统健康</h2>
          <div className="flex flex-col gap-3">
            {[
              { name: 'MinerU venv', status: health.mineru },
              { name: 'LangExtract venv', status: health.langextract },
              { name: 'DeepSeek API', status: health.deepseek },
              { name: 'Storage', status: health.storage },
            ].map(s => (
              <div key={s.name} className="flex items-center justify-between">
                <span style={{ color: 'var(--text-2)', fontSize: 13 }}>{s.name}</span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-2 h-2 rounded-full" style={{ background: s.status === 'ok' ? 'var(--green)' : 'var(--red)' }} />
                  <span style={{ color: s.status === 'ok' ? 'var(--green)' : 'var(--red)', fontSize: 12 }}>{s.status}</span>
                </span>
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <h2 className="mt-6 mb-3" style={{ color: 'var(--text-1)', fontSize: 16, fontWeight: 600 }}>快捷操作</h2>
          <div className="flex flex-col gap-2">
            {[
              { icon: Share2, label: '浏览图谱', path: '/graph' },
              { icon: MessageSquare, label: '开始对话', path: '/chat' },
              { icon: Search, label: '搜索', path: '/search' },
              { icon: Zap, label: '演示', path: '/graph' },
            ].map(a => (
              <button
                key={a.label}
                onClick={() => navigate(a.path)}
                className="flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer w-full"
                style={{
                  background: 'var(--bg-s2)',
                  border: '1px solid var(--border-main)',
                  color: 'var(--text-2)',
                  fontSize: 13,
                }}
              >
                <a.icon size={14} style={{ color: 'var(--blue)' }} /> {a.label}
              </button>
            ))}
          </div>
        </div>

        {/* Recent Documents */}
        <div
          className="rounded-lg p-4 col-span-2"
          style={{ background: 'var(--bg-s1)', border: '1px solid var(--border-main)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 style={{ color: 'var(--text-1)', fontSize: 16, fontWeight: 600 }}>最近文档</h2>
            <button
              onClick={() => navigate('/documents')}
              className="flex items-center gap-1 cursor-pointer"
              style={{ color: 'var(--blue)', fontSize: 12, background: 'none', border: 'none' }}
            >
              查看全部 <ExternalLink size={12} />
            </button>
          </div>

          <div className="flex flex-col">
            {/* Table header */}
            <div
              className="grid gap-4 px-3 py-2 rounded-t-md"
              style={{ gridTemplateColumns: '1fr 60px 50px 90px 130px 100px', background: 'var(--bg-s2)', fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}
            >
              <span>文件名</span>
              <span>格式</span>
              <span>页数</span>
              <span>状态</span>
              <span>日期</span>
              <span>操作</span>
            </div>

            {recentDocs.map(doc => {
              const st = statusStyles[doc.status];
              return (
                <div
                  key={doc.id}
                  className="grid gap-4 px-3 py-2.5 items-center"
                  style={{
                    gridTemplateColumns: '1fr 60px 50px 90px 130px 100px',
                    borderBottom: '1px solid var(--border-muted)',
                    fontSize: 13,
                  }}
                >
                  <span className="flex items-center gap-2 truncate" style={{ color: 'var(--text-1)' }}>
                    <FileText size={14} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
                    <span className="truncate">{doc.filename}</span>
                  </span>
                  <span style={{ color: 'var(--text-3)' }}>{doc.format}</span>
                  <span style={{ color: 'var(--text-3)' }}>{doc.pages}</span>
                  <span>
                    <span
                      className="px-2 py-0.5 rounded-full"
                      style={{ fontSize: 11, fontWeight: 600, background: st.bg, color: st.color }}
                    >
                      {doc.status}
                    </span>
                  </span>
                  <span style={{ color: 'var(--text-4)', fontSize: 12 }}>
                    {new Date(doc.upload_date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <span>
                    {doc.status === 'indexed' && (
                      <button
                        onClick={() => navigate(`/graph?doc_id=${doc.id}`)}
                        className="px-2 py-1 rounded cursor-pointer"
                        style={{ fontSize: 11, background: 'rgba(88,166,255,0.1)', color: 'var(--blue)', border: 'none' }}
                      >
                        查看图谱
                      </button>
                    )}
                    {doc.status === 'uploaded' && (
                      <button
                        className="px-2 py-1 rounded cursor-pointer"
                        style={{ fontSize: 11, background: 'rgba(35,134,54,0.2)', color: 'var(--green)', border: 'none' }}
                      >
                        索引
                      </button>
                    )}
                    {doc.status === 'indexing' && (
                      <div className="flex items-center gap-2">
                        <div style={{ flex: 1, height: 4, background: 'var(--bg-s2)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ width: `${doc.progress}%`, height: '100%', background: 'var(--yellow)', borderRadius: 2, transition: 'width 300ms' }} />
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--yellow)' }}>{doc.progress}%</span>
                      </div>
                    )}
                    {doc.status === 'failed' && (
                      <button
                        className="px-2 py-1 rounded cursor-pointer"
                        style={{ fontSize: 11, background: 'rgba(248,81,73,0.1)', color: 'var(--red)', border: 'none' }}
                      >
                        重试
                      </button>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}