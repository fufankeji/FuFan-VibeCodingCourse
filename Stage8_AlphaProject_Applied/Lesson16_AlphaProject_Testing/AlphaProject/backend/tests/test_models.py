from datetime import datetime

import pytest
from pydantic import ValidationError

from app.models.watchlist import WatchlistGroup, WatchlistItem


def test_watchlist_item_minimal_fields():
    item = WatchlistItem(code="600519", name="贵州茅台")
    assert item.code == "600519"
    assert item.name == "贵州茅台"
    assert item.is_holding is False
    assert item.group_id is None
    assert item.display_order == 0
    assert item.deleted_at is None


def test_watchlist_item_with_holding_and_group():
    item = WatchlistItem(code="000001", name="平安银行", group_id=2, is_holding=True, display_order=3)
    assert item.is_holding is True
    assert item.group_id == 2
    assert item.display_order == 3


def test_watchlist_item_requires_code_and_name():
    with pytest.raises(ValidationError):
        WatchlistItem(name="贵州茅台")  # missing code
    with pytest.raises(ValidationError):
        WatchlistItem(code="600519")  # missing name


def test_watchlist_item_joined_at_defaults_to_now():
    before = datetime.now()
    item = WatchlistItem(code="600519", name="贵州茅台")
    assert item.joined_at >= before


def test_watchlist_group_minimal():
    g = WatchlistGroup(name="持仓")
    assert g.name == "持仓"
    assert g.id is None  # not yet persisted


def test_watchlist_group_name_required():
    with pytest.raises(ValidationError):
        WatchlistGroup()
