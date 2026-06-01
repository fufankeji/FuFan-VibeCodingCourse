"""PushService — unified entry orchestrating push pipeline (002-T011/T012/T013).

Order of operations per plan §②:
  send(req) → mute? → dedup? → rate-limit/merge? → render → lark.send →
              retry on failure → write push_log

- T011: pipeline wiring (FR-001, FR-015)
- T012: global mute (FR-011)
- T013: invalid-credential pause + status snapshot (FR-012)
"""

from __future__ import annotations

import logging
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.models.push import PushRequest
from app.push.card_renderer import render, render_batch
from app.push.dedup import Deduper, uuid_for
from app.push.lark_client import FailureKind, SendResult
from app.push.rate_limiter import RateLimiter
from app.push.retry_queue import RetryQueue

logger = logging.getLogger(__name__)


@dataclass
class PushOutcome:
    status: str  # delivered / deduped / muted / failed / paused / merged
    uuid: str | None = None


_AUTH_FAILURE_THRESHOLD = 3  # plan R-6: 连续 N 次鉴权失败才暂停


class PushService:
    def __init__(
        self,
        *,
        lark_client,
        db_path: Path,
        receive_id: str,
        receive_id_type: str = "chat_id",
        rate_limit_per_min: int = 70,
        dedup_ttl: int = 300,
        undelivered_max: int = 200,
        muted: bool = False,
    ) -> None:
        self._lark = lark_client
        self._db_path = db_path
        self._receive_id_default = receive_id
        self._receive_id_type_default = receive_id_type
        self._deduper = Deduper(ttl_seconds=dedup_ttl)
        self._rl = RateLimiter(limit_per_min=rate_limit_per_min)
        self._retry = RetryQueue(db_path=db_path, undelivered_max=undelivered_max)
        self.muted = muted
        self.connection_ok = True
        self._consecutive_auth_failures = 0

    # ------------------------------------------------------------------
    def send(self, req: PushRequest) -> PushOutcome:
        # T013: paused due to invalid credentials
        if not self.connection_ok:
            self._log("paused", req=req, uuid=None, error="connection_paused")
            return PushOutcome(status="paused")

        # T012: global mute (FR-011) — A 全静音 (含持仓)
        if self.muted:
            self._log("muted", req=req, uuid=None)
            return PushOutcome(status="muted")

        # T006: dedup
        if self._deduper.is_duplicate(req):
            self._log("deduped", req=req, uuid=None)
            return PushOutcome(status="deduped")

        # T007: rate-limit / merge
        decision = self._rl.acquire(req)
        if not decision.allow_immediate:
            self._log("merged", req=req, uuid=None)
            return PushOutcome(status="merged")

        # T005: render + T004: send
        uuid = uuid_for(req)
        return self._dispatch_single(req, uuid)

    def _dispatch_single(self, req: PushRequest, uuid: str) -> PushOutcome:
        content = render(req)
        target = req.receive_id or self._receive_id_default
        target_type = req.receive_id_type or self._receive_id_type_default
        result: SendResult = self._lark.send(
            receive_id=target,
            receive_id_type=target_type,
            msg_type=req.msg_type.value,
            content=content,
            uuid=uuid,
        )
        if result.ok:
            self._consecutive_auth_failures = 0
            self._deduper.mark_sent(req)
            attempt = self._retry.record_attempt(req, uuid=uuid, success=True)
            self._log("delivered", req=req, uuid=uuid, retries=attempt.attempts - 1)
            return PushOutcome(status="delivered", uuid=uuid)

        # failure path
        if result.failure_kind is FailureKind.invalid_credential:
            self._consecutive_auth_failures += 1
            if self._consecutive_auth_failures >= _AUTH_FAILURE_THRESHOLD:
                self.connection_ok = False
                logger.error(
                    "Lark connection marked failed after %d auth errors",
                    self._consecutive_auth_failures,
                )
            self._log("failed", req=req, uuid=uuid, error=result.error or "auth")
            return PushOutcome(status="failed", uuid=uuid)

        # network / rate_limit / unknown → schedule retry
        self._consecutive_auth_failures = 0
        attempt = self._retry.record_attempt(req, uuid=uuid, success=False)
        self._log("failed", req=req, uuid=uuid, retries=attempt.attempts, error=result.error)
        return PushOutcome(status="failed", uuid=uuid)

    # ------------------------------------------------------------------
    def flush_merged(self) -> int:
        """Drain merge queue → send batches. Returns number of batches sent."""
        batches = self._rl.drain_merge_queue()
        sent = 0
        for batch in batches:
            content = render_batch(batch)
            uuid = uuid_for(batch[0]) + f"-batch{sent}"
            result = self._lark.send(
                receive_id=self._receive_id_default,
                receive_id_type=self._receive_id_type_default,
                msg_type="text",
                content=content,
                uuid=uuid,
            )
            if result.ok:
                self._rl.note_sent_batch(len(batch))
                self._log("delivered", req=batch[0], uuid=uuid, retries=0)
                for r in batch:
                    self._deduper.mark_sent(r)
            else:
                self._log("failed", req=batch[0], uuid=uuid, error=result.error)
            sent += 1
        return sent

    # ------------------------------------------------------------------
    def status(self) -> dict[str, Any]:
        with sqlite3.connect(self._db_path) as c:
            n = c.execute("SELECT COUNT(*) FROM undelivered").fetchone()[0]
        return {
            "undelivered_count": int(n),
            "webhook_ok": self.connection_ok,
            "muted": self.muted,
        }

    # ------------------------------------------------------------------
    def _log(
        self,
        status: str,
        *,
        req: PushRequest,
        uuid: str | None,
        retries: int = 0,
        error: str | None = None,
    ) -> None:
        ts = datetime.now(timezone.utc).isoformat()
        target = req.receive_id or self._receive_id_default
        with sqlite3.connect(self._db_path) as c:
            c.execute(
                "INSERT INTO push_log(ts, status, retries, target, code, signal, uuid, error)"
                " VALUES (?,?,?,?,?,?,?,?)",
                (ts, status, retries, target, req.code, req.signal, uuid, error),
            )
            c.commit()
