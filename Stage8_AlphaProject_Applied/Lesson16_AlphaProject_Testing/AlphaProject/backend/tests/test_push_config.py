"""T001 — push config knobs exposed via Settings.

Verifies FR-003 (Lark App credentials), FR-004 (rate-limit), FR-006 (dedup TTL),
FR-009/Edge (undelivered max), FR-011 (mute flag) defaults and env override.

Credentials must NOT be tracked by git (verified separately via .gitignore on .env).
"""

from app.config import Settings, settings


def test_default_dedup_ttl_is_300_seconds():
    assert settings.DEDUP_TTL == 300


def test_default_rate_limit_is_70_per_minute():
    """spec §2.3: IM OpenAPI 频控待核实，应用层留余量 70/min."""
    assert settings.RATE_LIMIT == 70


def test_default_undelivered_max_is_200():
    assert settings.UNDELIVERED_MAX == 200


def test_default_mute_flag_is_false():
    assert settings.MUTE_FLAG is False


def test_lark_credentials_fields_exist():
    assert hasattr(settings, "LARK_APP_ID")
    assert hasattr(settings, "LARK_APP_SECRET")
    assert hasattr(settings, "LARK_RECEIVE_ID")
    assert hasattr(settings, "LARK_RECEIVE_ID_TYPE")


def test_lark_receive_id_type_default_chat_id():
    s = Settings(LARK_APP_ID="x", LARK_APP_SECRET="y", LARK_RECEIVE_ID="oc_test")
    assert s.LARK_RECEIVE_ID_TYPE == "chat_id"


def test_settings_can_override_via_env(monkeypatch):
    monkeypatch.setenv("RATE_LIMIT", "50")
    monkeypatch.setenv("DEDUP_TTL", "120")
    monkeypatch.setenv("UNDELIVERED_MAX", "100")
    monkeypatch.setenv("MUTE_FLAG", "true")
    s = Settings()
    assert s.RATE_LIMIT == 50
    assert s.DEDUP_TTL == 120
    assert s.UNDELIVERED_MAX == 100
    assert s.MUTE_FLAG is True
