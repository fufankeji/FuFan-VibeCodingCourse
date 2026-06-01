"""Watchlist domain events.

Contract for F2 (005-anomaly-detection-push): when a watchlist item is removed,
F2 MUST stop scanning it and clear any pending push. This module defines the
payload + a process-local pub/sub. F2 subscribes from its own bootstrap.
"""

from collections.abc import Callable
from typing import Literal

from pydantic import BaseModel

Subscriber = Callable[["WatchlistRemovedEvent"], None]


class WatchlistRemovedEvent(BaseModel):
    action: Literal["removed"] = "removed"
    code: str


_subscribers: list[Subscriber] = []


def subscribe(fn: Subscriber) -> None:
    _subscribers.append(fn)


def unsubscribe(fn: Subscriber) -> None:
    if fn in _subscribers:
        _subscribers.remove(fn)


def publish_removed(code: str) -> None:
    event = WatchlistRemovedEvent(code=code)
    for fn in list(_subscribers):
        fn(event)
