"""Stock basic info (code <-> name) cache + multi-mode search.

Source of truth: AkShare (lazy-imported in production). Tests inject a fetcher.
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from typing import TypedDict

from pypinyin import Style, lazy_pinyin

logger = logging.getLogger(__name__)


class StockBasic(TypedDict):
    code: str
    name: str


Fetcher = Callable[[], list[StockBasic]]


def _akshare_fetcher() -> list[StockBasic]:
    import akshare as ak

    df = ak.stock_info_a_code_name()
    df = df.rename(columns={col: col.lower() for col in df.columns})
    return df.to_dict("records")  # type: ignore[return-value]


class StockBasicService:
    def __init__(self, fetcher: Fetcher | None = None) -> None:
        self._fetcher: Fetcher = fetcher or _akshare_fetcher
        self._records: list[StockBasic] = []
        self._initials_index: dict[str, set[str]] = {}  # code -> set of initials prefixes

    def refresh(self) -> None:
        try:
            records = list(self._fetcher())
        except Exception as exc:
            logger.warning("Stock basic fetcher failed, keeping cached %d records: %s",
                           len(self._records), exc)
            return
        self._records = records
        self._initials_index = {
            r["code"]: {"".join(lazy_pinyin(r["name"], style=Style.FIRST_LETTER)).lower()}
            for r in records
        }

    def search(self, query: str) -> list[StockBasic]:
        q = query.strip().lower()
        if not q:
            return []
        out: list[StockBasic] = []
        for r in self._records:
            code = r["code"]
            name = r["name"]
            if code.startswith(q):
                out.append(r)
                continue
            if q in name.lower():
                out.append(r)
                continue
            initials = next(iter(self._initials_index.get(code, set())), "")
            if initials.startswith(q):
                out.append(r)
        return out
