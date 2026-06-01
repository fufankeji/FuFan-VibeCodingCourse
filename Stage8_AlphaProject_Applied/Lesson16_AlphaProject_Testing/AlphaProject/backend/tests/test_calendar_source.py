"""F4 T005 — calendar_source."""
from app.models.briefing import BlockStatus
from app.services.calendar_source import CalendarSource


def test_fetch_returns_ready_when_ok():
    src = CalendarSource(
        fetch_earnings=lambda: [{"code": "600519", "event": "中报"}],
        fetch_econ=lambda: [{"name": "CPI", "time": "09:30"}],
    )
    blk = src.fetch()
    assert blk.status == BlockStatus.ready
    assert blk.data["earnings"][0]["code"] == "600519"
    assert blk.data["econ"][0]["name"] == "CPI"


def test_fetch_returns_missing_when_all_fail():
    def boom():
        raise RuntimeError("akshare down")

    src = CalendarSource(fetch_earnings=boom, fetch_econ=boom)
    blk = src.fetch()
    assert blk.status == BlockStatus.missing
    assert blk.data is None


def test_partial_failure_still_ready():
    src = CalendarSource(
        fetch_earnings=lambda: (_ for _ in ()).throw(RuntimeError("e")),
        fetch_econ=lambda: [{"name": "CPI"}],
    )
    blk = src.fetch()
    assert blk.status == BlockStatus.ready
    assert blk.data["earnings"] == []
    assert blk.data["econ"][0]["name"] == "CPI"
