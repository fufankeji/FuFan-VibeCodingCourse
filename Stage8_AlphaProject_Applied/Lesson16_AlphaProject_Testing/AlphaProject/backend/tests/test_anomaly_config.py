"""T001 — anomaly thresholds in settings.

[FR-013, FR-004] 阈值可读可覆盖：振幅 / 量比 / 涵盖窗口 / 各板涨跌停 %.
"""
import os
from importlib import reload


def _reload_settings():
    import app.config as cfg
    reload(cfg)
    return cfg.settings


def test_anomaly_thresholds_defaults():
    # Ensure no env override
    for k in [
        "ANOMALY_AMPLITUDE_PCT",
        "ANOMALY_VOLUME_RATIO",
        "ANOMALY_LOOKBACK_DAYS",
        "ANOMALY_LIMIT_MAIN",
        "ANOMALY_LIMIT_STARTUP",
        "ANOMALY_LIMIT_ST",
        "ANOMALY_DATA_STALE_S",
    ]:
        os.environ.pop(k, None)
    s = _reload_settings()
    assert s.ANOMALY_AMPLITUDE_PCT == 8.0
    assert s.ANOMALY_VOLUME_RATIO == 3.0
    assert s.ANOMALY_LOOKBACK_DAYS == 60
    assert s.ANOMALY_LIMIT_MAIN == 10.0
    assert s.ANOMALY_LIMIT_STARTUP == 20.0
    assert s.ANOMALY_LIMIT_ST == 5.0
    assert s.ANOMALY_DATA_STALE_S == 300


def test_anomaly_thresholds_override(monkeypatch):
    monkeypatch.setenv("ANOMALY_AMPLITUDE_PCT", "10.0")
    monkeypatch.setenv("ANOMALY_VOLUME_RATIO", "2.5")
    monkeypatch.setenv("ANOMALY_LOOKBACK_DAYS", "30")
    s = _reload_settings()
    assert s.ANOMALY_AMPLITUDE_PCT == 10.0
    assert s.ANOMALY_VOLUME_RATIO == 2.5
    assert s.ANOMALY_LOOKBACK_DAYS == 30
