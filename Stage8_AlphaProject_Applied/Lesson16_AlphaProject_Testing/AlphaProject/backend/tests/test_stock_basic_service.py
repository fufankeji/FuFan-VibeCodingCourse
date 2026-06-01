import pytest

from app.services.stock_basic_service import StockBasicService

SAMPLE = [
    {"code": "600519", "name": "贵州茅台"},
    {"code": "000001", "name": "平安银行"},
    {"code": "688981", "name": "中芯国际"},
]


@pytest.fixture
def svc() -> StockBasicService:
    s = StockBasicService(fetcher=lambda: SAMPLE)
    s.refresh()
    return s


def test_search_by_exact_code(svc: StockBasicService):
    results = svc.search("600519")
    assert {r["code"] for r in results} == {"600519"}


def test_search_by_code_prefix(svc: StockBasicService):
    results = svc.search("6005")
    assert "600519" in {r["code"] for r in results}


def test_search_by_name_contains(svc: StockBasicService):
    results = svc.search("茅台")
    assert {r["code"] for r in results} == {"600519"}


def test_search_by_pinyin_initials(svc: StockBasicService):
    results = svc.search("gzmt")
    assert "600519" in {r["code"] for r in results}


def test_search_partial_pinyin_initials(svc: StockBasicService):
    # "pa" should match 平安银行 (PAYH initials start with "pa")
    results = svc.search("pa")
    assert "000001" in {r["code"] for r in results}


def test_search_empty_returns_empty(svc: StockBasicService):
    assert svc.search("") == []
    assert svc.search("   ") == []


def test_fetcher_failure_falls_back_to_cache(caplog):
    s = StockBasicService(fetcher=lambda: SAMPLE)
    s.refresh()  # populate cache
    s._fetcher = lambda: (_ for _ in ()).throw(RuntimeError("akshare down"))
    with caplog.at_level("WARNING"):
        s.refresh()  # should NOT raise; should log
    # cache still works
    assert svc_search_codes(s, "茅台") == {"600519"}


def svc_search_codes(s: StockBasicService, q: str) -> set[str]:
    return {r["code"] for r in s.search(q)}
