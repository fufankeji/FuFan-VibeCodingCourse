"""F4 T001 — briefing config knobs."""
from app.config import settings


def test_briefing_trigger_time_default():
    assert settings.BRIEFING_TRIGGER_TIME == "09:15"


def test_briefing_followup_time_default():
    assert settings.BRIEFING_FOLLOWUP_TIME == "09:18"


def test_briefing_body_char_limit_default():
    assert settings.BRIEFING_BODY_LIMIT == 1200


def test_briefing_history_retention_days_default():
    assert settings.BRIEFING_HISTORY_DAYS == 30


def test_briefing_llm_timeout_default():
    # spec FR-008 / clarification: simbao LLM timeout = 60s
    assert settings.BRIEFING_LLM_TIMEOUT_S == 60.0
