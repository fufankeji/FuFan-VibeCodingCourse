"""T004 — LarkClient wraps lark-oapi im.v1.message.create with injectable SDK.

FR-001/FR-003/FR-012/FR-016. Tests mock the SDK; no network.
"""

from unittest.mock import MagicMock

import pytest

from app.push.lark_client import LarkClient, SendResult, FailureKind


class _FakeResp:
    def __init__(self, success: bool, code: int = 0, msg: str = "ok"):
        self._success = success
        self.code = code
        self.msg = msg

    def success(self) -> bool:
        return self._success


def _make_sdk_client(resp) -> MagicMock:
    sdk = MagicMock()
    sdk.im.v1.message.create.return_value = resp
    return sdk


def test_send_text_happy_path():
    sdk = _make_sdk_client(_FakeResp(success=True))
    c = LarkClient(sdk_client=sdk, app_id="x", app_secret="y")
    r = c.send(
        receive_id="oc_a",
        receive_id_type="chat_id",
        msg_type="text",
        content='{"text":"hi"}',
        uuid="u-1",
    )
    assert r.ok is True
    assert r.failure_kind is None
    # SDK called exactly once with a built request
    assert sdk.im.v1.message.create.call_count == 1


def test_send_network_error_marked_retryable():
    sdk = MagicMock()
    sdk.im.v1.message.create.side_effect = ConnectionError("boom")
    c = LarkClient(sdk_client=sdk, app_id="x", app_secret="y")
    r = c.send(
        receive_id="oc_a", receive_id_type="chat_id", msg_type="text",
        content='{"text":"hi"}', uuid="u-1",
    )
    assert r.ok is False
    assert r.failure_kind == FailureKind.network


def test_send_rate_limit_error_marked_retryable():
    sdk = _make_sdk_client(_FakeResp(success=False, code=99991400, msg="rate limit"))
    c = LarkClient(sdk_client=sdk, app_id="x", app_secret="y")
    r = c.send(
        receive_id="oc_a", receive_id_type="chat_id", msg_type="text",
        content='{"text":"hi"}', uuid="u-1",
    )
    assert r.ok is False
    assert r.failure_kind == FailureKind.rate_limit


def test_send_auth_error_marked_invalid():
    """app_secret 失效 / scope 不足 → 不重试, 暂停推送."""
    sdk = _make_sdk_client(_FakeResp(success=False, code=99991663, msg="invalid token"))
    c = LarkClient(sdk_client=sdk, app_id="x", app_secret="y")
    r = c.send(
        receive_id="oc_a", receive_id_type="chat_id", msg_type="text",
        content='{"text":"hi"}', uuid="u-1",
    )
    assert r.ok is False
    assert r.failure_kind == FailureKind.invalid_credential


def test_send_permission_error_marked_invalid():
    """机器人不在会话 / scope 缺失."""
    sdk = _make_sdk_client(_FakeResp(success=False, code=230001, msg="permission denied"))
    c = LarkClient(sdk_client=sdk, app_id="x", app_secret="y")
    r = c.send(
        receive_id="oc_a", receive_id_type="chat_id", msg_type="text",
        content='{"text":"hi"}', uuid="u-1",
    )
    assert r.ok is False
    assert r.failure_kind == FailureKind.invalid_credential


def test_uuid_threaded_into_request():
    """FR-016: uuid 必须透传到 SDK 请求体的 build chain."""
    sdk = _make_sdk_client(_FakeResp(success=True))
    c = LarkClient(sdk_client=sdk, app_id="x", app_secret="y")
    c.send(
        receive_id="oc_a", receive_id_type="chat_id", msg_type="text",
        content='{"text":"hi"}', uuid="u-deadbeef",
    )
    call_args = sdk.im.v1.message.create.call_args
    # The lark-oapi pattern passes a request object; we inspect what we built.
    req = call_args[0][0] if call_args[0] else call_args[1].get("request")
    # Body is set via request_body; uuid is in body
    body = getattr(req, "request_body", None) or getattr(req, "body", None)
    assert body is not None
    assert getattr(body, "uuid", None) == "u-deadbeef"


def test_send_unknown_error_defaults_to_network_retryable():
    """Unknown SDK error code → conservative retry."""
    sdk = _make_sdk_client(_FakeResp(success=False, code=12345, msg="unknown"))
    c = LarkClient(sdk_client=sdk, app_id="x", app_secret="y")
    r = c.send(
        receive_id="oc_a", receive_id_type="chat_id", msg_type="text",
        content='{"text":"hi"}', uuid="u-1",
    )
    assert r.ok is False
    assert r.failure_kind in (FailureKind.network, FailureKind.unknown)
