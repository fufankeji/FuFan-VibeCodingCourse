"""T013: REST API for the Dashboard 为什么 button + F2 sync call.

[出参验证] POST /explain returns explanation; no-anomaly stock returns 综述.
"""
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.explain import build_explain_router
from app.db import init_db
from app.explain.sensitive_filter import DISCLAIMER
from app.models.explain import ExplainContext
from app.services.explain_service import ExplainService
from app.services.llm_service import LLMResponse


class _Asm:
    def assemble(self, *, code, name):
        return ExplainContext(sector="白酒")


class _LLM:
    def complete(self, messages):
        return LLMResponse(text="① 板块催化。② 业绩超预期。", source="llm_primary", cost_cny=0.001)


@pytest.fixture
def client(tmp_path: Path) -> TestClient:
    db = tmp_path / "alpha.db"
    init_db(db)
    svc = ExplainService(
        assembler=_Asm(),
        llm=_LLM(),
        db_path=db,
        daily_budget=5.0,
        template_mode=False,
    )
    app = FastAPI()
    app.include_router(build_explain_router(lambda: svc))
    return TestClient(app)


def test_explain_endpoint_anomaly(client: TestClient):
    r = client.post(
        "/explain",
        json={
            "code": "600519",
            "name": "贵州茅台",
            "anomaly_type": "limit_up",
            "price": 1888.0,
            "change_pct": 10.0,
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["text"].endswith(DISCLAIMER)
    assert body["source"] == "llm_primary"


def test_explain_endpoint_summary_when_no_anomaly(client: TestClient):
    r = client.post(
        "/explain",
        json={
            "code": "600519",
            "name": "贵州茅台",
            "anomaly_type": "summary",
            "price": 1700.0,
            "change_pct": 0.5,
            "on_demand": True,
        },
    )
    assert r.status_code == 200
    assert r.json()["text"].endswith(DISCLAIMER)


def test_explain_endpoint_rejects_invalid_anomaly(client: TestClient):
    r = client.post(
        "/explain",
        json={
            "code": "600519",
            "name": "贵州茅台",
            "anomaly_type": "bogus",
            "price": 100.0,
            "change_pct": 1.0,
        },
    )
    assert r.status_code == 422
