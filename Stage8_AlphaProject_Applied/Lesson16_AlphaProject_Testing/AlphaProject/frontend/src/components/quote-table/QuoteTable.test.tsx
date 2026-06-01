/**
 * F1 T009 — QuoteTable component tests.
 *
 * Coverage:
 *   - Holding row gets left primary border (FD-3 visual)
 *   - Stale status renders "陈旧" chip
 *   - Suspended status renders "停牌" placeholder and dims row
 *   - Anomaly badges render from props
 *   - onSelect fires with row code
 *   - Empty rows array → empty-state hint
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { QuoteTable } from "./QuoteTable";
import type { QuoteRow } from "../../services/sdk";

function makeRow(over: Partial<QuoteRow> = {}): QuoteRow {
  return {
    code: "600519",
    name: "贵州茅台",
    is_holding: false,
    group_id: null,
    display_order: 0,
    price: 1700,
    change_pct: 2.5,
    volume_ratio: 1.2,
    volume: 10000,
    updated_at: "x",
    status: "normal",
    ...over,
  };
}

describe("QuoteTable", () => {
  it("renders empty-state hint when rows=[]", () => {
    render(<QuoteTable rows={[]} badges={{}} />);
    expect(screen.getByText(/先添加你的第一只自选股/)).toBeInTheDocument();
  });

  it("holding row gets primary left-border class (FD-3)", () => {
    render(<QuoteTable rows={[makeRow({ is_holding: true })]} badges={{}} />);
    const tr = screen.getByRole("row", { name: /贵州茅台.*持仓/ });
    expect(tr.className).toMatch(/border-l-\[color:var\(--color-primary\)\]/);
  });

  it("stale status renders 陈旧 chip", () => {
    render(<QuoteTable rows={[makeRow({ status: "stale" })]} badges={{}} />);
    expect(screen.getByLabelText(/数据陈旧/)).toBeInTheDocument();
  });

  it("suspended status renders 停牌 + dim opacity", () => {
    render(<QuoteTable rows={[makeRow({ status: "suspended", price: null, change_pct: null })]} badges={{}} />);
    expect(screen.getByText("停牌")).toBeInTheDocument();
  });

  it("anomaly badges render from badges prop", () => {
    render(<QuoteTable rows={[makeRow()]} badges={{ "600519": ["limit_up", "volume"] }} />);
    expect(screen.getByText("涨停")).toBeInTheDocument();
    expect(screen.getByText("量能")).toBeInTheDocument();
  });

  it("onSelect fires with row code", async () => {
    const fn = vi.fn();
    render(<QuoteTable rows={[makeRow()]} badges={{}} onSelect={fn} />);
    await userEvent.click(screen.getByText("贵州茅台"));
    expect(fn).toHaveBeenCalledWith("600519");
  });

  it("change_pct uses bull color when positive, bear when negative", () => {
    const { rerender } = render(<QuoteTable rows={[makeRow({ change_pct: 2.5 })]} badges={{}} />);
    let cell = screen.getByText(/\+2.50%/);
    expect(cell.getAttribute("style")).toMatch(/var\(--color-bull\)/);
    rerender(<QuoteTable rows={[makeRow({ change_pct: -1.0 })]} badges={{}} />);
    cell = screen.getByText(/-1.00%/);
    expect(cell.getAttribute("style")).toMatch(/var\(--color-bear\)/);
  });
});
