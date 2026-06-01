"""T001: LLM config exposure on Settings.

[出参验证] 配置可读；Key 不入 git；预算阈值可配；模型计价可读。
"""

from app.config import Settings


def test_llm_settings_defaults_template_mode_when_unconfigured(monkeypatch):
    # No env vars set → template mode (budget defaults to 5 but key empty)
    monkeypatch.delenv("LLM_PRIMARY_API_KEY", raising=False)
    monkeypatch.delenv("LLM_DAILY_BUDGET", raising=False)
    s = Settings(_env_file=None)
    assert s.LLM_DAILY_BUDGET == 5.0
    assert s.LLM_PRIMARY_API_KEY == ""
    assert s.LLM_PRIMARY_BASE_URL == ""
    assert s.LLM_PRIMARY_MODEL == ""
    assert s.LLM_BACKUP_API_KEY == ""
    assert s.OLLAMA_BASE_URL == ""
    # template mode determination
    assert s.llm_template_mode is True


def test_llm_settings_reads_from_env(monkeypatch):
    monkeypatch.setenv("LLM_PRIMARY_BASE_URL", "https://api.deepseek.com/v1")
    monkeypatch.setenv("LLM_PRIMARY_API_KEY", "sk-test")
    monkeypatch.setenv("LLM_PRIMARY_MODEL", "deepseek-chat")
    monkeypatch.setenv("LLM_DAILY_BUDGET", "3.5")
    s = Settings(_env_file=None)
    assert s.LLM_PRIMARY_BASE_URL == "https://api.deepseek.com/v1"
    assert s.LLM_PRIMARY_API_KEY == "sk-test"
    assert s.LLM_PRIMARY_MODEL == "deepseek-chat"
    assert s.LLM_DAILY_BUDGET == 3.5
    assert s.llm_template_mode is False


def test_llm_template_mode_when_budget_zero(monkeypatch):
    monkeypatch.setenv("LLM_PRIMARY_API_KEY", "sk-test")
    monkeypatch.setenv("LLM_PRIMARY_BASE_URL", "https://x")
    monkeypatch.setenv("LLM_PRIMARY_MODEL", "m")
    monkeypatch.setenv("LLM_DAILY_BUDGET", "0")
    s = Settings(_env_file=None)
    # Budget 0 → template mode regardless of key (FR-014)
    assert s.llm_template_mode is True


def test_pricing_table_has_default_entries():
    s = Settings(_env_file=None)
    # Cost-per-1k-tokens estimate; used by llm_service to accumulate cost
    assert s.LLM_PRICE_PER_1K_INPUT >= 0
    assert s.LLM_PRICE_PER_1K_OUTPUT >= 0
