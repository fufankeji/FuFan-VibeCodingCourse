"""T004: news_source — AkShare wrapper + 60s cache + failure tolerance.

[出参验证] 返回近期电报/公告列表；源失败返缓存或空+不抛异常。
"""
import pandas as pd

from app.services import news_source as ns


def test_fetch_telegraph_success(monkeypatch):
    df = pd.DataFrame(
        {
            "title": ["茅台业绩超预期", "光伏新政落地"],
            "pub_time": ["2026-05-28 09:00", "2026-05-28 08:30"],
        }
    )
    monkeypatch.setattr(ns, "_akshare_telegraph", lambda: df)
    src = ns.NewsSource(ttl_s=60)
    out = src.fetch_telegraph()
    assert len(out) == 2
    assert out[0].title == "茅台业绩超预期"


def test_fetch_telegraph_swallows_exception(monkeypatch):
    def boom():
        raise RuntimeError("akshare 限流")

    monkeypatch.setattr(ns, "_akshare_telegraph", boom)
    src = ns.NewsSource(ttl_s=60)
    out = src.fetch_telegraph()
    assert out == []  # 不抛异常


def test_cache_hit_within_ttl(monkeypatch):
    calls = {"n": 0}

    def stub():
        calls["n"] += 1
        return pd.DataFrame({"title": ["x"], "pub_time": ["t"]})

    monkeypatch.setattr(ns, "_akshare_telegraph", stub)
    now = [1000.0]
    src = ns.NewsSource(ttl_s=60, clock=lambda: now[0])
    src.fetch_telegraph()
    src.fetch_telegraph()
    src.fetch_telegraph()
    assert calls["n"] == 1  # 缓存命中


def test_cache_expires_after_ttl(monkeypatch):
    calls = {"n": 0}

    def stub():
        calls["n"] += 1
        return pd.DataFrame({"title": ["x"], "pub_time": ["t"]})

    monkeypatch.setattr(ns, "_akshare_telegraph", stub)
    now = [1000.0]
    src = ns.NewsSource(ttl_s=60, clock=lambda: now[0])
    src.fetch_telegraph()
    now[0] += 70
    src.fetch_telegraph()
    assert calls["n"] == 2


def test_fetch_announcements_success(monkeypatch):
    df = pd.DataFrame(
        {"title": ["关于股东减持的公告"], "pub_time": ["2026-05-25"]}
    )
    monkeypatch.setattr(ns, "_akshare_announcements", lambda code: df)
    src = ns.NewsSource(ttl_s=60)
    out = src.fetch_announcements("600519")
    assert len(out) == 1


def test_announcements_failure_returns_empty(monkeypatch):
    monkeypatch.setattr(
        ns, "_akshare_announcements", lambda code: (_ for _ in ()).throw(RuntimeError("x"))
    )
    src = ns.NewsSource(ttl_s=60)
    assert src.fetch_announcements("600519") == []
