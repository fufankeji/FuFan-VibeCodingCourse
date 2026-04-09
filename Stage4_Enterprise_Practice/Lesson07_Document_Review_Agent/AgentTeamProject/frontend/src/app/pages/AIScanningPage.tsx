import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Loader2, XCircle } from 'lucide-react';
import { GlobalNav } from '../components/GlobalNav';
import { WorkflowStatusBar } from '../components/WorkflowStatusBar';
import { RiskLevelBadge } from '../components/RiskLevelBadge';
import { subscribeSSE } from '../api/sse';
import { abortSession } from '../api/sessions';

interface ScanProgress {
  high: number;
  medium: number;
  low: number;
}

const SCAN_DIMENSIONS_INIT = [
  { id: 'unilateral', label: '单边条款检测', status: 'pending' as const },
  { id: 'penalty', label: '违约金条款分析', status: 'pending' as const },
  { id: 'confidentiality', label: '保密条款审查', status: 'pending' as const },
  { id: 'ip', label: '知识产权归属', status: 'pending' as const },
  { id: 'dispute', label: '争议解决条款', status: 'pending' as const },
  { id: 'termination', label: '合同解除权分析', status: 'pending' as const },
];

const SCAN_DIMENSIONS_DONE = SCAN_DIMENSIONS_INIT.map((d) => ({ ...d, status: 'done' as const }));

/**
 * AIScanningPage — P07 AI 扫描进度页
 * GET /sessions/{session_id}/events (SSE) — 已开发
 * 收到 scan_progress 事件：更新已发现风险计数
 * 收到路由事件后跳转：
 *   route_auto_passed → P10 报告页
 *   route_batch_review → P09 批量复核页
 *   route_interrupted → P08 HITL 审核页
 * R01: 严禁显示「无风险」或「扫描通过」等绝对化判断文字
 */
