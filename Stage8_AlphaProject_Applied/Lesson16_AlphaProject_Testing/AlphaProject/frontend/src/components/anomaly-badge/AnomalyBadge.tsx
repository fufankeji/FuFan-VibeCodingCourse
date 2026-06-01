/**
 * F1 T009 — Anomaly Badge (F2 003-T009 contract: badge string from /anomaly/badges).
 *
 * DESIGN.md ref: §Components — Status Badges (small high-saturation rectangles,
 *   white/black text; rounded-sm 2px; no pill shapes — avoid wasted horizontal
 *   space in dense tables).
 * Reference: dashboard_a_ai/code.html — 突破/量能异常 badges.
 *
 * F2 enum (from anomaly_state.all_badges): limit_up, limit_down, breakout,
 * breakdown, volume, amplitude, event.
 * Friendly degrade: unknown badge string just renders raw lowercase.
 */
const BADGE_META: Record<string, { label: string; tone: "bull" | "bear" | "primary" | "warning" | "neutral" }> = {
  limit_up: { label: "涨停", tone: "bull" },
  limit_down: { label: "跌停", tone: "bear" },
  breakout: { label: "突破", tone: "primary" },
  breakdown: { label: "破位", tone: "primary" },
  volume: { label: "量能", tone: "warning" },
  amplitude: { label: "振幅", tone: "warning" },
  event: { label: "事件", tone: "neutral" },
};

const TONE_VAR: Record<string, string> = {
  bull: "--color-bull",
  bear: "--color-bear",
  primary: "--color-primary",
  warning: "--color-warning",
  neutral: "--color-foreground-muted",
};

export function AnomalyBadge({ kind }: { kind: string }) {
  const meta = BADGE_META[kind] ?? { label: kind, tone: "neutral" as const };
  const colorVar = TONE_VAR[meta.tone];
  return (
    <span
      role="status"
      aria-label={`异动徽章 ${meta.label}`}
      className="rounded-[var(--radius-sm)] px-1 py-0.5 text-[length:var(--text-caption)] font-medium text-[color:var(--color-surface-base)]"
      style={{ backgroundColor: `var(${colorVar})` }}
    >
      {meta.label}
    </span>
  );
}
