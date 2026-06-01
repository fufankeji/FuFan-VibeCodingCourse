"""G-03 · B-④.b · AkShare fetcher 超时/挂起降级覆盖

`_akshare_fetcher` 不能从外部加超时（akshare 内部 requests 调用，无 hook）。
能控制的边界：refresh() 必须**捕获任何**外呼异常并保留既有缓存，不能让 background
task 因一次 timeout 永久死亡。本测试覆盖三类超时异常 + 验证后续 refresh 重试。

风险级：P1（启动 / 后台任务韧性，告警级）
可追溯：F5 / 001 / R-01 (AkShare 限流) / PRD §13.4 fallback chain
"""

import socket

import pytest

from app.services.stock_basic_service import StockBasicService

SAMPLE = [
    {"code": "600519", "name": "贵州茅台"},
    {"code": "000001", "name": "平安银行"},
]


@pytest.mark.parametrize(
    "exc",
    [
        socket.timeout("read timed out"),
        ConnectionError("connection reset"),
        TimeoutError("asyncio-style timeout"),
        RuntimeError("ak.stock_info_a_code_name raised internally"),
    ],
)
def test_fetcher_timeout_preserves_cache_and_does_not_propagate(exc, caplog):
    s = StockBasicService(fetcher=lambda: SAMPLE)
    s.refresh()  # warm cache
    assert s.search("茅台")  # baseline

    s._fetcher = lambda: (_ for _ in ()).throw(exc)
    with caplog.at_level("WARNING"):
        s.refresh()  # must NOT raise

    # Cache preserved
    assert {r["code"] for r in s.search("茅台")} == {"600519"}
    # Failure logged (background task can keep retrying tomorrow)
    assert any("fetcher" in r.message.lower() or "failed" in r.message.lower()
               for r in caplog.records), (
        "Refresh failure must be logged so the daily background task is "
        "observable in stderr; silent failure breaks alerting."
    )


def test_fetcher_recovers_on_next_call(caplog):
    """After a transient failure, the next successful refresh refills the cache."""
    s = StockBasicService(fetcher=lambda: SAMPLE)
    s.refresh()
    assert s.search("茅台")
    # Inject failure
    s._fetcher = lambda: (_ for _ in ()).throw(TimeoutError("transient"))
    with caplog.at_level("WARNING"):
        s.refresh()
    # Recover
    s._fetcher = lambda: SAMPLE + [{"code": "688981", "name": "中芯国际"}]
    s.refresh()
    assert {r["code"] for r in s.search("中芯")} == {"688981"}
