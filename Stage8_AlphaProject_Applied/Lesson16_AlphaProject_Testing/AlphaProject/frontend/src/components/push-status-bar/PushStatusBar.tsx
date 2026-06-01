/**
 * F1 T013 — Push status bar (F6 consumer).
 *
 * DESIGN.md ref:
 *   §Components — Budget Guard Banner 同款条幅
 *   §Colors — warning / anomaly tone for undelivered count
 * Reference HTML: ai_a_ai (告警条参考).
 *
 * Spec FR-014: F6 push 状态可用时显示未送达数 / 连接 / 静音；F6 未就绪时降级隐藏.
 * Store sets pushStatus=null when /push/status fetch fails → return null = hide.
 */
import type { PushStatusDto } from "../../services/sdk";

interface Props {
  status: PushStatusDto | null;
}

export function PushStatusBar({ status }: Props) {
  if (!status) return null;
  const danger = !status.webhook_ok || status.undelivered_count > 0;
  if (!danger && !status.muted) return null;
  const bgVar = status.webhook_ok ? "--color-warning" : "--color-bear";
  return (
    <div
      role="alert"
      aria-label="推送状态"
      className="px-3 py-1 text-[length:var(--text-caption)] font-medium text-[color:var(--color-surface-base)]"
      style={{ backgroundColor: `var(${bgVar})` }}
    >
      {!status.webhook_ok
        ? "飞书 webhook 不可达"
        : status.undelivered_count > 0
          ? `${status.undelivered_count} 条推送未送达`
          : ""}
      {status.muted ? " · 全局静音中" : ""}
    </div>
  );
}
