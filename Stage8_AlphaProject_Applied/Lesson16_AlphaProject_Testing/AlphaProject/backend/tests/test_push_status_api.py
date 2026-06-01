"""T014 — GET /push/status contract."""

from pathlib import Path
from unittest.mock import MagicMock

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.push_status import build_push_router
from app.db import init_db
from app.push.lark_client import SendResult
from app.services.push_service import PushService


def _make_client(tmp_path: Path) -> TestClient:
    db = tmp_path / "p.db"
    init_db(db)
    lark = MagicMock()
    lark.send.return_value = SendResult(ok=True)
    svc = PushService(
        lark_client=lark, db_path=db,
        receive_id="oc_test", receive_id_type="chat_id",
        rate_limit_per_min=70, dedup_ttl=300, undelivered_max=200, muted=False,
    )
    app = FastAPI()
    app.include_router(build_push_router(svc))
    return TestClient(app)


def test_push_status_returns_expected_shape(tmp_path):
    client = _make_client(tmp_path)
    r = client.get("/push/status")
    assert r.status_code == 200
    body = r.json()
    assert set(body) == {"undelivered_count", "webhook_ok", "muted"}
    assert body["undelivered_count"] == 0
    assert body["webhook_ok"] is True
    assert body["muted"] is False
