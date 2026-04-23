"use client";

import React, { useMemo, useState } from 'react';
import { User, Key, CreditCard, Users, Link as LinkIcon, AlertCircle, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { MODEL_PRICING } from '@/lib/schemas/model-pricing';
import { estimateCost, formatUSD, levelOf } from '@/lib/token-estimator';

// [Prep-02] 修复 #3: 钥匙 SVG 空态插画
function KeyIllustration() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-fg-muted">
      <circle cx="22" cy="22" r="12" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="22" cy="22" r="5" stroke="currentColor" strokeWidth="1.5" />
      <line x1="31" y1="31" x2="54" y2="54" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="54" y1="54" x2="54" y2="46" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="54" y1="54" x2="46" y2="54" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="44" y1="44" x2="44" y2="38" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// [Prep-02] 修复 #3: 通用空态插画（用于账单/团队/集成）
function EmptyIllustration() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-fg-muted">
      <rect x="8" y="12" width="32" height="24" rx="4" stroke="currentColor" strokeWidth="1.5" />
      <line x1="8" y1="20" x2="40" y2="20" stroke="currentColor" strokeWidth="1.5" />
      <line x1="14" y1="28" x2="26" y2="28" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="14" y1="32" x2="20" y2="32" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState('profile');

  const tabs = [
    { id: 'profile', label: '个人资料', icon: User },
    { id: 'apikeys', label: 'API 密钥', icon: Key },
    { id: 'billing', label: '账单', icon: CreditCard },
    { id: 'team', label: '团队', icon: Users },
    { id: 'integrations', label: '集成', icon: LinkIcon },
  ];

  return (
    <div className="mx-auto flex w-full max-w-[1024px] flex-col px-[24px] py-[24px] gap-[24px]">
      {/* [Prep-02] 修复 #4: md 下顶部水平 Tabs */}
      <div>
        <h2 className="mb-[12px] text-[20px] font-semibold text-fg-default">账户设置</h2>
        <div className="flex overflow-x-auto border-b border-border-default md:hidden">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex shrink-0 items-center gap-[8px] px-[12px] py-[12px] text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-default/40 ${
                  activeTab === tab.id
                    ? 'text-primary-default border-b-2 border-primary-default'
                    : 'text-fg-secondary hover:text-fg-default'
                }`}
              >
                <Icon className="h-[14px] w-[14px]" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex gap-[24px]">
        {/* 左侧 Sidebar（md 以上） */}
        <aside className="hidden w-[200px] shrink-0 md:block">
          <nav className="sticky top-[80px] flex flex-col gap-[4px]">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-[12px] rounded-[8px] px-[12px] py-[8px] text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-default/40 ${
                    activeTab === tab.id
                      ? 'bg-primary-default/10 text-primary-default'
                      : 'text-fg-secondary hover:bg-bg-subtle hover:text-fg-default'
                  }`}
                >
                  <Icon className={`h-[16px] w-[16px] ${activeTab === tab.id ? 'text-primary-default' : 'text-fg-muted'}`} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* 右侧表单区 */}
        <main className="flex-1 min-w-0">
          {activeTab === 'profile' && (
            <div className="flex flex-col gap-[24px]">
              <div>
                <h1 className="text-[20px] font-semibold text-fg-default">个人资料</h1>
                <p className="mt-[4px] text-[13px] text-fg-secondary">管理你的基本信息和头像。</p>
              </div>

              <Card>
                <CardHeader className="p-[20px] pb-[12px]">
                  <CardTitle className="text-[16px]">公开信息</CardTitle>
                  <CardDescription className="text-[13px]">这将在你的 Agent 商店页面上显示。</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-[16px] px-[20px] pb-[16px] pt-0">
                  <div className="flex flex-col gap-[8px]">
                    <label className="text-[13px] font-medium text-fg-default">显示名称</label>
                    <Input defaultValue="Agent Developer" className="max-w-[400px]" />
                  </div>
                  <div className="flex flex-col gap-[8px]">
                    <label className="text-[13px] font-medium text-fg-default">邮箱地址</label>
                    <Input defaultValue="developer@example.com" type="email" disabled className="max-w-[400px] bg-bg-muted" />
                    <p className="text-[12px] text-fg-muted flex items-center gap-[4px]">
                      <AlertCircle className="h-[12px] w-[12px]" /> 邮箱不支持直接修改，请联系支持。
                    </p>
                  </div>
                </CardContent>
                <CardFooter className="border-t border-border-subtle px-[20px] py-[12px] flex justify-end">
                  {/* [Prep-02] 修复 #5: Save → 存好 */}
                  <Button>
                    <Save className="mr-[8px] h-[14px] w-[14px]" />
                    存好
                  </Button>
                </CardFooter>
              </Card>

              <Card className="border-status-error/50">
                <CardHeader className="p-[20px] pb-[12px]">
                  <CardTitle className="text-[16px] text-status-error">危险操作</CardTitle>
                  <CardDescription className="text-[13px]">永久删除你的账户及所有相关数据。</CardDescription>
                </CardHeader>
                <CardContent className="px-[20px] pb-[12px] pt-0">
                  <p className="text-[13px] text-fg-secondary">
                    删除账户后，你创建的 Agent、运行历史和绑定的 API 密钥将被永久清除且无法恢复。
                  </p>
                </CardContent>
                <CardFooter className="border-t border-border-subtle px-[20px] py-[12px]">
                  <Button variant="outline" className="text-status-error hover:bg-status-error/10 hover:border-status-error">删除账户</Button>
                </CardFooter>
              </Card>
            </div>
          )}

          {/* [Prep-02] 修复 #3: API Keys 空态 + Phase-3 Token 预估器 */}
          {activeTab === 'apikeys' && (
            <div className="flex flex-col gap-[24px]">
              <div>
                <h1 className="text-[20px] font-semibold text-fg-default">API 密钥</h1>
                <p className="mt-[4px] text-[13px] text-fg-secondary">管理你的 API Key，用于程序化访问。</p>
              </div>
              <div className="flex h-[240px] flex-col items-center justify-center rounded-[8px] border border-dashed border-border-strong text-center">
                <KeyIllustration />
                <p className="mt-[16px] mb-[16px] text-[15px] font-medium text-fg-secondary">还没有 API Key</p>
                <Button>生成新 Key</Button>
              </div>

              <TokenEstimator />
            </div>
          )}

          {activeTab === 'billing' && (
            <div className="flex flex-col gap-[24px]">
              <div>
                <h1 className="text-[20px] font-semibold text-fg-default">账单</h1>
                <p className="mt-[4px] text-[13px] text-fg-secondary">查看用量和账单明细。</p>
              </div>
              <div className="flex h-[320px] flex-col items-center justify-center rounded-[8px] border border-dashed border-border-strong text-center">
                <EmptyIllustration />
                <p className="mt-[16px] text-[14px] text-fg-secondary">这里还空着</p>
              </div>
            </div>
          )}

          {activeTab === 'team' && (
            <div className="flex flex-col gap-[24px]">
              <div>
                <h1 className="text-[20px] font-semibold text-fg-default">团队</h1>
                <p className="mt-[4px] text-[13px] text-fg-secondary">管理团队成员和权限。</p>
              </div>
              <div className="flex h-[320px] flex-col items-center justify-center rounded-[8px] border border-dashed border-border-strong text-center">
                <EmptyIllustration />
                <p className="mt-[16px] text-[14px] text-fg-secondary">这里还空着</p>
              </div>
            </div>
          )}

          {activeTab === 'integrations' && (
            <div className="flex flex-col gap-[24px]">
              <div>
                <h1 className="text-[20px] font-semibold text-fg-default">集成</h1>
                <p className="mt-[4px] text-[13px] text-fg-secondary">连接第三方服务和工具。</p>
              </div>
              <div className="flex h-[320px] flex-col items-center justify-center rounded-[8px] border border-dashed border-border-strong text-center">
                <EmptyIllustration />
                <p className="mt-[16px] text-[14px] text-fg-secondary">这里还空着</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function TokenEstimator() {
  const [prompt, setPrompt] = useState('');
  const [modelId, setModelId] = useState<string>(MODEL_PRICING[0].id);

  const { inputTokens, outputTokens, costUSD, level } = useMemo(() => {
    const r = estimateCost(prompt, modelId);
    return { ...r, level: levelOf(r.costUSD) };
  }, [prompt, modelId]);

  const levelStyles: Record<typeof level, { dot: string; text: string; bg: string; label: string }> = {
    green: {
      dot: 'bg-emerald-500',
      text: 'text-emerald-600',
      bg: 'bg-emerald-50 border-emerald-200',
      label: '安全区',
    },
    yellow: {
      dot: 'bg-amber-500',
      text: 'text-amber-600',
      bg: 'bg-amber-50 border-amber-200',
      label: '注意',
    },
    red: {
      dot: 'bg-rose-500',
      text: 'text-rose-600',
      bg: 'bg-rose-50 border-rose-200',
      label: '偏贵',
    },
  };
  const s = levelStyles[level];

  return (
    <Card>
      <CardHeader className="p-[20px] pb-[12px]">
        <CardTitle className="text-[16px]">Token 预估器</CardTitle>
        <CardDescription className="text-[13px]">敲什么算什么——发送前先看到这次调用大概会花多少钱。</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-[16px] px-[20px] pb-[16px] pt-0">
        <div className="flex flex-col gap-[8px]">
          <label htmlFor="token-est-model" className="text-[13px] font-medium text-fg-default">选模型</label>
          <select
            id="token-est-model"
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            className="max-w-[400px] h-[36px] rounded-[6px] border border-border-default bg-bg-default px-[10px] text-[13px] text-fg-default focus:outline-none focus:ring-2 focus:ring-primary-default/40"
          >
            {MODEL_PRICING.map((m) => (
              <option key={m.id} value={m.id}>
                {m.displayName}（{m.provider} · 输入 ${m.inputPricePer1M}/M · 输出 ${m.outputPricePer1M}/M）
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-[8px]">
          <label htmlFor="token-est-prompt" className="text-[13px] font-medium text-fg-default">Prompt</label>
          <Textarea
            id="token-est-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="把你准备发的 prompt 粘进来，实时看花多少..."
            className="min-h-[120px] text-[13px]"
          />
        </div>

        <div className={`flex flex-wrap items-center justify-between gap-[12px] rounded-[8px] border px-[12px] py-[10px] ${s.bg}`}>
          <div className="flex items-center gap-[10px]">
            <span className={`inline-block h-[8px] w-[8px] rounded-full ${s.dot}`} aria-hidden />
            <span className={`text-[13px] font-medium ${s.text}`}>{s.label}</span>
          </div>
          <div className="flex flex-wrap items-center gap-[16px] text-[13px] text-fg-secondary">
            <span>输入 <span className="font-mono text-fg-default">{inputTokens}</span> tokens</span>
            <span>输出约 <span className="font-mono text-fg-default">{outputTokens}</span> tokens</span>
            <span>本次约 <span className={`font-mono font-semibold ${s.text}`}>{formatUSD(costUSD)}</span></span>
          </div>
        </div>

        <p className="text-[12px] text-fg-muted">
          粗估（按 4 字符/token），误差 ±30%，用于事前预警；计费以 provider 返回为准。
        </p>
      </CardContent>
    </Card>
  );
}