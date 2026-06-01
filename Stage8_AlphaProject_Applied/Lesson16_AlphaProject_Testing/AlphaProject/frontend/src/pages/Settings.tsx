/**
 * 设置 · 凭证状态 + 异动规则开关 + 推送控制
 * 复用 Stitch token 体系（与其他 4 页视觉一致），全中文。
 */
import { useEffect, useState } from "react";
import { Mi } from "../components/shell/Mi";

interface RuleConfig {
  limit_enabled: boolean;
  breakout_enabled: boolean;
  volume_enabled: boolean;
  amplitude_enabled: boolean;
  event_enabled: boolean;
  amplitude_pct?: number;
  volume_ratio?: number;
}
interface PushStatus { webhook_ok: boolean; muted: boolean; undelivered_count: number; }

export function Settings() {
  const [rules, setRules] = useState<RuleConfig | null>(null);
  const [push, setPush] = useState<PushStatus | null>(null);

  const reload = async () => {
    try {
      const [r1, r2] = await Promise.all([fetch("/anomaly/rules"), fetch("/push/status")]);
      if (r1.ok) setRules(await r1.json());
      if (r2.ok) setPush(await r2.json());
    } catch { /* noop */ }
  };
  useEffect(() => { void reload(); }, []);

  const toggleRule = async (key: keyof RuleConfig) => {
    if (!rules) return;
    const next = { ...rules, [key]: !rules[key] };
    setRules(next);
    await fetch("/anomaly/rules", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ [key]: next[key] }),
    });
  };

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2">
          <Mi name="settings" className="text-primary" />
          系统设置
        </h1>
        <p className="font-mono-label text-mono-label text-on-surface-variant mt-1">
          凭证状态 · 异动规则 · 推送控制。敏感凭证只显示连接态，不显示明文。
        </p>
      </header>

      <Section title="凭证连接" icon="vpn_key">
        <Row label="飞书 Lark App" value={push?.webhook_ok ? "✅ 已连接" : "❌ 未连接"} tone={push?.webhook_ok ? "bull" : "bear"} />
        <Row label="飞书目标会话" value={push?.webhook_ok ? "测试 群（chat_id 已配置）" : "未配置"} />
        <Row label="主 LLM" value="✅ OpenRouter · DeepSeek-V3" tone="bull" />
        <Row label="备 LLM" value="✅ OpenRouter · Qwen2.5-72B" tone="bull" />
        <Row label="行情数据源" value="✅ AkShare + Tencent qt 直连" tone="bull" />
        <Row label="未送达消息" value={push?.undelivered_count ? `${push.undelivered_count} 条待回放` : "0 条"} />
      </Section>

      <Section title="异动规则" icon="rule">
        {rules ? (
          <>
            <Toggle label="涨跌停（含 ST ±5%）" checked={rules.limit_enabled} onChange={() => toggleRule("limit_enabled")} />
            <Toggle label="突破 / 跌破前 60 日" checked={rules.breakout_enabled} onChange={() => toggleRule("breakout_enabled")} />
            <Toggle label={`量能异常（量比 > ${rules.volume_ratio ?? 3}）`} checked={rules.volume_enabled} onChange={() => toggleRule("volume_enabled")} />
            <Toggle label={`振幅异常（日内 > ${rules.amplitude_pct ?? 8}%）`} checked={rules.amplitude_enabled} onChange={() => toggleRule("amplitude_enabled")} />
            <Toggle label="事件 / 公告（财联社红色 + 自选股关联）" checked={rules.event_enabled} onChange={() => toggleRule("event_enabled")} />
          </>
        ) : (
          <p className="font-mono-label text-mono-label text-on-surface-variant">加载中…</p>
        )}
      </Section>

      <Section title="推送控制" icon="notifications">
        <Row label="全局静音" value={push?.muted ? "🔇 已静音（不推送）" : "🔔 正常推送"} />
        <p className="font-caption text-caption text-outline pt-2">
          静音不影响异动检测和入库，只阻断飞书出口；解除静音后历史命中不会回放。
        </p>
      </Section>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <section className="bg-surface-card border border-surface-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-border bg-surface-container-low flex items-center gap-2">
        <Mi name={icon} size={20} className="text-primary" />
        <h2 className="font-headline-sm text-headline-sm text-on-surface">{title}</h2>
      </div>
      <div className="p-4 flex flex-col gap-2">{children}</div>
    </section>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex justify-between font-table-data text-table-data">
      <span className="text-on-surface-variant">{label}</span>
      <span className={tone ? `text-${tone}` : "text-on-surface"}>{value}</span>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex items-center justify-between font-table-data text-table-data cursor-pointer">
      <span className="text-on-surface">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        className={`h-5 w-10 rounded-full transition-colors duration-150 relative ${
          checked ? "bg-primary" : "bg-surface-container-high"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform duration-150 ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );
}
