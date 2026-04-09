import { html, nothing } from "lit";
import type { CronJob, CronRunLogEntry } from "../types.ts";

export type PolymarketProps = {
  connected: boolean;
  loading: boolean;
  running: string | null;
  scanJob: CronJob | null;
  reportJob: CronJob | null;
  scanRuns: CronRunLogEntry[];
  reportRuns: CronRunLogEntry[];
  lastError: string | null;
  lastSuccess: string | null;
  onRunJob: (job: CronJob) => void;
  onToggleJob: (job: CronJob) => void;
  onRefresh: () => void;
};

function formatTs(ms: number | undefined): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDuration(ms: number | undefined): string {
  if (!ms) return "";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function statusBadge(status: string | undefined) {
  if (!status) return nothing;
  const isOk = status === "success" || status === "ok";
  const color = isOk ? "var(--color-success, #22c55e)" : "var(--color-danger, #ef4444)";
  const label = isOk ? "成功" : status === "error" ? "失败" : status;
  return html`<span
    style="display:inline-block;padding:1px 8px;border-radius:9999px;font-size:11px;font-weight:600;
           background:${color}22;color:${color};border:1px solid ${color}44"
    >${label}</span
  >`;
}

function renderJobCard(
  job: CronJob | null,
  runs: CronRunLogEntry[],
  label: string,
  description: string,
  running: string | null,
  props: PolymarketProps,
) {
  const isRunning = running === job?.id;
  const lastRun = runs[0];
  const state = job?.state as
    | {
        nextRunAtMs?: number;
        lastRunAtMs?: number;
        lastRunStatus?: string;
        lastDurationMs?: number;
        consecutiveErrors?: number;
      }
    | undefined;

  const scheduleLabel = (() => {
    if (!job?.schedule) return "—";
    const s = job.schedule as { kind?: string; everyMs?: number; expr?: string; tz?: string };
    if (s.kind === "every" && s.everyMs) {
      const mins = Math.floor(s.everyMs / 60000);
      return `每 ${mins} 分钟`;
    }
    if (s.kind === "cron" && s.expr) {
      return `${s.expr}${s.tz ? ` (${s.tz})` : ""}`;
    }
    return "—";
  })();

  return html`
    <div
      style="border:1px solid var(--color-border,#334155);border-radius:8px;padding:16px;
             background:var(--color-surface,#1e293b)"
    >
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div>
          <div style="font-weight:600;font-size:14px;color:var(--color-fg,#f1f5f9)">${label}</div>
          <div style="font-size:12px;color:var(--color-fg-muted,#94a3b8);margin-top:2px">
            ${description}
          </div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          ${job
            ? html`<button
                  @click=${() => props.onToggleJob(job)}
                  style="padding:3px 10px;border-radius:5px;font-size:12px;cursor:pointer;
                         background:${job.enabled ? "#22c55e22" : "#94a3b822"};
                         color:${job.enabled ? "#22c55e" : "#94a3b8"};
                         border:1px solid ${job.enabled ? "#22c55e44" : "#94a3b844"}"
                >
                  ${job.enabled ? "已启用" : "已暂停"}
                </button>`
            : nothing}
          <button
            @click=${() => (job ? props.onRunJob(job) : null)}
            ?disabled=${!job || !props.connected || isRunning}
            style="padding:4px 14px;border-radius:5px;font-size:12px;cursor:pointer;
                   background:var(--color-primary,#3b82f6);color:#fff;border:none;
                   opacity:${!job || !props.connected || isRunning ? "0.5" : "1"}"
          >
            ${isRunning ? "运行中…" : "立即运行"}
          </button>
        </div>
      </div>

      <div
        style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px"
      >
        <div style="font-size:12px">
          <div style="color:var(--color-fg-muted,#94a3b8);margin-bottom:2px">调度</div>
          <div style="color:var(--color-fg,#f1f5f9)">${scheduleLabel}</div>
        </div>
        <div style="font-size:12px">
          <div style="color:var(--color-fg-muted,#94a3b8);margin-bottom:2px">上次运行</div>
          <div style="color:var(--color-fg,#f1f5f9)">
            ${formatTs(state?.lastRunAtMs)}
            ${state?.lastRunStatus ? statusBadge(state.lastRunStatus) : nothing}
          </div>
        </div>
        <div style="font-size:12px">
          <div style="color:var(--color-fg-muted,#94a3b8);margin-bottom:2px">下次运行</div>
          <div style="color:var(--color-fg,#f1f5f9)">${formatTs(state?.nextRunAtMs)}</div>
        </div>
      </div>

      ${
        state?.consecutiveErrors && state.consecutiveErrors > 0
          ? html`<div
              style="font-size:12px;padding:6px 10px;border-radius:5px;
                     background:#ef444422;color:#ef4444;margin-bottom:10px"
            >
              连续失败 ${state.consecutiveErrors} 次
            </div>`
          : nothing
      }

      ${
        lastRun?.summary
          ? html`
              <div style="margin-top:8px">
                <div
                  style="font-size:11px;color:var(--color-fg-muted,#94a3b8);margin-bottom:4px"
                >
                  最近结果
                </div>
                <div
                  style="font-size:12px;color:var(--color-fg,#f1f5f9);padding:8px 10px;
                         background:#0f172a;border-radius:5px;white-space:pre-wrap;
                         max-height:80px;overflow:auto;line-height:1.5"
                >
                  ${lastRun.summary}
                </div>
                <div style="font-size:11px;color:var(--color-fg-muted,#94a3b8);margin-top:4px">
                  ${formatTs(lastRun.ts)}
                  ${lastRun.durationMs ? html`· 耗时 ${formatDuration(lastRun.durationMs)}` : nothing}
                  ${lastRun.model ? html`· ${lastRun.model}` : nothing}
                </div>
              </div>
            `
          : nothing
      }
    </div>
  `;
}

export function renderPolymarket(props: PolymarketProps) {
  return html`
    <div style="padding:24px;max-width:900px;margin:0 auto">
      <!-- Header -->
      <div
        style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px"
      >
        <div>
          <div style="font-size:16px;font-weight:600;color:var(--color-fg,#f1f5f9)">
            📈 Polymarket Autopilot
          </div>
          <div style="font-size:12px;color:var(--color-fg-muted,#94a3b8);margin-top:4px">
            自动监控 Polymarket 预测市场，执行模拟交易策略，不涉及真实资金
          </div>
        </div>
        <button
          @click=${props.onRefresh}
          ?disabled=${!props.connected || props.loading}
          style="padding:6px 14px;border-radius:6px;font-size:12px;cursor:pointer;
                 background:var(--color-surface,#1e293b);
                 border:1px solid var(--color-border,#334155);
                 color:var(--color-fg,#f1f5f9);
                 opacity:${!props.connected || props.loading ? "0.5" : "1"}"
        >
          ${props.loading ? "加载中…" : "刷新"}
        </button>
      </div>

      ${
        props.lastError
          ? html`<div
              style="margin-bottom:16px;padding:8px 12px;border-radius:6px;
                     background:#ef444422;color:#ef4444;font-size:13px"
            >
              ${props.lastError}
            </div>`
          : nothing
      }
      ${
        props.lastSuccess
          ? html`<div
              style="margin-bottom:16px;padding:8px 12px;border-radius:6px;
                     background:#22c55e22;color:#22c55e;font-size:13px"
            >
              ${props.lastSuccess}
            </div>`
          : nothing
      }

      <!-- No jobs warning -->
      ${
        !props.loading && !props.scanJob && !props.reportJob
          ? html`<div
              style="padding:20px;text-align:center;border:1px dashed var(--color-border,#334155);
                     border-radius:8px;color:var(--color-fg-muted,#94a3b8);font-size:13px"
            >
              未找到 Polymarket cron 任务。请确认 Gateway 正在运行，且 jobs.json 中包含
              <code>polymarket-scan</code> 和 <code>polymarket-daily-report</code>。
            </div>`
          : nothing
      }

      <!-- Job Cards -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">
        ${renderJobCard(
          props.scanJob,
          props.scanRuns,
          "🔍 市场扫描",
          "每15分钟扫描活跃市场，识别 TAIL/BONDING 交易机会",
          props.running,
          props,
        )}
        ${renderJobCard(
          props.reportJob,
          props.reportRuns,
          "📊 每日日报",
          "每天8点（北京时间）查询数据并发送 Discord 日报",
          props.running,
          props,
        )}
      </div>

      <!-- Strategy Explanation -->
      <div
        style="border:1px solid var(--color-border,#334155);border-radius:8px;padding:16px;
               background:var(--color-surface,#1e293b)"
      >
        <div
          style="font-size:13px;font-weight:600;color:var(--color-fg,#f1f5f9);margin-bottom:12px"
        >
          📖 策略说明
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div>
            <div style="font-size:12px;font-weight:600;color:#f59e0b;margin-bottom:6px">
              TAIL 策略
            </div>
            <div style="font-size:12px;color:var(--color-fg-muted,#94a3b8);line-height:1.6">
              当"YES"赔率 &gt; 85% 时，做空（买 NO）；赔率 60-85% 时，跟多（买 YES）。
              <br />押注过热市场的价格回归。
            </div>
          </div>
          <div>
            <div style="font-size:12px;font-weight:600;color:#22c55e;margin-bottom:6px">
              BONDING 策略
            </div>
            <div style="font-size:12px;color:var(--color-fg-muted,#94a3b8);line-height:1.6">
              当"YES"赔率 &lt; 15% 时，做多（买 YES）；赔率 15-30% 时，跟多。
              <br />押注被低估市场的价格修复。
            </div>
          </div>
        </div>
        <div
          style="margin-top:12px;padding:8px 10px;border-radius:5px;
                 background:#0f172a;font-size:11px;color:#94a3b8"
        >
          💡 所有交易为模拟（Paper Trading），每笔交易金额 $100，起始资金 $10,000。数据库路径：
          <code style="color:#60a5fa"
            >~/.openclaw/workspace-dev/polymarket/trades.db</code
          >
        </div>
      </div>
    </div>
  `;
}
