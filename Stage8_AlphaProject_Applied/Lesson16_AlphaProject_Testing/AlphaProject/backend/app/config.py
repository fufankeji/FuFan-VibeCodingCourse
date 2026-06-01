from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Project root .env (one level above backend/) is the source of truth.
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
_ENV_FILE = _PROJECT_ROOT / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(str(_ENV_FILE), ".env"),  # prefer project-root .env, fallback to cwd
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # F5 watchlist limits
    MAX_WATCHLIST: int = 30
    MAX_HOLDING: int = 5
    MAX_GROUP: int = 5

    DB_PATH: Path = Path("data/alpha.db")

    # ── F6 飞书推送通道 (002 T001) ──────────────────────────────────
    LARK_APP_ID: str = ""
    LARK_APP_SECRET: str = ""
    LARK_RECEIVE_ID: str = ""
    LARK_RECEIVE_ID_TYPE: str = "chat_id"
    RATE_LIMIT: int = 70
    DEDUP_TTL: int = 300
    UNDELIVERED_MAX: int = 200
    MUTE_FLAG: bool = False

    # ── F3 LLM config (004 T001) ────────────────────────────────────
    LLM_PRIMARY_BASE_URL: str = ""
    LLM_PRIMARY_API_KEY: str = ""
    LLM_PRIMARY_MODEL: str = ""
    LLM_BACKUP_BASE_URL: str = ""
    LLM_BACKUP_API_KEY: str = ""
    LLM_BACKUP_MODEL: str = ""
    OLLAMA_BASE_URL: str = ""
    OLLAMA_MODEL: str = ""
    LLM_DAILY_BUDGET: float = 5.0
    LLM_PRICE_PER_1K_INPUT: float = 0.0014
    LLM_PRICE_PER_1K_OUTPUT: float = 0.0028
    LLM_PRIMARY_TIMEOUT_S: float = 5.0
    LLM_BACKUP_TIMEOUT_S: float = 5.0

    # ── F4 早盘简报 (006 T001) ────────────────────────────────────
    BRIEFING_TRIGGER_TIME: str = "09:15"
    BRIEFING_FOLLOWUP_TIME: str = "09:18"
    BRIEFING_BODY_LIMIT: int = 1200
    BRIEFING_HISTORY_DAYS: int = 30
    BRIEFING_LLM_TIMEOUT_S: float = 60.0

    # ── F2 异动检测阈值 (005 T001) ─────────────────────────────────
    ANOMALY_AMPLITUDE_PCT: float = 8.0
    ANOMALY_VOLUME_RATIO: float = 3.0
    ANOMALY_LOOKBACK_DAYS: int = 60
    ANOMALY_LIMIT_MAIN: float = 10.0
    ANOMALY_LIMIT_STARTUP: float = 20.0
    ANOMALY_LIMIT_ST: float = 5.0
    ANOMALY_DATA_STALE_S: int = 300

    @property
    def llm_template_mode(self) -> bool:
        """True ⇒ skip cloud LLM, always render template (FR-014)."""
        if self.LLM_DAILY_BUDGET <= 0:
            return True
        if not self.LLM_PRIMARY_API_KEY:
            return True
        return False


settings = Settings()