export function AIScanningPage() {
  const { id: sessionId } = useParams();
  const navigate = useNavigate();
  const [progress, setProgress] = useState<ScanProgress>({ high: 0, medium: 0, low: 0 });
  const [dimensions, setDimensions] = useState(SCAN_DIMENSIONS_INIT);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Simulate scan dimension progression during scanning
  useEffect(() => {
    let dimIndex = 0;
    const advance = setInterval(() => {
      setDimensions((prev) => {
        const next = [...prev];
        // Mark current active as done, next as active
        const activeIdx = next.findIndex((d) => d.status === 'active');
        if (activeIdx >= 0) {
          next[activeIdx] = { ...next[activeIdx], status: 'done' };
          if (activeIdx + 1 < next.length) {
            next[activeIdx + 1] = { ...next[activeIdx + 1], status: 'active' };
          }
        } else {
          // Start with first item
          if (dimIndex < next.length) {
            next[dimIndex] = { ...next[dimIndex], status: 'active' };
          }
        }
        dimIndex++;
        return next;
      });
    }, 8000); // advance every 8 seconds
    return () => clearInterval(advance);
  }, []);

  // SSE subscription for scan_progress and route events
  useEffect(() => {
    if (!sessionId) return;

    const tick = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);

    const unsubscribe = subscribeSSE(sessionId, (event, data) => {
      if (event === 'scan_progress') {
        const d = data as any;
        if (d.risk_level === 'HIGH') setProgress((p) => ({ ...p, high: d.found_count ?? p.high + 1 }));
        else if (d.risk_level === 'MEDIUM') setProgress((p) => ({ ...p, medium: d.found_count ?? p.medium + 1 }));
        else if (d.risk_level === 'LOW') setProgress((p) => ({ ...p, low: d.found_count ?? p.low + 1 }));
      } else if (event === 'route_interrupted') {
        setDimensions(SCAN_DIMENSIONS_DONE);
        setTimeout(() => navigate(`/contracts/${sessionId}/review`), 500);
      } else if (event === 'route_batch_review') {
        setDimensions(SCAN_DIMENSIONS_DONE);
        setTimeout(() => navigate(`/contracts/${sessionId}/batch`), 500);
      } else if (event === 'route_auto_passed') {
        setDimensions(SCAN_DIMENSIONS_DONE);
        setTimeout(() => navigate(`/contracts/${sessionId}/report`), 500);
      } else if (event === 'state_changed') {
        const newState = (data as any).state || (data as any).new_state;
        if (newState === 'hitl_pending' || newState === 'hitl_high_risk') {
          setDimensions(SCAN_DIMENSIONS_DONE);
          setTimeout(() => navigate(`/contracts/${sessionId}/review`), 500);
        } else if (newState === 'hitl_medium_confirm') {
          setDimensions(SCAN_DIMENSIONS_DONE);
          setTimeout(() => navigate(`/contracts/${sessionId}/batch`), 500);
        } else if (newState === 'report_ready' || newState === 'completed') {
          setDimensions(SCAN_DIMENSIONS_DONE);
          setTimeout(() => navigate(`/contracts/${sessionId}/report`), 500);
        }
      }
    });

    return () => {
      clearInterval(tick);
      unsubscribe();
    };
  }, [sessionId, navigate]);

  const handleRouteToReview = () => navigate(`/contracts/${sessionId}/review`);
  const handleRouteToBatch = () => navigate(`/contracts/${sessionId}/batch`);
  const handleRouteToReport = () => navigate(`/contracts/${sessionId}/report`);

  return (
    <div className="min-h-screen bg-gray-50">
      <GlobalNav />
      <WorkflowStatusBar sessionState="scanning" scanningStarted={true} />
      <div style={{ paddingTop: 78 }}>
        <div className="max-w-2xl mx-auto px-6 py-10">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
            {/* Scanning Animation */}
            <div className="text-center mb-8">
              <div className="relative inline-flex mb-4">
                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                </div>
                <div className="absolute inset-0 border-2 border-blue-200 rounded-full animate-ping opacity-50" />
              </div>
              <h2 className="text-gray-800" style={{ fontWeight: 600, fontSize: 18 }}>
                AI 正在扫描风险条款…
              </h2>
              {/* R01: 禁止显示「无风险」「扫描通过」等绝对化文字 */}
              <p className="text-sm text-gray-500 mt-2">已用时 {elapsedSeconds} 秒 · 系统正在分析合同条款，请稍候</p>
            </div>

            {/* Risk Counter — SSE scan_progress */}
            <div className="grid grid-cols-3 gap-3 mb-7">
              <div className="text-center bg-red-50 border border-red-100 rounded-xl py-4">
                <p className="text-2xl text-red-600" style={{ fontWeight: 700 }}>{progress.high}</p>
                <RiskLevelBadge level="HIGH" />
              </div>
              <div className="text-center bg-amber-50 border border-amber-100 rounded-xl py-4">
                <p className="text-2xl text-amber-600" style={{ fontWeight: 700 }}>{progress.medium}</p>
                <RiskLevelBadge level="MEDIUM" />
              </div>
              <div className="text-center bg-green-50 border border-green-100 rounded-xl py-4">
                <p className="text-2xl text-green-600" style={{ fontWeight: 700 }}>{progress.low}</p>
                <RiskLevelBadge level="LOW" />
              </div>
            </div>

            {/* Scan Dimensions */}
            <div className="space-y-2 mb-8">
              <p className="text-xs text-gray-400 mb-2">扫描维度（来源：后端配置）</p>
              {dimensions.map((dim) => (
                <div key={dim.id} className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    dim.status === 'done' ? 'bg-green-500' :
                    dim.status === 'active' ? 'bg-blue-500 animate-pulse' :
                    'bg-gray-200'
                  }`} />
                  <span className={`text-sm ${dim.status === 'pending' ? 'text-gray-400' : 'text-gray-700'}`}>
                    {dim.label}
                  </span>
                  {dim.status === 'active' && (
                    <span className="text-xs text-blue-500 flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> 进行中
                    </span>
                  )}
                  {dim.status === 'done' && (
                    <span className="text-xs text-green-500">✓</span>
                  )}
                </div>
              ))}
            </div>

            {/* Demo Route Controls */}
            <div className="border-t border-gray-100 pt-5">
              <p className="text-xs text-gray-400 mb-3 text-center">演示：模拟 SSE 分级路由事件</p>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={handleRouteToReview}
                  className="text-xs bg-red-50 border border-red-200 text-red-700 py-2 rounded-lg hover:bg-red-100 transition-colors"
                >
                  高风险路由<br />
                  <span className="text-red-400">→ P08 HITL 审核</span>
                </button>
                <button
                  onClick={handleRouteToBatch}
                  className="text-xs bg-amber-50 border border-amber-200 text-amber-700 py-2 rounded-lg hover:bg-amber-100 transition-colors"
                >
                  中风险路由<br />
                  <span className="text-amber-400">→ P09 批量复核</span>
                </button>
                <button
                  onClick={handleRouteToReport}
                  className="text-xs bg-green-50 border border-green-200 text-green-700 py-2 rounded-lg hover:bg-green-100 transition-colors"
                >
                  低风险自动通过<br />
                  <span className="text-green-400">→ P10 报告页</span>
                </button>
              </div>
              <p className="text-xs text-center text-gray-400 mt-2">SSE events: route_interrupted / route_batch_review / route_auto_passed</p>
            </div>
          </div>

          {/* Abort */}
          <div className="mt-4 flex justify-center">
            <button
              onClick={async () => {
                if (!sessionId) return;
                if (!window.confirm('确定要放弃本次审核流程吗？此操作不可逆。')) return;
                try {
                  await abortSession(sessionId, '用户主动放弃');
                  navigate('/contracts');
                } catch (err: any) {
                  alert(err.message || '放弃失败');
                }
              }}
              className="flex items-center gap-2 text-sm text-red-500 hover:text-red-700 hover:bg-red-50 px-4 py-2 rounded-lg transition-colors"
            >
              <XCircle className="w-4 h-4" /> 放弃并返回
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
