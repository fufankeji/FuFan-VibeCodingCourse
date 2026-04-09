import { useState } from 'react';
import { Users, Shield, Sliders, ChevronRight, AlertCircle } from 'lucide-react';
import { GlobalNav } from '../components/GlobalNav';

type AdminSection = 'users' | 'rules' | 'thresholds';

const MOCK_USERS_LIST = [
  { id: 'user-001', name: '张三', role: '审核员（reviewer）', email: 'zhangsan@example.com', status: '活跃' },
  { id: 'user-002', name: '李四', role: '提交员（submitter）', email: 'lisi@example.com', status: '活跃' },
  { id: 'user-003', name: '王管理', role: '管理员（admin）', email: 'admin@example.com', status: '活跃' },
];

const MOCK_RULES = [
  { id: 'rule-001', name: '单边条款检测', type: 'rule_engine', enabled: true, updatedAt: '2026-03-01' },
  { id: 'rule-002', name: '违约金比例监测', type: 'rule_engine', enabled: true, updatedAt: '2026-03-05' },
  { id: 'rule-003', name: '保密范围过宽检测', type: 'rule_engine', enabled: true, updatedAt: '2026-02-28' },
  { id: 'rule-004', name: '争议解决条款分析', type: 'ai_inference', enabled: true, updatedAt: '2026-03-10' },
  { id: 'rule-005', name: '知识产权归属分析', type: 'ai_inference', enabled: false, updatedAt: '2026-02-20' },
];

/**
 * AdminPage — P11 系统管理页
 * 仅 admin 角色可访问
 * 管理接口（api_spec 未覆盖范围）— 以下模拟数据展示
 */
