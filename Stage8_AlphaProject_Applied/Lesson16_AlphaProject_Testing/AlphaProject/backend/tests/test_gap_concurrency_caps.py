"""G-01 · B-③.a · 并发 read-then-write 突破 30/5 上限

Backend-testing 闭环补测：30/5 caps 校验是 read→check→write 两段，无锁。
两个并发线程同时通过 `len(items) < 30` 后各自 INSERT，最终可达 31 只。
RED demonstrates；GREEN 加 threading.Lock 在 service 层串行化。

风险级：P0（数据完整性，阻断发布）
可追溯：F5 / 001-watchlist-crud / cap=30 (FR-003) / cap=5 holding (FR-004)
"""

from __future__ import annotations

import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path


from app.db import init_db
from app.errors import WatchlistError
from app.repositories.watchlist_repo import WatchlistRepo
from app.services.watchlist_service import WatchlistService


def _make_svc(tmp_path: Path) -> WatchlistService:
    db_path = tmp_path / "alpha.db"
    init_db(db_path)
    return WatchlistService(repo=WatchlistRepo(db_path), max_total=30, max_holding=5)


def test_concurrent_add_does_not_exceed_30_cap(tmp_path: Path):
    svc = _make_svc(tmp_path)
    # Pre-load to 29 so two parallel adds race for slot #30
    for i in range(29):
        svc.add(code=f"6{i:05d}", name=f"股{i}")
    assert len(svc.repo.list_active()) == 29

    start_barrier = threading.Barrier(2)
    results: list[Exception | None] = [None, None]

    def attempt(idx: int, code: str) -> None:
        start_barrier.wait()
        try:
            svc.add(code=code, name=f"竞争{idx}")
        except WatchlistError as e:
            results[idx] = e

    with ThreadPoolExecutor(max_workers=2) as ex:
        f1 = ex.submit(attempt, 0, "777771")
        f2 = ex.submit(attempt, 1, "777772")
        f1.result()
        f2.result()

    final = svc.repo.list_active()
    # Invariant: never exceed cap, regardless of how many threads tried
    assert len(final) <= 30, (
        f"CAP VIOLATED: got {len(final)} items in watchlist; one of the "
        f"concurrent adds should have been rejected with WatchlistError"
    )
    # Exactly one must have been rejected (or neither got in; but both
    # cannot have been admitted past cap=30)
    rejected = [r for r in results if isinstance(r, WatchlistError)]
    admitted = [r for r in results if r is None]
    assert len(admitted) <= 1, (
        "Both threads succeeded — 30/5 cap is not enforced atomically"
    )
    # If exactly one was admitted, the other must say 上限
    if len(rejected) == 1:
        assert "上限 30" in str(rejected[0])


def test_concurrent_holding_toggle_does_not_exceed_5_cap(tmp_path: Path):
    svc = _make_svc(tmp_path)
    # 5 non-holding rows + pre-load 4 holdings
    for i in range(4):
        svc.add(code=f"6{i:05d}", name=f"持仓{i}", is_holding=True)
    for i in range(5):
        svc.add(code=f"5{i:05d}", name=f"观察{i}")
    assert sum(1 for x in svc.repo.list_active() if x.is_holding) == 4

    start_barrier = threading.Barrier(2)
    results: list[Exception | None] = [None, None]

    def attempt(idx: int, code: str) -> None:
        start_barrier.wait()
        try:
            svc.update(code, is_holding=True)
        except WatchlistError as e:
            results[idx] = e

    with ThreadPoolExecutor(max_workers=2) as ex:
        f1 = ex.submit(attempt, 0, "500000")
        f2 = ex.submit(attempt, 1, "500001")
        f1.result()
        f2.result()

    holdings = sum(1 for x in svc.repo.list_active() if x.is_holding)
    assert holdings <= 5, (
        f"HOLDING CAP VIOLATED: got {holdings} holdings; one toggle should "
        f"have been rejected"
    )
