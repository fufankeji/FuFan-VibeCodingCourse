"""LarkClient wrapper around lark-oapi IM OpenAPI (002-T004).

只与飞书 SDK 接触的唯一层. tenant_access_token 由 SDK 内部托管刷新.
区分失败种类: network (重试) / rate_limit (重试+退避) / invalid_credential (暂停).

注: SDK Client 通过依赖注入传入 — 真实运行时由工厂 build_default_client()
构建; 测试时注入 MagicMock.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from enum import Enum
from typing import Any

import lark_oapi as lark
from lark_oapi.api.im.v1 import (
    CreateMessageRequest,
    CreateMessageRequestBody,
)

logger = logging.getLogger(__name__)


class FailureKind(str, Enum):
    network = "network"  # 超时/连接错/5xx → 可重试
    rate_limit = "rate_limit"  # SDK 频控错 → 退避重试
    invalid_credential = "invalid_credential"  # 鉴权/权限 → 暂停+告警
    unknown = "unknown"  # 未知错 → 保守可重试


# 飞书错误码分类 (spec FR-012, plan R-6)
# 参考: https://open.feishu.cn/document/server-docs/im-v1/message/create
_AUTH_CODES = {
    99991661,  # invalid app_secret
    99991663,  # invalid token
    99991668,  # token expired (should auto-refresh, but signal cred issue if persistent)
    230001,    # bot not in chat / permission denied
    230002,
    230003,
}
_RATE_LIMIT_CODES = {
    99991400,  # rate limit
    11232,
}


@dataclass
class SendResult:
    ok: bool
    failure_kind: FailureKind | None = None
    error: str | None = None
    raw_code: int | None = None


class LarkClient:
    """Wraps lark-oapi Client. SDK injected for testability."""

    def __init__(
        self,
        sdk_client: Any,
        app_id: str,
        app_secret: str,
    ) -> None:
        self._sdk = sdk_client
        self.app_id = app_id
        self.app_secret = app_secret

    def send(
        self,
        *,
        receive_id: str,
        receive_id_type: str,
        msg_type: str,
        content: str,
        uuid: str,
    ) -> SendResult:
        """Send one message via im.v1.message.create. Returns classified result."""
        try:
            body = (
                CreateMessageRequestBody.builder()
                .receive_id(receive_id)
                .msg_type(msg_type)
                .content(content)
                .uuid(uuid)
                .build()
            )
            req = (
                CreateMessageRequest.builder()
                .receive_id_type(receive_id_type)
                .request_body(body)
                .build()
            )
            resp = self._sdk.im.v1.message.create(req)
        except (ConnectionError, TimeoutError) as e:
            logger.warning("Lark send network error: %s", e)
            return SendResult(ok=False, failure_kind=FailureKind.network, error=str(e))
        except Exception as e:  # noqa: BLE001 — SDK can raise broad types
            logger.warning("Lark send unexpected exception: %s", e)
            return SendResult(ok=False, failure_kind=FailureKind.unknown, error=str(e))

        if resp.success():
            return SendResult(ok=True)

        code = getattr(resp, "code", 0) or 0
        msg = getattr(resp, "msg", "") or ""
        if code in _AUTH_CODES:
            kind = FailureKind.invalid_credential
        elif code in _RATE_LIMIT_CODES:
            kind = FailureKind.rate_limit
        else:
            kind = FailureKind.network  # conservative: retry
        return SendResult(ok=False, failure_kind=kind, error=msg, raw_code=code)


def build_default_client(app_id: str, app_secret: str) -> LarkClient:
    """Production factory: build SDK client with provided credentials."""
    sdk = (
        lark.Client.builder()
        .app_id(app_id)
        .app_secret(app_secret)
        .log_level(lark.LogLevel.WARNING)
        .build()
    )
    return LarkClient(sdk_client=sdk, app_id=app_id, app_secret=app_secret)
