import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import * as d3 from 'd3';
import { ZoomIn, ZoomOut, Maximize2, Search, Download, Image, X, MessageSquare, Upload, Share2 } from 'lucide-react';
import { useAppState, type KGNode } from '../../store';
import { TYPE_COLORS } from '../../mock-data';

const ENTITY_TYPES = ['TECHNOLOGY', 'CONCEPT', 'PERSON', 'ORGANIZATION', 'LOCATION'] as const;
const CONFIDENCE_LEVELS = ['match_exact', 'match_greater', 'match_lesser', 'match_fuzzy'] as const;

export function KGExplorer() {
  const { nodes, edges, documents, selectedNode, setSelectedNode, getNeighbors } = useAppState();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<d3.Simulation<any, any>>();
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown>>();

  const [filterTypes, setFilterTypes] = useState<Set<string>>(new Set(ENTITY_TYPES));
  const [filterConfidence, setFilterConfidence] = useState<Set<string>>(new Set(CONFIDENCE_LEVELS));
  const [filterDoc, setFilterDoc] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilter, setShowFilter] = useState(true);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; node: KGNode } | null>(null);

  const indexedDocs = documents.filter(d => d.status === 'indexed');

  // Filtered nodes/edges
  const visibleNodes = nodes.filter(n => {
    if (!filterTypes.has(n.type)) return false;
    if (!filterConfidence.has(n.confidence)) return false;
    if (filterDoc !== 'all' && n.doc_id !== filterDoc) return false;
    if (searchQuery && !n.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const visibleNodeIds = new Set(visibleNodes.map(n => n.id));
  const visibleEdges = edges.filter(e => visibleNodeIds.has(e.source as string) && visibleNodeIds.has(e.target as string));

  // Neighbors of selected
  const neighborInfo = selectedNode ? getNeighbors(selectedNode.id) : null;

  // D3 rendering
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    if (visibleNodes.length === 0) return;

    const rect = containerRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    svg.attr('width', width).attr('height', height);

    const g = svg.append('g');

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 8])
      .on('zoom', (event) => g.attr('transform', event.transform));
    zoomRef.current = zoom;
    svg.call(zoom);

    // Create simulation data copies
    const simNodes = visibleNodes.map(n => ({ ...n, x: width / 2 + (Math.random() - 0.5) * 200, y: height / 2 + (Math.random() - 0.5) * 200 }));
    const simEdges = visibleEdges.map(e => ({ ...e, source: e.source, target: e.target }));

    const simulation = d3.forceSimulation(simNodes)
      .force('link', d3.forceLink(simEdges).id((d: any) => d.id).distance(60).strength(0.3))
      .force('charge', d3.forceManyBody().strength(-120))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide().radius((d: any) => getRadius(d.degree) + 4))
      .alphaDecay(0.02);

    simulationRef.current = simulation;

    // Edges
    const link = g.append('g')
      .selectAll('line')
      .data(simEdges)
      .join('line')
      .attr('stroke', '#30363d')
      .attr('stroke-width', 1)
      .attr('stroke-opacity', 0.25);

    // Nodes
    const node = g.append('g')
      .selectAll('circle')
      .data(simNodes)
      .join('circle')
      .attr('r', (d: any) => getRadius(d.degree))
      .attr('fill', (d: any) => TYPE_COLORS[d.type] || '#8b949e')
      .attr('stroke', '#0f1117')
      .attr('stroke-width', 1.5)
      .attr('opacity', 0.9)
      .attr('cursor', 'pointer')
      .on('mouseover', function(event, d: any) {
        d3.select(this).attr('stroke', '#ffffff').attr('stroke-width', 2.5);
        setTooltip({ x: event.clientX + 8, y: event.clientY + 8, node: d });
      })
      .on('mouseout', function() {
        d3.select(this).attr('stroke', '#0f1117').attr('stroke-width', 1.5);
        setTooltip(null);
      })
      .on('click', (_, d: any) => {
        setSelectedNode(d);
        // Highlight logic
        node.attr('opacity', (n: any) => {
          if (n.id === d.id) return 0.9;
          const isNeighbor = simEdges.some((e: any) =>
            (e.source.id === d.id && e.target.id === n.id) ||
            (e.target.id === d.id && e.source.id === n.id)
          );
          return isNeighbor ? 0.9 : 0.1;
        });
        d3.select(node.nodes()[simNodes.indexOf(d)])
          .attr('r', getRadius(d.degree) * 1.5);
        link.attr('stroke-opacity', (e: any) =>
          e.source.id === d.id || e.target.id === d.id ? 0.8 : 0.05
        );
      })
      .call(d3.drag<SVGCircleElement, any>()
        .on('start', (event, d: any) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x; d.fy = d.y;
        })
        .on('drag', (event, d: any) => { d.fx = event.x; d.fy = event.y; })
        .on('end', (event, d: any) => {
          if (!event.active) simulation.alphaTarget(0);
        })
      );

    // Labels for high-degree nodes
    const label = g.append('g')
      .selectAll('text')
      .data(simNodes.filter(n => n.degree >= 12))
      .join('text')
      .text((d: any) => d.name)
      .attr('font-size', 10)
      .attr('fill', 'var(--text-3)')
      .attr('text-anchor', 'middle')
      .attr('dy', (d: any) => -(getRadius(d.degree) + 6))
      .attr('pointer-events', 'none');

    // Click blank to reset
    svg.on('click', (event) => {
      if (event.target === svgRef.current) {
        setSelectedNode(null);
        node.attr('opacity', 0.9).attr('r', (d: any) => getRadius(d.degree));
        link.attr('stroke-opacity', 0.25);
      }
    });

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);
      node
        .attr('cx', (d: any) => d.x)
        .attr('cy', (d: any) => d.y);
      label
        .attr('x', (d: any) => d.x)
        .attr('y', (d: any) => d.y);
    });

    // Handle URL params
    const nodeParam = searchParams.get('node');
    if (nodeParam) {
      const target = simNodes.find(n => n.id === nodeParam);
      if (target) {
        setTimeout(() => {
          const nd = nodes.find(n => n.id === nodeParam);
          if (nd) setSelectedNode(nd);
        }, 500);
      }
    }

    const docParam = searchParams.get('doc_id');
    if (docParam) {
      setFilterDoc(docParam);
    }

    return () => { simulation.stop(); };
  }, [visibleNodes.length, visibleEdges.length, searchQuery, filterDoc]);

  const handleZoomIn = () => {
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 1.3);
    }
  };
  const handleZoomOut = () => {
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 0.7);
    }
  };
  const handleFitAll = () => {
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current).transition().duration(500).call(zoomRef.current.transform, d3.zoomIdentity);
    }
  };

  const toggleType = (t: string) => {
    const next = new Set(filterTypes);
    if (next.has(t)) next.delete(t); else next.add(t);
    setFilterTypes(next);
  };

  const toggleConfidence = (c: string) => {
    const next = new Set(filterConfidence);
    if (next.has(c)) next.delete(c); else next.add(c);
    setFilterConfidence(next);
  };

  return (
    <div className="flex h-full" style={{ background: 'var(--bg-base)' }}>
      {/* Filter Panel */}
      {showFilter && (
        <div
          className="flex flex-col p-4 overflow-y-auto"
          style={{
            width: 260,
            background: 'var(--bg-s1)',
            borderRight: '1px solid var(--border-main)',
            flexShrink: 0,
          }}
        >
          <h3 className="mb-3" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-3)' }}>来源文档</h3>
          <select
            value={filterDoc}
            onChange={e => setFilterDoc(e.target.value)}
            className="mb-4 px-2 py-1.5 rounded-md w-full"
            style={{ background: 'var(--bg-s2)', border: '1px solid var(--border-main)', color: 'var(--text-2)', fontSize: 12 }}
          >
            <option value="all">全部文档</option>
            {indexedDocs.map(d => (
              <option key={d.id} value={d.id}>{d.filename}</option>
            ))}
          </select>

          <h3 className="mb-2" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-3)' }}>实体类型</h3>
          <div className="flex flex-col gap-1.5 mb-4">
            {ENTITY_TYPES.map(t => {
              const count = nodes.filter(n => n.type === t).length;
              return (
                <label key={t} className="flex items-center gap-2 cursor-pointer" style={{ fontSize: 12, color: 'var(--text-2)' }}>
                  <input
                    type="checkbox"
                    checked={filterTypes.has(t)}
                    onChange={() => toggleType(t)}
                    className="cursor-pointer"
                    style={{ accentColor: TYPE_COLORS[t] }}
                  />
                  <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: TYPE_COLORS[t] }} />
                  <span className="flex-1">{t}</span>
                  <span style={{ color: 'var(--text-4)', fontSize: 11 }}>{count}</span>
                </label>
              );
            })}
          </div>

          <h3 className="mb-2" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-3)' }}>置信度</h3>
          <div className="flex flex-col gap-1.5 mb-4">
            {CONFIDENCE_LEVELS.map(c => (
              <label key={c} className="flex items-center gap-2 cursor-pointer" style={{ fontSize: 12, color: 'var(--text-2)' }}>
                <input type="checkbox" checked={filterConfidence.has(c)} onChange={() => toggleConfidence(c)} className="cursor-pointer" />
                {c.replace('match_', '')}
              </label>
            ))}
          </div>

          <div className="mt-auto flex flex-col gap-2">
            <button className="flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer w-full" style={{ background: 'var(--bg-s2)', border: '1px solid var(--border-main)', color: 'var(--text-2)', fontSize: 12 }}>
              <Image size={12} /> 导出 PNG
            </button>
            <button className="flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer w-full" style={{ background: 'var(--bg-s2)', border: '1px solid var(--border-main)', color: 'var(--text-2)', fontSize: 12 }}>
              <Download size={12} /> 导出 JSON
            </button>
          </div>
        </div>
      )}

      {/* Graph Area */}
      <div ref={containerRef} className="flex-1 relative" style={{ overflow: 'hidden' }}>
        {/* Toolbar */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-md p-1" style={{ background: 'var(--bg-s1)', border: '1px solid var(--border-main)', zIndex: 10 }}>
          <button onClick={handleZoomIn} className="p-1.5 rounded cursor-pointer" style={{ background: 'transparent', border: 'none', color: 'var(--text-3)' }}><ZoomIn size={16} /></button>
          <button onClick={handleZoomOut} className="p-1.5 rounded cursor-pointer" style={{ background: 'transparent', border: 'none', color: 'var(--text-3)' }}><ZoomOut size={16} /></button>
          <button onClick={handleFitAll} className="p-1.5 rounded cursor-pointer" style={{ background: 'transparent', border: 'none', color: 'var(--text-3)' }}><Maximize2 size={16} /></button>
          <div style={{ width: 1, height: 20, background: 'var(--border-main)' }} />
          <div className="relative">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-4)' }} />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="搜索..."
              className="pl-7 pr-2 py-1 rounded"
              style={{ width: 120, background: 'var(--bg-s2)', border: '1px solid var(--border-main)', color: 'var(--text-1)', fontSize: 12, outline: 'none' }}
            />
          </div>
        </div>

        {/* Legend */}
        <div className="absolute bottom-3 left-3 flex flex-wrap gap-3 rounded-md px-3 py-2" style={{ background: 'var(--bg-s1)', border: '1px solid var(--border-main)', zIndex: 10 }}>
          {ENTITY_TYPES.map(t => (
            <div key={t} className="flex items-center gap-1.5" style={{ fontSize: 11, color: 'var(--text-3)' }}>
              <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: TYPE_COLORS[t] }} />
              {t}
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="absolute top-3 right-3 rounded-md px-3 py-1.5" style={{ background: 'var(--bg-s1)', border: '1px solid var(--border-main)', zIndex: 10, fontSize: 11, color: 'var(--text-3)' }}>
          {visibleNodes.length} 个节点 &middot; {visibleEdges.length} 条边
        </div>

        {visibleNodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Share2 size={48} style={{ color: 'var(--text-4)' }} />
            <span style={{ color: 'var(--text-2)', fontSize: 16 }}>暂无知识图谱</span>
            <button
              onClick={() => navigate('/documents')}
              className="flex items-center gap-2 px-4 py-2 rounded-md cursor-pointer"
              style={{ background: 'var(--green-btn)', color: '#fff', fontSize: 13, border: 'none' }}
            >
              <Upload size={14} /> 上传 & 索引
            </button>
          </div>
        ) : (
          <svg ref={svgRef} className="w-full h-full" />
        )}

        {/* Tooltip */}
        {tooltip && (
          <div
            className="fixed rounded-md px-3 py-2 pointer-events-none"
            style={{
              left: tooltip.x, top: tooltip.y,
              background: 'var(--bg-s3)', border: '1px solid var(--border-main)',
              boxShadow: 'var(--shadow-md)', zIndex: 100, fontSize: 12,
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span style={{ color: 'var(--text-1)', fontWeight: 600 }}>{tooltip.node.name}</span>
              <span className="px-1.5 py-0.5 rounded" style={{ fontSize: 10, fontWeight: 600, background: `${TYPE_COLORS[tooltip.node.type]}20`, color: TYPE_COLORS[tooltip.node.type] }}>
                {tooltip.node.type}
              </span>
            </div>
            <div style={{ color: 'var(--text-3)' }}>页码: {tooltip.node.page}</div>
            <div style={{ color: 'var(--text-3)' }}>置信度: {tooltip.node.confidence}</div>
            <div style={{ color: 'var(--text-3)' }}>度数: {tooltip.node.degree}</div>
          </div>
        )}
      </div>

      {/* Detail Panel */}
      {selectedNode && (
        <div
          className="flex flex-col p-4 overflow-y-auto"
          style={{
            width: 300,
            background: 'var(--bg-s1)',
            borderLeft: '1px solid var(--border-main)',
            flexShrink: 0,
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <h2 style={{ color: 'var(--text-1)', fontSize: 18, fontWeight: 600 }}>{selectedNode.name}</h2>
            <button onClick={() => setSelectedNode(null)} className="cursor-pointer" style={{ background: 'none', border: 'none', color: 'var(--text-4)' }}>
              <X size={16} />
            </button>
          </div>

          <span className="inline-block w-fit px-2 py-0.5 rounded mb-4" style={{ fontSize: 11, fontWeight: 600, background: `${TYPE_COLORS[selectedNode.type]}20`, color: TYPE_COLORS[selectedNode.type] }}>
            {selectedNode.type}
          </span>

          {selectedNode.description && (
            <p className="mb-4" style={{ color: 'var(--text-2)', fontSize: 13, lineHeight: 1.6 }}>
              {selectedNode.description}
            </p>
          )}

          <div className="flex flex-col gap-2 mb-4">
            {[
              { label: '页码', value: selectedNode.page },
              { label: '置信度', value: selectedNode.confidence.replace('match_', '') },
              { label: '度数', value: selectedNode.degree },
              { label: '中心性', value: selectedNode.centrality.toFixed(2) },
            ].map(p => (
              <div key={p.label} className="flex justify-between" style={{ fontSize: 13 }}>
                <span style={{ color: 'var(--text-3)' }}>{p.label}</span>
                <span style={{ color: 'var(--text-1)' }}>{p.value}</span>
              </div>
            ))}
          </div>

          <h3 className="mb-2" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-3)' }}>
            邻居节点 ({neighborInfo?.nodes.length ?? 0})
          </h3>
          <div className="flex flex-col gap-1 mb-4">
            {neighborInfo?.nodes.slice(0, 5).map(n => (
              <button
                key={n.id}
                onClick={() => setSelectedNode(n)}
                className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-left"
                style={{ background: 'var(--bg-s2)', border: 'none', fontSize: 12, color: 'var(--text-2)' }}
              >
                <span className="inline-block w-2 h-2 rounded-full" style={{ background: TYPE_COLORS[n.type] }} />
                <span className="flex-1 truncate">{n.name}</span>
                <span style={{ color: 'var(--text-4)', fontSize: 10 }}>{n.type}</span>
              </button>
            ))}
            {(neighborInfo?.nodes.length ?? 0) > 5 && (
              <span style={{ color: 'var(--blue)', fontSize: 12, cursor: 'pointer' }}>
                查看全部 {neighborInfo?.nodes.length} 个邻居 &rarr;
              </span>
            )}
          </div>

          <button
            onClick={() => navigate(`/chat?q=${encodeURIComponent(`Tell me about ${selectedNode.name}`)}`)}
            className="flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer w-full justify-center"
            style={{ background: 'rgba(88,166,255,0.1)', border: '1px solid var(--blue)', color: 'var(--blue)', fontSize: 13 }}
          >
            <MessageSquare size={14} /> 询问 AI
          </button>
        </div>
      )}
    </div>
  );
}

function getRadius(degree: number): number {
  return Math.max(4, Math.log(degree + 1) * 4);
}