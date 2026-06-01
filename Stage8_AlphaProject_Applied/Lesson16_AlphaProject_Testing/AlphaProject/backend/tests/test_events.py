from app.events.watchlist_events import (
    WatchlistRemovedEvent,
    publish_removed,
    subscribe,
    unsubscribe,
)


def test_removed_event_payload():
    e = WatchlistRemovedEvent(code="600519")
    assert e.action == "removed"
    assert e.code == "600519"
    assert e.model_dump() == {"action": "removed", "code": "600519"}


def test_subscribe_receives_published_event():
    received: list[WatchlistRemovedEvent] = []
    subscribe(received.append)
    publish_removed("600519")
    assert len(received) == 1
    assert received[0].code == "600519"
    unsubscribe(received.append)


def test_unsubscribed_does_not_receive():
    received: list[WatchlistRemovedEvent] = []
    subscribe(received.append)
    unsubscribe(received.append)
    publish_removed("600519")
    assert received == []


def test_multiple_subscribers_each_receive():
    a, b = [], []
    subscribe(a.append)
    subscribe(b.append)
    publish_removed("000001")
    assert len(a) == 1 and len(b) == 1
    unsubscribe(a.append)
    unsubscribe(b.append)
