import threading
from collections.abc import Callable
from datetime import datetime, timedelta
from typing import Any

from app.errors import WatchlistError
from app.models.watchlist import WatchlistGroup, WatchlistItem
from app.repositories.watchlist_repo import WatchlistRepo

UNDO_WINDOW = timedelta(seconds=30)
_UNSET: Any = object()


class WatchlistService:
    def __init__(
        self,
        repo: WatchlistRepo,
        max_total: int,
        max_holding: int,
        max_group: int = 5,
        clock: Callable[[], datetime] = datetime.now,
    ) -> None:
        self.repo = repo
        self.max_total = max_total
        self.max_holding = max_holding
        self.max_group = max_group
        self.clock = clock
        self._queue_cleaner: Callable[[str], None] = lambda _code: None
        # Serializes read-then-write cap checks (30 / 5 holding / 5 group).
        # SQLite is single-writer at the connection level, but caps are checked
        # against an in-memory count then INSERT — racing threads can both pass
        # the check and over-fill. Lock makes the cap atomic at the app layer.
        # No measurable cost for a single-user local tool.
        self._mutate_lock = threading.RLock()

    def set_queue_cleaner(self, fn: Callable[[str], None]) -> None:
        """Inject F2 pending-push queue cleaner. No-op by default (F2 lands later)."""
        self._queue_cleaner = fn

    def remove(self, code: str) -> None:
        existing = self.repo.get(code)
        if existing is None or existing.deleted_at is not None:
            raise WatchlistError(f"未找到自选股 {code}")
        self.repo.soft_delete(code, self.clock())
        self._queue_cleaner(code)

    def undo(self, code: str) -> None:
        existing = self.repo.get(code)
        if existing is None:
            raise WatchlistError(f"未找到自选股 {code}")
        if existing.deleted_at is None:
            raise WatchlistError(f"自选股 {code} 未删除，无法撤销")
        if self.clock() - existing.deleted_at > UNDO_WINDOW:
            raise WatchlistError("撤销已超时（>30 秒）")
        self.repo.undo_soft_delete(code)

    def update(
        self,
        code: str,
        is_holding: Any = _UNSET,
        group_id: Any = _UNSET,
        display_order: Any = _UNSET,
        # legacy flag accepted for back-compat with early tests; ignored
        _clear_group: bool = False,
    ) -> WatchlistItem:
        with self._mutate_lock:
            existing = self.repo.get(code)
            if existing is None or existing.deleted_at is not None:
                raise WatchlistError(f"未找到自选股 {code}")
            if group_id is not _UNSET:
                self._assert_group_exists(group_id)
            if is_holding is True and not existing.is_holding:
                current_holdings = sum(1 for i in self.repo.list_active() if i.is_holding)
                if current_holdings >= self.max_holding:
                    raise WatchlistError(f"持仓标记上限 {self.max_holding}")
            # Sentinel-based update: None is a legal target value (clears group_id);
            # only _UNSET means "don't touch".
            changes: dict[str, Any] = {}
            if is_holding is not _UNSET:
                changes["is_holding"] = is_holding
            if group_id is not _UNSET or _clear_group:
                changes["group_id"] = None if _clear_group else group_id
            if display_order is not _UNSET:
                changes["display_order"] = display_order
            updated = existing.model_copy(update=changes)
            self.repo.save(updated)
            return updated

    # ── snapshot (F1/F4 consumer contract, T012) ────────
    def snapshot(self) -> list[dict]:
        """Stable contract for F1 (003) and F4 (006).

        Returns active items (soft-deleted excluded), ordered by display_order.
        Each dict carries: code, name, group_id, is_holding, display_order, joined_at.
        Downstream features MUST treat this shape as the source of truth.
        """
        return [i.model_dump(exclude={"deleted_at"}, mode="json") for i in self.repo.list_active()]

    # ── groups ──────────────────────────────────────────
    def list_groups(self) -> list[WatchlistGroup]:
        return self.repo.list_groups()

    def create_group(self, name: str) -> WatchlistGroup:
        existing = self.repo.list_groups()
        if any(g.name == name for g in existing):
            raise WatchlistError(f"分组 {name} 已存在")
        if len(existing) >= self.max_group:
            raise WatchlistError(f"分组上限 {self.max_group}")
        return self.repo.save_group(WatchlistGroup(name=name))

    def rename_group(self, group_id: int, new_name: str) -> WatchlistGroup:
        existing = self.repo.list_groups()
        target = next((g for g in existing if g.id == group_id), None)
        if target is None:
            raise WatchlistError(f"未找到分组 {group_id}")
        if any(g.name == new_name and g.id != group_id for g in existing):
            raise WatchlistError(f"分组 {new_name} 已存在")
        renamed = target.model_copy(update={"name": new_name})
        self.repo.update_group(renamed)
        return renamed

    def delete_group(self, group_id: int) -> None:
        if not any(g.id == group_id for g in self.repo.list_groups()):
            raise WatchlistError(f"未找到分组 {group_id}")
        self.repo.delete_group(group_id)  # also nulls items' group_id

    def purge_expired_soft_deletes(self) -> int:
        now = self.clock()
        purged = 0
        for item in self.repo.list_soft_deleted():
            if item.deleted_at and now - item.deleted_at > UNDO_WINDOW:
                self.repo.hard_delete(item.code)
                purged += 1
        return purged

    def _assert_group_exists(self, group_id: int | None) -> None:
        """SQLite FK enforcement is OFF (single-user local, no untrusted input);
        this app-layer check stops orphan group_id refs from being written.
        None is always allowed (clear/no-binding)."""
        if group_id is None:
            return
        if not any(g.id == group_id for g in self.repo.list_groups()):
            raise WatchlistError(f"未找到分组 {group_id}")

    def add(
        self,
        code: str,
        name: str,
        is_holding: bool = False,
        group_id: int | None = None,
    ) -> WatchlistItem:
        with self._mutate_lock:
            self._assert_group_exists(group_id)
            items = self.repo.list_active()
            if any(i.code == code for i in items):
                raise WatchlistError(f"自选股 {code} 已存在")
            if len(items) >= self.max_total:
                raise WatchlistError(f"自选股上限 {self.max_total}，请先移除")
            if is_holding and sum(1 for i in items if i.is_holding) >= self.max_holding:
                raise WatchlistError(f"持仓标记上限 {self.max_holding}")
            item = WatchlistItem(code=code, name=name, is_holding=is_holding, group_id=group_id)
            self.repo.save(item)
            return item
