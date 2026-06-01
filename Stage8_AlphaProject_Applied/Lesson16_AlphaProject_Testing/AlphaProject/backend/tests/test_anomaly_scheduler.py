"""T013 — scheduler registration + trading-session gate.

[出参验证] 交易时段 every-60s 触发; 午休/收盘不扫价格规则.
We test the trading-calendar guard function in isolation (no real APScheduler tick).
"""
from datetime import datetime
from unittest.mock import MagicMock

from app.services.anomaly_scheduler import (
    is_trading_hours,
    register_scan_job,
)


def test_is_trading_hours_morning_session():
    assert is_trading_hours(datetime(2026, 5, 28, 10, 0, 0))  # Thu 10:00


def test_is_trading_hours_afternoon_session():
    assert is_trading_hours(datetime(2026, 5, 28, 14, 30, 0))


def test_is_trading_hours_lunch_break():
    assert not is_trading_hours(datetime(2026, 5, 28, 12, 0, 0))


def test_is_trading_hours_before_open():
    assert not is_trading_hours(datetime(2026, 5, 28, 9, 0, 0))


def test_is_trading_hours_after_close():
    assert not is_trading_hours(datetime(2026, 5, 28, 15, 30, 0))


def test_is_trading_hours_weekend():
    assert not is_trading_hours(datetime(2026, 5, 30, 10, 0, 0))  # Sat


def test_register_scan_job_adds_60s_interval():
    scheduler = MagicMock()
    svc = MagicMock()
    register_scan_job(scheduler, svc)
    assert scheduler.add_job.called
    kwargs = scheduler.add_job.call_args.kwargs
    # 60-second cadence
    assert kwargs.get("trigger") == "interval"
    assert kwargs.get("seconds") == 60


def test_registered_job_skips_when_not_trading():
    scheduler = MagicMock()
    svc = MagicMock()
    register_scan_job(
        scheduler, svc,
        now=lambda: datetime(2026, 5, 30, 10, 0, 0),  # Saturday
    )
    job = scheduler.add_job.call_args.args[0]
    job()
    svc.scan_cycle.assert_not_called()


def test_registered_job_runs_during_session():
    scheduler = MagicMock()
    svc = MagicMock()
    register_scan_job(
        scheduler, svc,
        now=lambda: datetime(2026, 5, 28, 10, 0, 0),
    )
    job = scheduler.add_job.call_args.args[0]
    job()
    svc.scan_cycle.assert_called_once()
