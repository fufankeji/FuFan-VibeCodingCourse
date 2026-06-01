"""T013 — APScheduler registration + 交易时段门控.

F1 trading_calendar 尚未交付（005 阶段 F1 未合入）。本模块提供最小可用的
交易时段判定：A 股工作日 09:30-11:30 / 13:00-15:00，**不含**法定节假日
处理（v1.1 由 F1 完整 trading_calendar 接管）。

`register_scan_job(scheduler, svc)` — 把每 60 秒触发的 closure 挂到注入的
APScheduler 实例上；closure 内每次先检查 is_trading_hours()，非交易时段
跳过 scan_cycle（事件规则的全天扫描可由独立 job 实现，本 MVP 不增加）。
"""

from __future__ import annotations

import logging
from datetime import datetime, time
from typing import Callable

logger = logging.getLogger(__name__)

_MORNING_START = time(9, 30)
_MORNING_END = time(11, 30)
_AFTERNOON_START = time(13, 0)
_AFTERNOON_END = time(15, 0)


def is_trading_hours(now: datetime) -> bool:
    """MVP 判定：周一-周五 + 时段内. 节假日 (春节/国庆) 留给 F1 trading_calendar."""
    if now.weekday() >= 5:  # Sat/Sun
        return False
    t = now.time()
    if _MORNING_START <= t < _MORNING_END:
        return True
    if _AFTERNOON_START <= t < _AFTERNOON_END:
        return True
    return False


def register_scan_job(
    scheduler,
    anomaly_service,
    *,
    interval_seconds: int = 60,
    now: Callable[[], datetime] = datetime.now,
):
    """Register the 60-second cron job with trading-hours gating."""

    def _tick():
        if not is_trading_hours(now()):
            return
        try:
            anomaly_service.scan_cycle()
        except Exception:
            logger.exception("anomaly scan_cycle failed")

    scheduler.add_job(_tick, trigger="interval", seconds=interval_seconds, id="anomaly_scan")
    return _tick


__all__ = ["is_trading_hours", "register_scan_job"]
