from app.config import settings


def test_max_watchlist_is_30():
    assert settings.MAX_WATCHLIST == 30


def test_max_holding_is_5():
    assert settings.MAX_HOLDING == 5


def test_max_group_is_5():
    assert settings.MAX_GROUP == 5


def test_db_path_is_configured():
    assert settings.DB_PATH
    assert str(settings.DB_PATH).endswith(".db")
