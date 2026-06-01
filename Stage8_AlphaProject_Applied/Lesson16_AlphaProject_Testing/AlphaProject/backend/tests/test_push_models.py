"""T003 — PushRequest / PushLog / UndeliveredItem Pydantic models."""

import pytest
from pydantic import ValidationError

from app.models.push import PushRequest, PushLog, UndeliveredItem, Priority, MsgType


def test_push_request_minimum_valid():
    r = PushRequest(
        msg_type=MsgType.text,
        content={"text": "测试"},
        priority=Priority.watch,
    )
    assert r.priority is Priority.watch
    assert r.msg_type is MsgType.text


def test_push_request_with_dedup_fields():
    r = PushRequest(
        msg_type=MsgType.interactive,
        content={"config": {}, "elements": []},
        priority=Priority.holding,
        code="600519",
        signal="limit_up",
    )
    assert r.code == "600519"
    assert r.signal == "limit_up"


def test_push_request_rejects_invalid_priority():
    with pytest.raises(ValidationError):
        PushRequest(
            msg_type=MsgType.text,
            content={"text": "x"},
            priority="invalid",  # type: ignore[arg-type]
        )


def test_push_request_rejects_missing_required():
    with pytest.raises(ValidationError):
        PushRequest(msg_type=MsgType.text, content={"text": "x"})  # missing priority


def test_push_request_optional_receive_target():
    r = PushRequest(
        msg_type=MsgType.text,
        content={"text": "x"},
        priority=Priority.system,
        receive_id="oc_abc",
        receive_id_type="chat_id",
    )
    assert r.receive_id == "oc_abc"


def test_push_log_model():
    log = PushLog(
        ts="2026-05-28T10:00:00",
        status="delivered",
        retries=0,
        target="oc_x",
        code="600519",
        signal="limit_up",
        uuid="u-1",
    )
    assert log.status == "delivered"


def test_undelivered_item_model():
    item = UndeliveredItem(
        uuid="u-1",
        request_json='{"x":1}',
        fail_count=3,
        queued_at="2026-05-28T10:00:00",
        is_holding=True,
    )
    assert item.is_holding is True
