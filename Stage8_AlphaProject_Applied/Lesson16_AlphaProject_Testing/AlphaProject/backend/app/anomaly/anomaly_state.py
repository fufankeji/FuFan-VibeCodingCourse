"""T008/T009 — StateManager wrapping AnomalyState + watchlist-delete subscription.

- evaluate(code, signals): diff vs prev cycle → return list of NEW signals
- subscribe_watchlist_events(): hook F5 removed event → forget(code)
"""

from __future__ import annotations

from app.events import watchlist_events
from app.events.watchlist_events import WatchlistRemovedEvent
from app.models.anomaly import AnomalySignal, AnomalyState


class StateManager:
    def __init__(self) -> None:
        self.state = AnomalyState()
        self._sub = None  # subscriber fn handle

    def evaluate(self, code: str, fresh: list[AnomalySignal]) -> list[AnomalySignal]:
        """Compare fresh signals vs previous state; commit fresh; return NEW only."""
        fresh_types = {s.anomaly_type for s in fresh}
        new_types = self.state.diff(code, fresh_types)
        self.state.set(code, fresh_types)
        return [s for s in fresh if s.anomaly_type in new_types]

    def forget(self, code: str) -> None:
        self.state.forget(code)

    # ── F5 watchlist removed event hook (T009) ──────────────────────────
    def subscribe_watchlist_events(self) -> None:
        if self._sub is not None:
            return

        def _on_removed(ev: WatchlistRemovedEvent) -> None:
            self.forget(ev.code)

        self._sub = _on_removed
        watchlist_events.subscribe(_on_removed)

    def unsubscribe_watchlist_events(self) -> None:
        if self._sub is not None:
            watchlist_events.unsubscribe(self._sub)
            self._sub = None


__all__ = ["StateManager"]
