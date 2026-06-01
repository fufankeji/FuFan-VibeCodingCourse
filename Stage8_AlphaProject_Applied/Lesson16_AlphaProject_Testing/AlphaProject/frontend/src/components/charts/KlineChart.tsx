/**
 * F1 T011 — Kline Chart (TradingView Lightweight Charts wrapper).
 *
 * DESIGN.md ref:
 *   §Components — chart area
 *   §Colors — A-share bull/bear K-line painting
 * Reference HTML: a_ai_1/code.html — Chart Canvas.
 *
 * Memory: strictly manages chart instance lifecycle via useEffect cleanup
 *   (R-4: lightweight-charts imperative API needs explicit chart.remove()).
 *
 * Spec FR-007: 详情页 K 线渲染.
 * Degrade: empty data => "K 线加载失败" placeholder (T012 wraps higher logic).
 */
import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type Time,
} from "lightweight-charts";

import type { KlinePointDto } from "../../services/sdk";

interface Props {
  data: KlinePointDto[];
  height?: number;
}

export function KlineChart({ data, height = 320 }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      height,
      autoSize: true,
      layout: {
        background: { color: "transparent" },
        textColor:
          getComputedStyle(document.documentElement).getPropertyValue("--color-foreground-muted").trim() || undefined,
      },
      grid: {
        vertLines: { color: "transparent" },
        horzLines: { color: "transparent" },
      },
    });
    // FD-3 A 股 红涨绿跌 — token values pulled at runtime from DESIGN.md vars.
    const bull = getComputedStyle(document.documentElement).getPropertyValue("--color-bull").trim();
    const bear = getComputedStyle(document.documentElement).getPropertyValue("--color-bear").trim();
    const series = chart.addSeries(CandlestickSeries, {
      upColor: bull,
      downColor: bear,
      borderUpColor: bull,
      borderDownColor: bear,
      wickUpColor: bull,
      wickDownColor: bear,
    });
    chartRef.current = chart;
    seriesRef.current = series;
    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [height]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    const items: CandlestickData<Time>[] = data.map((p) => ({
      time: p.ts.slice(0, 10) as Time, // YYYY-MM-DD
      open: p.open,
      high: p.high,
      low: p.low,
      close: p.close,
    }));
    series.setData(items);
  }, [data]);

  if (data.length === 0) {
    return (
      <div
        role="status"
        className="flex h-[320px] items-center justify-center text-[length:var(--text-caption)] text-[color:var(--color-foreground-muted)]"
      >
        K 线加载失败，请重试
      </div>
    );
  }
  return <div ref={containerRef} className="w-full" style={{ height }} />;
}
