"""F4 T006 — simbao-level prompt.

Distinct from F3's single-stock explain prompt: 4-section structure +
≤1200 字 cap. System message holds rules; user message holds facts.
"""
from __future__ import annotations

import json

from app.config import settings
from app.models.briefing import BlockStatus, DataBlock

SYSTEM_PROMPT = (
    "你是 A 股盯盘助手的早盘简报引擎。任务：基于给定 4 类事实，输出 ≤"
    f"{settings.BRIEFING_BODY_LIMIT} 字的中文早盘简报。\n"
    "结构（严格 4 区块）：\n"
    "① 市场概览：隔夜外盘 + 昨日 A 股收盘 + 重点板块；\n"
    "② 我的自选股：按持仓 / 异动优先排序，每股一句要点评论；\n"
    "③ 财联社昨夜要闻：≤5 条最相关；\n"
    "④ 今日日历：财报披露 + 经济数据。\n"
    "硬性约束：\n"
    "- 禁止任何投资建议性词汇：建议买入 / 建议卖出 / 强烈推荐 / 目标价 / 抄底 / 满仓；\n"
    "- 不预测未来价格、不给操作建议，只做信息整理；\n"
    f"- 总字数不得超过 {settings.BRIEFING_BODY_LIMIT} 字（含标点）；\n"
    "- 不需要重复风险免责语，调用方会自动追加。"
)


def _block_facts(label: str, blk: DataBlock) -> str:
    if blk.status == BlockStatus.missing:
        return f"【{label}】暂无数据"
    if blk.status == BlockStatus.loading:
        return f"【{label}】数据获取中"
    payload = blk.data if blk.data is not None else {}
    try:
        rendered = json.dumps(payload, ensure_ascii=False, indent=None)
    except (TypeError, ValueError):
        rendered = str(payload)
    return f"【{label}】{rendered}"


def build_briefing_messages(
    *,
    market_overview: DataBlock,
    watchlist: DataBlock,
    news: DataBlock,
    calendar: DataBlock,
) -> list[dict[str, str]]:
    user = "\n\n".join(
        [
            _block_facts("市场概览", market_overview),
            _block_facts("我的自选股", watchlist),
            _block_facts("财联社昨夜要闻", news),
            _block_facts("今日日历", calendar),
        ]
    )
    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user},
    ]
