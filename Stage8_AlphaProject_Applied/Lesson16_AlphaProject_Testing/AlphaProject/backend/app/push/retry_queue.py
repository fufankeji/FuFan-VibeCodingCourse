"""Retry queue + undelivered persistence + replay (002-T008/T009/T010).

- FR-008: 30s / 90s retry (3 attempts total)
- FR-009: 耗尽入 undelivered 表
- FR-010: 启动/恢复时回放 (过多则汇总)
- Edge Cases: 队列满 200 → 丢最旧非持仓, 持仓优先保留
- FR-016: uuid 在重试中复用
"""

from __future__ import annotations

import json
import logging
import sqlite3
from dataclasses import dataclass
from pathlib import Path

from app.models.push import Priority, PushRequest, UndeliveredItem

logger = logging.getLogger(__name__)


@dataclass
class AttemptState:
    uuid: str
    attempts: int  # cumulative
    scheduled_next_in: int | None  # seconds; None if exhausted
    exhausted: bool


_RETRY_DELAYS_S = [30, 90]  # FR-008: 3 attempts → 0s / +30s / +90s


class RetryQueue:
    """Tracks in-memory attempt counts; persists exhaustion to SQLite."""

    def __init__(
        self,
        db_path: Path | None,
        undelivered_max: int = 200,
        replay_summary_threshold: int = 50,
    ) -> None:
        self.db_path = db_path
        self.undelivered_max = undelivered_max
        self.replay_summary_threshold = replay_summary_threshold
        self._attempts: dict[str, int] = {}  # uuid -> count
        self.last_replay_summarized: bool = False

    # ---- T008 retry --------------------------------------------------------

    def retry_delays(self) -> list[int]:
        return list(_RETRY_DELAYS_S)

    def record_attempt(
        self,
        req: PushRequest,
        *,
        uuid: str,
        success: bool,
    ) -> AttemptState:
        prev = self._attempts.get(uuid, 0)
        cur = prev + 1
        self._attempts[uuid] = cur
        if success:
            self._attempts.pop(uuid, None)
            return AttemptState(uuid=uuid, attempts=cur, scheduled_next_in=None, exhausted=False)

        # failure path
        # Map: 1st failure → schedule +30; 2nd → +90; 3rd → exhaust.
        if cur < 3:
            delay = _RETRY_DELAYS_S[cur - 1]
            return AttemptState(
                uuid=uuid, attempts=cur, scheduled_next_in=delay, exhausted=False,
            )
        # exhausted: persist
        self._attempts.pop(uuid, None)
        from datetime import datetime, timezone

        self._enqueue_undelivered(
            req,
            uuid=uuid,
            is_holding=(req.priority is Priority.holding),
            queued_at=datetime.now(timezone.utc).isoformat(),
        )
        return AttemptState(uuid=uuid, attempts=cur, scheduled_next_in=None, exhausted=True)

    # ---- T010 overflow strategy --------------------------------------------

    def _enqueue_undelivered(
        self,
        req: PushRequest,
        *,
        uuid: str,
        is_holding: bool,
        queued_at: str,
    ) -> None:
        if self.db_path is None:
            return
        with sqlite3.connect(self.db_path) as c:
            n = c.execute("SELECT COUNT(*) FROM undelivered").fetchone()[0]
            if n >= self.undelivered_max:
                if is_holding:
                    # holding incoming: try to drop oldest non-holding to make room
                    victim = c.execute(
                        "SELECT id FROM undelivered WHERE is_holding=0 "
                        "ORDER BY queued_at ASC LIMIT 1"
                    ).fetchone()
                    if victim is None:
                        # all holding — bound the queue: drop oldest holding
                        victim = c.execute(
                            "SELECT id FROM undelivered ORDER BY queued_at ASC LIMIT 1"
                        ).fetchone()
                    if victim:
                        c.execute("DELETE FROM undelivered WHERE id=?", (victim[0],))
                else:
                    # non-holding incoming: only evict oldest non-holding
                    victim = c.execute(
                        "SELECT id FROM undelivered WHERE is_holding=0 "
                        "ORDER BY queued_at ASC LIMIT 1"
                    ).fetchone()
                    if victim is None:
                        # full of holdings — drop this incoming non-holding
                        logger.warning(
                            "undelivered queue full of holdings; dropping non-holding uuid=%s",
                            uuid,
                        )
                        c.commit()
                        return
                    c.execute("DELETE FROM undelivered WHERE id=?", (victim[0],))
            c.execute(
                "INSERT INTO undelivered(uuid, request_json, fail_count, queued_at, is_holding)"
                " VALUES (?,?,?,?,?)",
                (uuid, json.dumps(req.model_dump()), 3, queued_at, 1 if is_holding else 0),
            )
            c.commit()

    # ---- T009 replay -------------------------------------------------------

    def replay(self) -> list[UndeliveredItem]:
        if self.db_path is None:
            return []
        with sqlite3.connect(self.db_path) as c:
            rows = c.execute(
                "SELECT id, uuid, request_json, fail_count, queued_at, is_holding "
                "FROM undelivered ORDER BY queued_at ASC"
            ).fetchall()
        if len(rows) > self.replay_summary_threshold:
            self.last_replay_summarized = True
            logger.info("Replay: %d undelivered items, summarizing", len(rows))
        else:
            self.last_replay_summarized = False
        return [
            UndeliveredItem(
                id=r[0], uuid=r[1], request_json=r[2], fail_count=r[3],
                queued_at=r[4], is_holding=bool(r[5]),
            )
            for r in rows
        ]

    def remove(self, uuid: str) -> None:
        if self.db_path is None:
            return
        with sqlite3.connect(self.db_path) as c:
            c.execute("DELETE FROM undelivered WHERE uuid=?", (uuid,))
            c.commit()
