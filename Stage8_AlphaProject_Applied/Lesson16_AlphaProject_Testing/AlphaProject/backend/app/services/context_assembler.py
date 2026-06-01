"""F3 T005 — context_assembler.

Pulls sector / industry from F1 quote_service (if available) and filters
财联社电报 + 公告 to those whose title mentions the stock name, code, or
industry keyword. MVP uses keyword matching (FR-003); 向量 RAG 推 v1.1
(spec §2.2).
"""
from __future__ import annotations

import logging
from typing import Protocol

from app.models.explain import ExplainContext, NewsItem

logger = logging.getLogger(__name__)

MAX_NEWS_ITEMS = 5
MAX_ANNOUNCEMENTS = 3


class _NewsProvider(Protocol):
    def fetch_telegraph(self) -> list[NewsItem]: ...
    def fetch_announcements(self, code: str) -> list[NewsItem]: ...


class _QuoteProvider(Protocol):
    def sector_info(self, code: str) -> dict: ...


class ContextAssembler:
    def __init__(self, *, news: _NewsProvider, quote: _QuoteProvider | None = None) -> None:
        self.news = news
        self.quote = quote

    def _sector(self, code: str) -> tuple[str | None, float | None, str | None, bool]:
        """Return (sector, sector_pct, industry, ok). ok=False ⇒ partial."""
        if self.quote is None:
            return None, None, None, False
        try:
            info = self.quote.sector_info(code) or {}
            return (
                info.get("sector"),
                info.get("sector_change_pct"),
                info.get("industry"),
                True,
            )
        except Exception as exc:
            logger.warning("quote.sector_info(%s) failed: %s", code, exc)
            return None, None, None, False

    def _filter_relevant(
        self, items: list[NewsItem], keywords: list[str], cap: int
    ) -> list[NewsItem]:
        kws = [k for k in keywords if k]
        if not kws:
            return items[:cap]
        out: list[NewsItem] = []
        for item in items:
            t = item.title or ""
            if any(k in t for k in kws):
                out.append(item)
                if len(out) >= cap:
                    break
        return out

    def assemble(self, *, code: str, name: str) -> ExplainContext:
        sector, sector_pct, industry, quote_ok = self._sector(code)

        keywords = [name, code]
        if industry:
            keywords.append(industry)

        # News fetch with tolerance
        news_ok = True
        try:
            telegraph = self.news.fetch_telegraph()
        except Exception as exc:
            logger.warning("news telegraph fetch raised: %s", exc)
            telegraph = []
            news_ok = False

        ann_ok = True
        try:
            announcements = self.news.fetch_announcements(code)
        except Exception as exc:
            logger.warning("news announcements fetch raised: %s", exc)
            announcements = []
            ann_ok = False

        filtered_news = self._filter_relevant(telegraph, keywords, MAX_NEWS_ITEMS)
        filtered_ann = self._filter_relevant(
            announcements, [name, code], MAX_ANNOUNCEMENTS
        ) if announcements else []

        partial = not (quote_ok and news_ok and ann_ok)
        return ExplainContext(
            sector=sector,
            sector_change_pct=sector_pct,
            industry=industry,
            news=filtered_news,
            announcements=filtered_ann,
            partial=partial,
            empty=False,  # quote being missing alone is partial, not empty
        )
