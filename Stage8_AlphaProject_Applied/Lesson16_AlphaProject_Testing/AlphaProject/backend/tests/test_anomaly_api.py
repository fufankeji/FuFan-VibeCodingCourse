"""T014/T015 — API endpoints for badges + rule config.

[出参验证]
- GET /anomaly/badges → {code: [badge,...]}
- GET/PATCH /anomaly/rules → toggle rules; 关闭"量能"后扫描不产量能信号
"""
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.anomaly.anomaly_state import StateManager
from app.anomaly.rule_config import RuleConfigStore
from app.api.anomaly import build_anomaly_router
from app.models.anomaly import AnomalyType, AnomalySignal


def _client_with(sm: StateManager, store: RuleConfigStore) -> TestClient:
    app = FastAPI()
    app.include_router(build_anomaly_router(state_manager=sm, rule_store=store))
    return TestClient(app)


def test_get_badges_empty_initial():
    c = _client_with(StateManager(), RuleConfigStore())
    resp = c.get("/anomaly/badges")
    assert resp.status_code == 200
    assert resp.json() == {}


def test_get_badges_after_state_commit():
    sm = StateManager()
    sm.evaluate("600519", [AnomalySignal(code="600519", anomaly_type=AnomalyType.LIMIT_UP)])
    c = _client_with(sm, RuleConfigStore())
    resp = c.get("/anomaly/badges")
    assert resp.json() == {"600519": ["limit_up"]}


def test_get_rule_config_default():
    c = _client_with(StateManager(), RuleConfigStore())
    resp = c.get("/anomaly/rules")
    assert resp.status_code == 200
    body = resp.json()
    assert body["volume_enabled"] is True
    assert body["limit_enabled"] is True


def test_patch_rule_config_disables_volume():
    store = RuleConfigStore()
    c = _client_with(StateManager(), store)
    resp = c.patch("/anomaly/rules", json={"volume_enabled": False})
    assert resp.status_code == 200
    assert resp.json()["volume_enabled"] is False
    # And the store reflects it
    assert store.current().volume_enabled is False


def test_patch_threshold_override():
    store = RuleConfigStore()
    c = _client_with(StateManager(), store)
    resp = c.patch("/anomaly/rules", json={"amplitude_pct": 12.0})
    assert resp.status_code == 200
    assert resp.json()["amplitude_pct"] == 12.0
