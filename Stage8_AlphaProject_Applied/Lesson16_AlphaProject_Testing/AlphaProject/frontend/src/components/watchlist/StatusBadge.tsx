/**
 * DESIGN.md ref:
 *   §Components / Status Badges  — small, high-saturation rectangles
 *   §Shapes — rounded-sm (2px)
 *   §Typography — mono-label 11px
 */
import type { ReactNode } from "react";

interface Props {
  tone?: "holding" | "group" | "neutral";
  children: ReactNode;
}

const tones: Record<NonNullable<Props["tone"]>, string> = {
  // primary-tinted for portfolio (DESIGN.md Portfolio Highlighting)
  holding: "bg-[color:var(--color-primary)]/15 text-[color:var(--color-primary)] border-[color:var(--color-primary)]/40",
  group: "bg-[color:var(--color-surface-2)] text-[color:var(--color-foreground-muted)] border-[color:var(--color-surface-1-border)]",
  neutral: "bg-transparent text-[color:var(--color-foreground-subtle)] border-[color:var(--color-surface-1-border)]",
};

export function StatusBadge({ tone = "neutral", children }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[length:var(--text-mono-label)] font-mono tracking-tight ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
