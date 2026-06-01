"""G-05 · B-③.b · purge_expired_soft_deletes 与 list_active 并发安全

Background task 每 60s 跑 purge；同时 REST GET /watchlist 读 list_active。
两路并发不能：① 触发 sqlite3.OperationalError（database is locked）
              ② 返回半完成视图（部分 row 已 hard_delete 但 group 仍占用计数）

风险级：P2（运维稳定性，告警级）
可追溯：F5 / 001 / T008 purge / T012 snapshot
"""

import threading
from datetime import datetime, timedelta
from pathlib import Path

from app.db import init_db
from app.repositories.watchlist_repo import WatchlistRepo
from app.services.watchlist_service import WatchlistService


def test_purge_and_concurrent_reads_do_not_deadlock(tmp_path: Path):
    db_path = tmp_path / "alpha.db"
    init_db(db_path)
    base = datetime(2026, 5, 28, 14, 30, 0)
    svc = WatchlistService(
        repo=WatchlistRepo(db_path),
        max_total=30,
        max_holding=5,
        clock=lambda: base,
    )
    # Pre-populate 20 items, soft-delete 10 of them
    for i in range(20):
        svc.add(code=f"6{i:05d}", name=f"股{i}")
    for i in range(10):
        svc.remove(f"6{i:05d}")
    # Advance clock past undo window so purge can hard-delete them
    svc.clock = lambda: base + timedelta(seconds=120)

    errors: list[BaseException] = []
    stop = threading.Event()
    reads_completed = 0

    def reader():
        nonlocal reads_completed
        while not stop.is_set():
            try:
                _ = svc.snapshot()  # list_active under the hood
                reads_completed += 1
            except BaseException as e:  # noqa: BLE001
                errors.append(e)

    def purger():
        try:
            for _ in range(5):
                svc.purge_expired_soft_deletes()
        except BaseException as e:  # noqa: BLE001
            errors.append(e)

    readers = [threading.Thread(target=reader) for _ in range(4)]
    for r in readers:
        r.start()
    p = threading.Thread(target=purger)
    p.start()
    p.join(timeout=3.0)
    stop.set()
    for r in readers:
        r.join(timeout=2.0)

    assert errors == [], f"concurrent reads/purge raised: {errors!r}"
    assert reads_completed >= 1, "reads never completed"
    # Final state: 10 active rows remain (the never-deleted ones); soft-deleted
    # rows were purged.
    final = svc.repo.list_active()
    assert len(final) == 10
    assert len(svc.repo.list_soft_deleted()) == 0
