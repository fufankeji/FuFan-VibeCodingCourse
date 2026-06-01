"""F4 T007 — 4-section Markdown card builder.

Renders BriefingContent into a飞书 Markdown string with:
  - 4 区块固定顺序
  - 数据缺失区块降级占位（暂无数据 / 数据获取中）
  - 自选 0 只跳过该区块（FR-009）
  - 版本标签（预热版 / 完整版 / 裸数据 / 占位）
"""
from __future__ import annotations

from app.models.briefing import BlockStatus, BriefingContent, BriefingVersion, DataBlock

_VERSION_LABEL = {
    BriefingVersion.warmup: "预热版（数据补全中）",
    BriefingVersion.full: "完整版",
    BriefingVersion.raw: "裸数据版（AI 生成超时）",
    BriefingVersion.placeholder: "今日数据获取异常",
}


def _heading(label: str, version_tag: str | None = None) -> str:
    return f"### {label}" + (f"  ·  {version_tag}" if version_tag else "")


def _section(label: str, lines: list[str]) -> str:
    return _heading(label) + "\n" + "\n".join(lines)


def _market_lines(blk: DataBlock) -> list[str]:
    if blk.status == BlockStatus.missing:
        return ["- 暂无数据"]
    if blk.status == BlockStatus.loading:
        return ["- 数据获取中"]
    d = blk.data or {}
    out: list[str] = []
    for g in d.get("global") or []:
        out.append(f"- 外盘 {g.get('name')}: {g.get('change_pct')}%")
    y = d.get("yesterday") or {}
    if y:
        sh = y.get("sh")
        if sh is not None:
            out.append(f"- 上证昨收 {sh}")
    for s in d.get("sectors") or []:
        out.append(f"- 板块 {s.get('name')}: {s.get('change_pct')}%")
    if not out:
        out.append("- 暂无数据")
    return out


def _watchlist_lines(blk: DataBlock) -> list[str]:
    if blk.status == BlockStatus.missing:
        return ["- 暂无数据"]
    if blk.status == BlockStatus.loading:
        return ["- 数据获取中"]
    items = blk.data or []
    lines = []
    for it in items:
        code = it.get("code", "")
        name = it.get("name", "")
        chg = it.get("change_pct")
        comment = it.get("comment", "")
        tail = f" {chg}%" if chg is not None else ""
        if comment:
            tail += f" — {comment}"
        lines.append(f"- {name}（{code}）{tail}")
    return lines


def _news_lines(blk: DataBlock) -> list[str]:
    if blk.status == BlockStatus.missing:
        return ["- 暂无数据"]
    if blk.status == BlockStatus.loading:
        return ["- 数据获取中"]
    items = blk.data or []
    if not items:
        return ["- 暂无数据"]
    return [f"- {it.get('title', '')}" for it in items[:5]]


def _calendar_lines(blk: DataBlock) -> list[str]:
    if blk.status == BlockStatus.missing:
        return ["- 暂无数据"]
    if blk.status == BlockStatus.loading:
        return ["- 数据获取中"]
    d = blk.data or {}
    lines: list[str] = []
    for e in d.get("earnings") or []:
        lines.append(f"- 财报：{e.get('code', '')} {e.get('event', '')}")
    for c in d.get("econ") or []:
        t = c.get("time", "")
        lines.append(f"- 经济：{c.get('name', '')}{(' ' + t) if t else ''}")
    if not lines:
        lines.append("- 暂无数据")
    return lines


def build_card(content: BriefingContent) -> str:
    """Render BriefingContent → Markdown card body (sans risk disclaimer tail —
    that is appended by sensitive_filter at push time)."""
    parts: list[str] = []
    parts.append(f"# A 股早盘简报  ·  {_VERSION_LABEL[content.version]}")
    if content.body_text:
        parts.append(content.body_text)
    parts.append(_section("市场概览", _market_lines(content.market_overview)))
    # FR-009: 自选 0 只 → 跳过区块
    wl_data = content.watchlist.data
    if not (content.watchlist.status == BlockStatus.ready and isinstance(wl_data, list) and len(wl_data) == 0):
        parts.append(_section("我的自选股", _watchlist_lines(content.watchlist)))
    parts.append(_section("财联社昨夜要闻", _news_lines(content.news)))
    parts.append(_section("今日日历", _calendar_lines(content.calendar)))
    return "\n\n".join(parts)
