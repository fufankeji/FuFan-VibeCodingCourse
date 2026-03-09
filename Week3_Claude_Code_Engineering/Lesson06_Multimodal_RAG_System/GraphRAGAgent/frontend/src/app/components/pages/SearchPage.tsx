import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import * as d3 from 'd3';
import { Search, ExternalLink, MessageSquare, ArrowRight } from 'lucide-react';
import { useAppState, mapApiNode, mapApiEdge, type KGNode } from '../../store';
import { api, ApiError } from '../../api';
import { TYPE_COLORS } from '../../mock-data';

const ENTITY_TYPES_OPTIONS = ['全部类型', 'TECHNOLOGY', 'CONCEPT', 'PERSON', 'ORGANIZATION', 'LOCATION'];

export function SearchPage() {
  const { nodes, edges, getNeighbors } = useAppState();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [typeFilter, setTypeFilter] = useState(searchParams.get('type') || '全部类型');
  const [activeTab, setActiveTab] = useState<'entity' | 'path' | 'graph'>(
    (searchParams.get('tab') as 'entity' | 'path' | 'graph') || 'entity'
  );
  const [results, setResults] = useState<KGNode[]>([]);
  const [selectedResult, setSelectedResult] = useState<KGNode | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [searching, setSearching] = useState(false);

  // Path search
  const [pathFrom, setPathFrom] = useState('');
  const [pathTo, setPathTo] = useState('');
  const [maxHops, setMaxHops] = useState(3);
  const [pathResult, setPathResult] = useState<KGNode[] | null>(null);
  const [pathSearching, setPathSearching] = useState(false);
  const [pathError, setPathError] = useState('');

  // Graph search
  const [graphQuery, setGraphQuery] = useState('');
  const [includeNeighbors, setIncludeNeighbors] = useState(true);
  const [graphResults, setGraphResults] = useState<KGNode[]>([]);
  const [graphSearching, setGraphSearching] = useState(false);

  const previewRef = useRef<SVGSVGElement>(null);

  // Auto-search from URL
  useEffect(() => {
    const q = searchParams.get('q');
    if (q) {
      setQuery(q);
      doEntitySearch(q, typeFilter);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Entity Search ─────────────────────────────────────────────────────────

  const doEntitySearch = async (q: string, type: string) => {
    if (!q.trim()) return;
    setSearching(true);
    setHasSearched(true);
    try {
      const res = await api.searchEntities(q.trim(), type !== '全部类型' ? type : undefined, 50);
      const mapped = res.items.map(mapApiNode);
      setResults(mapped);
      setSelectedResult(mapped[0] ?? null);
      setSearchParams({ q: q.trim(), type, tab: 'entity' });
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleEntitySearch = () => doEntitySearch(query, typeFilter);

  // ── Preview graph for selected entity ────────────────────────────────────

  useEffect(() => {
    if (!selectedResult || !previewRef.current) return;
    const svg = d3.select(previewRef.current);
    svg.selectAll('*').remove();

    // Use local KG for preview (already loaded)
    const { nodes: neighbors, edges: nEdges } = getNeighbors(selectedResult.id);
    const allNodes = [selectedResult, ...neighbors];
    const width = 380;
    const height = 280;
    svg.attr('width', width).attr('height', height);

    const g = svg.append('g');
    const simNodes = allNodes.map(n => ({ ...n, x: width / 2 + (Math.random() - 0.5) * 100, y: height / 2 + (Math.random() - 0.5) * 100 }));
    const simEdges = nEdges.map(e => ({ ...e }));

    const simulation = d3.forceSimulation(simNodes)
      .force('link', d3.forceLink(simEdges).id((d: any) => d.id).distance(50).strength(0.5))
      .force('charge', d3.forceManyBody().strength(-80))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .alphaDecay(0.05);

    const link = g.selectAll('line').data(simEdges).join('line')
      .attr('stroke', '#30363d').attr('stroke-width', 1).attr('stroke-opacity', 0.4);
    const node = g.selectAll('circle').data(simNodes).join('circle')
      .attr('r', (d: any) => d.id === selectedResult.id ? 8 : 5)
      .attr('fill', (d: any) => TYPE_COLORS[d.type] ?? '#8b949e')
      .attr('stroke', (d: any) => d.id === selectedResult.id ? '#fff' : '#0f1117')
      .attr('stroke-width', (d: any) => d.id === selectedResult.id ? 2 : 1);
    g.selectAll('text').data(simNodes.filter(n => n.id === selectedResult.id || n.degree >= 10)).join('text')
      .text((d: any) => d.name).attr('font-size', 9).attr('fill', 'var(--text-3)')
      .attr('text-anchor', 'middle').attr('dy', -12).attr('pointer-events', 'none');

    simulation.on('tick', () => {
      link.attr('x1', (d: any) => d.source.x).attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x).attr('y2', (d: any) => d.target.y);
      node.attr('cx', (d: any) => d.x).attr('cy', (d: any) => d.y);
    });
    return () => simulation.stop();
  }, [selectedResult, getNeighbors]);

  // ── Path Search ───────────────────────────────────────────────────────────

  const handlePathSearch = async () => {
    if (!pathFrom.trim() || !pathTo.trim()) return;
    setPathError('');
    setPathResult(null);

    // Resolve names to node IDs from local KG
    const fromNode = nodes.find(n => n.name.toLowerCase().includes(pathFrom.toLowerCase()));
    const toNode = nodes.find(n => n.name.toLowerCase().includes(pathTo.toLowerCase()));

    if (!fromNode) { setPathError(`未找到起点实体"${pathFrom}"，请检查名称是否正确`); return; }
    if (!toNode) { setPathError(`未找到终点实体"${pathTo}"，请检查名称是否正确`); return; }

    setPathSearching(true);
    try {
      const res = await api.searchPath(fromNode.id, toNode.id, maxHops);
      if (!res.paths || res.paths.length === 0) {
        setPathResult([]);
      } else {
        // Use the shortest path (first result)
        const firstPath = res.paths[0];
        const pathNodes = firstPath.nodes
          .map(n => {
            const local = nodes.find(ln => ln.id === n.id);
            return local ?? { id: n.id, name: n.name, type: n.type as KGNode['type'], page: 0, confidence: 'match_exact' as const, degree: 0, centrality: 0, doc_id: '' };
          });
        setPathResult(pathNodes);
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === 3001) {
        setPathResult([]);
      } else {
        setPathError(err instanceof ApiError ? err.message : '路径查找失败');
      }
    } finally {
      setPathSearching(false);
    }
  };

  // ── Graph Search ──────────────────────────────────────────────────────────

  const handleGraphSearch = async () => {
    if (!graphQuery.trim()) return;
    setGraphSearching(true);
    try {
      const res = await api.searchGraph(graphQuery.trim(), includeNeighbors);
      setGraphResults(res.matched_nodes.map(mapApiNode));
    } catch {
      setGraphResults([]);
    } finally {
      setGraphSearching(false);
    }
  };

  return (
    <div className="p-6" style={{ maxWidth: 1200, margin: '0 auto' }}>
      <h1 className="mb-6" style={{ color: 'var(--text-1)', fontSize: 20, fontWeight: 600 }}>搜索</h1>

      {/* Search Header */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-4)' }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleEntitySearch()}
            placeholder="搜索实体..."
            className="w-full pl-9 pr-4 py-2.5 rounded-lg outline-none"
            style={{ background: 'var(--bg-s2)', border: '1px solid var(--border-main)', color: 'var(--text-1)', fontSize: 14 }}
          />
        </div>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="px-3 py-2 rounded-lg cursor-pointer"
          style={{ background: 'var(--bg-s2)', border: '1px solid var(--border-main)', color: 'var(--text-2)', fontSize: 13 }}
        >
          {ENTITY_TYPES_OPTIONS.map(t => <option key={t}>{t}</option>)}
        </select>
        <button
          onClick={handleEntitySearch}
          disabled={searching}
          className="flex items-center gap-2 px-5 py-2 rounded-lg cursor-pointer"
          style={{ background: 'var(--green-btn)', color: '#fff', fontSize: 13, fontWeight: 500, border: 'none', opacity: searching ? 0.7 : 1 }}
        >
          <Search size={14} /> {searching ? '搜索中...' : '搜索'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 mb-6" style={{ borderBottom: '1px solid var(--border-main)' }}>
        {([
          { key: 'entity' as const, label: '实体搜索' },
          { key: 'path' as const, label: '路径搜索' },
          { key: 'graph' as const, label: '图谱搜索' },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="px-4 py-2.5 cursor-pointer relative"
            style={{
              background: 'transparent', border: 'none',
              color: activeTab === tab.key ? 'var(--blue)' : 'var(--text-3)',
              fontSize: 13, fontWeight: activeTab === tab.key ? 600 : 400,
            }}
          >
            {tab.label}
            {activeTab === tab.key && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: 'var(--blue)' }} />
            )}
          </button>
        ))}
      </div>

      {/* Entity Search Tab */}
      {activeTab === 'entity' && (
        <div className="flex gap-4">
          <div className="flex-1" style={{ minWidth: 0 }}>
            {!hasSearched ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Search size={36} style={{ color: 'var(--text-4)' }} />
                <span style={{ color: 'var(--text-3)', fontSize: 14 }}>输入查询以搜索实体</span>
              </div>
            ) : searching ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <span style={{ color: 'var(--text-3)', fontSize: 14 }}>搜索中...</span>
              </div>
            ) : results.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <span style={{ color: 'var(--text-3)', fontSize: 14 }}>未找到实体 "{query}"</span>
                <button
                  onClick={() => navigate('/graph')}
                  className="flex items-center gap-1 cursor-pointer"
                  style={{ color: 'var(--blue)', fontSize: 13, background: 'none', border: 'none' }}
                >
                  探索知识图谱 <ExternalLink size={12} />
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div style={{ color: 'var(--text-4)', fontSize: 12, marginBottom: 4 }}>
                  找到 {results.length} 个结果
                </div>
                {results.map(r => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedResult(r)}
                    className="flex items-center gap-3 p-3 rounded-lg cursor-pointer text-left w-full"
                    style={{
                      background: selectedResult?.id === r.id ? 'var(--bg-s2)' : 'var(--bg-s1)',
                      border: `1px solid ${selectedResult?.id === r.id ? 'var(--blue)' : 'var(--border-main)'}`,
                    }}
                  >
                    <span className="inline-block w-3 h-3 rounded-full flex-shrink-0" style={{ background: TYPE_COLORS[r.type] ?? '#8b949e' }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span style={{ color: 'var(--text-1)', fontSize: 14, fontWeight: 500 }}>{r.name}</span>
                        <span className="px-1.5 py-0.5 rounded" style={{ fontSize: 10, fontWeight: 600, background: `${TYPE_COLORS[r.type] ?? '#8b949e'}20`, color: TYPE_COLORS[r.type] ?? '#8b949e' }}>
                          {r.type}
                        </span>
                      </div>
                      <div className="flex items-center gap-3" style={{ fontSize: 11, color: 'var(--text-4)' }}>
                        <span>页码 {r.page}</span>
                        <span>度数 {r.degree}</span>
                        <span>{r.confidence.replace('match_', '')}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={e => { e.stopPropagation(); navigate(`/graph?node=${r.id}`); }}
                        className="px-2 py-1 rounded cursor-pointer"
                        style={{ fontSize: 10, background: 'rgba(88,166,255,0.1)', color: 'var(--blue)', border: 'none' }}
                      >
                        查看图谱
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); navigate(`/chat?q=${encodeURIComponent(`What is ${r.name}`)}`); }}
                        className="px-2 py-1 rounded cursor-pointer"
                        style={{ fontSize: 10, background: 'rgba(88,166,255,0.1)', color: 'var(--blue)', border: 'none' }}
                      >
                        <MessageSquare size={10} />
                      </button>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Preview Graph */}
          {selectedResult && (
            <div
              className="rounded-lg p-3 flex-shrink-0"
              style={{ width: 400, background: 'var(--bg-s1)', border: '1px solid var(--border-main)' }}
            >
              <div className="flex items-center justify-between mb-2">
                <span style={{ color: 'var(--text-1)', fontSize: 13, fontWeight: 600 }}>
                  预览: {selectedResult.name}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-4)' }}>1 跳邻居</span>
              </div>
              <svg ref={previewRef} className="w-full" style={{ height: 280, background: 'var(--bg-base)', borderRadius: 6 }} />
            </div>
          )}
        </div>
      )}

      {/* Path Search Tab */}
      {activeTab === 'path' && (
        <div>
          <div className="flex items-end gap-3 mb-6">
            <div className="flex-1">
              <label style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', marginBottom: 4 }}>起点实体名称</label>
              <input
                value={pathFrom}
                onChange={e => setPathFrom(e.target.value)}
                placeholder="如: GraphRAG"
                className="w-full px-3 py-2 rounded-md outline-none"
                style={{ background: 'var(--bg-s2)', border: '1px solid var(--border-main)', color: 'var(--text-1)', fontSize: 13 }}
              />
            </div>
            <div className="flex-1">
              <label style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', marginBottom: 4 }}>终点实体名称</label>
              <input
                value={pathTo}
                onChange={e => setPathTo(e.target.value)}
                placeholder="如: LLM"
                className="w-full px-3 py-2 rounded-md outline-none"
                style={{ background: 'var(--bg-s2)', border: '1px solid var(--border-main)', color: 'var(--text-1)', fontSize: 13 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', marginBottom: 4 }}>最大跳数</label>
              <select
                value={maxHops}
                onChange={e => setMaxHops(Number(e.target.value))}
                className="px-3 py-2 rounded-md cursor-pointer"
                style={{ background: 'var(--bg-s2)', border: '1px solid var(--border-main)', color: 'var(--text-2)', fontSize: 13 }}
              >
                {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <button
              onClick={handlePathSearch}
              disabled={pathSearching}
              className="flex items-center gap-2 px-4 py-2 rounded-md cursor-pointer"
              style={{ background: 'var(--green-btn)', color: '#fff', fontSize: 13, border: 'none', opacity: pathSearching ? 0.7 : 1 }}
            >
              {pathSearching ? '查找中...' : '查找路径'}
            </button>
          </div>

          {pathError && (
            <div className="mb-4 px-4 py-2 rounded-md" style={{ background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.3)', color: 'var(--red)', fontSize: 13 }}>
              {pathError}
            </div>
          )}

          {pathResult !== null && (
            pathResult.length === 0 ? (
              <div className="text-center py-12" style={{ color: 'var(--text-3)', fontSize: 14 }}>
                这两个实体之间没有路径（在 {maxHops} 跳内）
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-wrap p-6 rounded-lg" style={{ background: 'var(--bg-s1)', border: '1px solid var(--border-main)' }}>
                <span style={{ fontSize: 12, color: 'var(--text-4)', marginBottom: 8, display: 'block', width: '100%' }}>
                  路径长度 {pathResult.length - 1} 跳
                </span>
                {pathResult.map((n, i) => (
                  <React.Fragment key={n.id}>
                    <button
                      onClick={() => navigate(`/graph?node=${n.id}`)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer"
                      style={{ background: 'var(--bg-s2)', border: `1px solid ${TYPE_COLORS[n.type] ?? '#8b949e'}40` }}
                    >
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: TYPE_COLORS[n.type] ?? '#8b949e' }} />
                      <span style={{ color: 'var(--text-1)', fontSize: 13 }}>{n.name}</span>
                      <span style={{ fontSize: 10, color: TYPE_COLORS[n.type] ?? '#8b949e' }}>{n.type}</span>
                    </button>
                    {i < pathResult.length - 1 && (
                      <ArrowRight size={16} style={{ color: 'var(--text-4)' }} />
                    )}
                  </React.Fragment>
                ))}
              </div>
            )
          )}
        </div>
      )}

      {/* Graph Search Tab */}
      {activeTab === 'graph' && (
        <div>
          <div className="flex items-end gap-3 mb-6">
            <div className="flex-1">
              <input
                value={graphQuery}
                onChange={e => setGraphQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleGraphSearch()}
                placeholder="搜索关键词..."
                className="w-full px-3 py-2 rounded-md outline-none"
                style={{ background: 'var(--bg-s2)', border: '1px solid var(--border-main)', color: 'var(--text-1)', fontSize: 13 }}
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer px-3 py-2">
              <input
                type="checkbox"
                checked={includeNeighbors}
                onChange={e => setIncludeNeighbors(e.target.checked)}
                style={{ accentColor: 'var(--blue)' }}
              />
              <span style={{ fontSize: 12, color: 'var(--text-2)' }}>包含邻居</span>
            </label>
            <button
              onClick={handleGraphSearch}
              disabled={graphSearching}
              className="flex items-center gap-2 px-4 py-2 rounded-md cursor-pointer"
              style={{ background: 'var(--green-btn)', color: '#fff', fontSize: 13, border: 'none', opacity: graphSearching ? 0.7 : 1 }}
            >
              {graphSearching ? '搜索中...' : '搜索'}
            </button>
          </div>

          {graphResults.length > 0 && (
            <>
              <div style={{ color: 'var(--text-4)', fontSize: 12, marginBottom: 8 }}>
                找到 {graphResults.length} 个节点
              </div>
              <div className="flex flex-wrap gap-2">
                {graphResults.map(n => (
                  <button
                    key={n.id}
                    onClick={() => navigate(`/graph?node=${n.id}`)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full cursor-pointer"
                    style={{ background: `${TYPE_COLORS[n.type] ?? '#8b949e'}15`, border: `1px solid ${TYPE_COLORS[n.type] ?? '#8b949e'}40`, color: TYPE_COLORS[n.type] ?? '#8b949e', fontSize: 12 }}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ background: TYPE_COLORS[n.type] ?? '#8b949e' }} />
                    {n.name}
                  </button>
                ))}
              </div>
            </>
          )}

          {graphSearching === false && graphQuery && graphResults.length === 0 && (
            <div className="text-center py-12" style={{ color: 'var(--text-3)', fontSize: 14 }}>
              未找到包含 "{graphQuery}" 的节点
            </div>
          )}
        </div>
      )}
    </div>
  );
}
