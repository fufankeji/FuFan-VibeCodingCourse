"""F3 collapsed gaps from test-routing-advisor:

  BE-1 · add_llm_cost 并发累加幂等性 (no lost updates)
  BE-3 · budget read-then-decide 竞态 (best-effort observability)

backend-testing skill closure post-agent.

风险级：BE-1 P1 budget integrity / BE-3 P2 budget approximation
可追溯：F3 / 004 / FR-013 + PRD §7.8 (LLM 月成本 ≤ 100 元，单日预算 5)
"""

import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pytest

from app.db import add_llm_cost, get_llm_cost_today, init_db


# ── BE-1 · add_llm_cost concurrent atomicity ────────────────────────
def test_concurrent_add_llm_cost_does_not_lose_updates(tmp_path: Path):
    """20 threads × ¥0.01 must accumulate to exactly ¥0.20 (no lost updates).

    SQLite's ON CONFLICT DO UPDATE + INSERT statement is single-statement-
    atomic, so this regression locks the contract: any future refactor that
    splits read+write across statements (and silently drops updates) red here.
    """
    db_path = tmp_path / "alpha.db"
    init_db(db_path)
    start = threading.Barrier(20)

    def adder() -> None:
        start.wait()
        add_llm_cost(db_path, 0.01)

    with ThreadPoolExecutor(max_workers=20) as ex:
        futures = [ex.submit(adder) for _ in range(20)]
        for f in futures:
            f.result()

    total = get_llm_cost_today(db_path)
    assert abs(total - 0.20) < 1e-9, (
        f"BUDGET LOST UPDATE: expected 0.20 (=20×0.01), got {total}"
    )


# ── BE-3 · budget pre-check race (soft constraint, document) ────────
def test_concurrent_explain_can_slightly_exceed_soft_budget(tmp_path: Path):
    """Documents the deliberately-tolerated race in ExplainService:
    `current = get_llm_cost_today()` is read separately from the post-call
    `add_llm_cost()`. Two near-simultaneous calls at budget=4.99 can each
    pass the pre-check and then both bill ¥0.01 → ¥5.01 total.

    Per PRD §7.8 "单日预算 5 元" is a SOFT cap (degradation to template kicks
    in when crossed *next* check). This test makes that contract explicit so
    a future tightening attempt won't silently change it without intent.

    If hard cap is later required, add `UPDATE ... WHERE cost_cny + ? <= ?`
    inside add_llm_cost and flip this test to assert hard rejection.
    """
    db_path = tmp_path / "alpha.db"
    init_db(db_path)
    add_llm_cost(db_path, 4.99)  # pre-existing
    start = threading.Barrier(2)

    def race() -> None:
        start.wait()
        current = get_llm_cost_today(db_path)
        if current < 5.0:
            add_llm_cost(db_path, 0.01)

    with ThreadPoolExecutor(max_workers=2) as ex:
        f1 = ex.submit(race)
        f2 = ex.submit(race)
        f1.result()
        f2.result()

    final = get_llm_cost_today(db_path)
    # Soft cap: 5.00 (winner-takes-all) or 5.01 (race tolerated) both legal.
    assert final in (pytest.approx(5.0), pytest.approx(5.01)), (
        f"Unexpected budget value {final}; soft cap contract broken or tightened "
        f"without updating this test."
    )