export function AdminPage() {
  const [activeSection, setActiveSection] = useState<AdminSection>('users');
  const [highRiskThreshold, setHighRiskThreshold] = useState(75);
  const [lowConfThreshold, setLowConfThreshold] = useState(60);

  const navItems: { id: AdminSection; label: string; icon: React.ReactNode }[] = [
    { id: 'users', label: '用户管理', icon: <Users className="w-4 h-4" /> },
    { id: 'rules', label: '风险规则配置', icon: <Shield className="w-4 h-4" /> },
    { id: 'thresholds', label: '风险阈值配置', icon: <Sliders className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <GlobalNav />
      <div className="pt-14">
        <div className="max-w-6xl mx-auto px-6 py-6">
          {/* 未开发 Banner */}
          <div className="bg-yellow-50 border-2 border-yellow-400 rounded-xl px-5 py-4 mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-yellow-800" style={{ fontWeight: 700 }}>未开发：管理后台 API</p>
              <p className="text-xs text-yellow-700 mt-1">
                后端未实现用户管理、规则配置、阈值配置等管理接口（api_spec 未覆盖范围）。以下内容为 UI 原型展示，所有操作按钮为占位，无实际功能。
              </p>
            </div>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-6 flex gap-6">
          {/* Left Sidebar */}
          <div className="w-52 shrink-0">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm text-gray-700" style={{ fontWeight: 600 }}>系统管理</p>
                <p className="text-xs text-gray-400 mt-0.5">admin 角色专属</p>
              </div>
              <nav className="py-1">
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id)}
                    className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors ${
                      activeSection === item.id
                        ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-500'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {item.icon}
                    {item.label}
                    {activeSection === item.id && <ChevronRight className="w-3 h-3 ml-auto" />}
                  </button>
                ))}
              </nav>
            </div>

            {/* API Note */}
            <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-xl p-3">
              <div className="flex items-start gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-yellow-600 shrink-0 mt-0.5" />
                <p className="text-xs text-yellow-700">
                  <span style={{ fontWeight: 600 }}>接口说明</span>
                  <br />
                  系统管理接口（api_spec 未覆盖范围），以下均为示例数据展示
                </p>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {activeSection === 'users' && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h2 className="text-gray-800" style={{ fontWeight: 600, fontSize: 15 }}>用户管理</h2>
                  <span className="text-xs text-gray-400">管理接口 api_spec 未覆盖</span>
                </div>
                <div className="overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-left px-5 py-2.5 text-xs text-gray-500">用户 ID</th>
                        <th className="text-left px-5 py-2.5 text-xs text-gray-500">姓名</th>
                        <th className="text-left px-5 py-2.5 text-xs text-gray-500">角色</th>
                        <th className="text-left px-5 py-2.5 text-xs text-gray-500">邮箱</th>
                        <th className="text-left px-5 py-2.5 text-xs text-gray-500">状态</th>
                        <th className="text-left px-5 py-2.5 text-xs text-gray-500">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {MOCK_USERS_LIST.map((u) => (
                        <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-5 py-3 text-xs text-gray-400 font-mono">{u.id}</td>
                          <td className="px-5 py-3 text-gray-800">{u.name}</td>
                          <td className="px-5 py-3 text-gray-600 text-xs">{u.role}</td>
                          <td className="px-5 py-3 text-gray-500 text-xs">{u.email}</td>
                          <td className="px-5 py-3">
                            <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">{u.status}</span>
                          </td>
                          <td className="px-5 py-3">
                            <button
                              onClick={() => alert('管理接口未开发，此为 UI 占位')}
                              className="text-xs text-blue-600 hover:text-blue-800"
                            >
                              编辑
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeSection === 'rules' && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h2 className="text-gray-800" style={{ fontWeight: 600, fontSize: 15 }}>风险规则配置</h2>
                  <span className="text-xs text-gray-400">管理接口 api_spec 未覆盖</span>
                </div>
                <div className="overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-left px-5 py-2.5 text-xs text-gray-500">规则名称</th>
                        <th className="text-left px-5 py-2.5 text-xs text-gray-500">类型</th>
                        <th className="text-left px-5 py-2.5 text-xs text-gray-500">启用状态</th>
                        <th className="text-left px-5 py-2.5 text-xs text-gray-500">最后更新</th>
                        <th className="text-left px-5 py-2.5 text-xs text-gray-500">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {MOCK_RULES.map((rule) => (
                        <tr key={rule.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-5 py-3 text-gray-800">{rule.name}</td>
                          <td className="px-5 py-3">
                            <span className={`text-xs px-1.5 py-0.5 rounded border ${
                              rule.type === 'rule_engine'
                                ? 'bg-blue-100 text-blue-700 border-solid border-blue-300'
                                : 'bg-purple-100 text-purple-700 border-dashed border-purple-300'
                            }`}>
                              {rule.type === 'rule_engine' ? '规则引擎' : 'AI 推理'}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded ${rule.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                              {rule.enabled ? '已启用' : '已禁用'}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-xs text-gray-400">{rule.updatedAt}</td>
                          <td className="px-5 py-3">
                            <button
                              onClick={() => alert('规则配置接口未开发，此为 UI 占位')}
                              className="text-xs text-blue-600 hover:text-blue-800"
                            >
                              配置
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeSection === 'thresholds' && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-gray-800" style={{ fontWeight: 600, fontSize: 15 }}>风险阈值配置</h2>
                  <span className="text-xs text-gray-400">管理接口 api_spec 未覆盖</span>
                </div>
                <div className="space-y-6">
                  <ThresholdItem
                    label="高风险条款置信度下限"
                    description="confidence_score ≥ 此值时，AI 判断有效性更高（当前：75%）"
                    value={highRiskThreshold}
                    onChange={setHighRiskThreshold}
                    color="red"
                  />
                  <ThresholdItem
                    label="低置信度字段阈值（需人工核对）"
                    description="ExtractedField.confidence_score < 此值时，触发 needs_human_verification = true"
                    value={lowConfThreshold}
                    onChange={setLowConfThreshold}
                    color="orange"
                  />

                  <div className="pt-4 border-t border-gray-100">
                    <button
                      onClick={() => alert('阈值配置接口未开发，此为 UI 占位\n变更需有确认步骤防止误操作')}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm transition-colors"
                      style={{ fontWeight: 500 }}
                    >
                      保存配置
                    </button>
                    <p className="text-xs text-gray-400 mt-2">配置变更将生效于下次风险扫描，需二次确认（防误操作）</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ThresholdItem({ label, description, value, onChange, color }: {
  label: string; description: string; value: number;
  onChange: (v: number) => void; color: 'red' | 'orange';
}) {
  const colorClass = color === 'red' ? 'accent-red-500' : 'accent-orange-500';
  return (
    <div>
      <label className="block text-sm text-gray-700 mb-1" style={{ fontWeight: 500 }}>{label}</label>
      <p className="text-xs text-gray-400 mb-2">{description}</p>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={100}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className={`flex-1 ${colorClass}`}
        />
        <span className="text-sm text-gray-700 w-12" style={{ fontWeight: 600 }}>{value}%</span>
      </div>
    </div>
  );
}
