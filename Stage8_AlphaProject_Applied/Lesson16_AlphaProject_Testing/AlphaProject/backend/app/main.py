"""Production application entry — wires F1+F2+F3+F4+F5+F6 with real adapters.

When credentials are present in .env, services use real backends:
  - AkShare adapter (sina-sourced) → quote / kline / calendar / news fetchers
  - lark-oapi → PushService
  - openai-compat SDK → LLMService (primary + backup)
  - APScheduler → F2 anomaly scan (every 60s in trading hours) + F4 briefing cron

When a credential is missing, the corresponding path degrades gracefully:
  - LARK_RECEIVE_ID empty → MagicMock LarkClient, /push/status webhook_ok=False
  - LLM_PRIMARY_API_KEY empty → template_mode (F3 returns rule-based text)
  - AkShare unavailable → quote_service returns NO_DATA, briefing skips blocks
"""

import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime
from unittest.mock import MagicMock

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI

from app.anomaly.anomaly_state import StateManager
from app.anomaly.rule_config import RuleConfigStore
from app.api.anomaly import build_anomaly_router
from app.api.briefing import build_briefing_router
from app.api.explain import build_explain_router
from app.api.push_status import build_push_router
from app.api.quotes import build_quotes_router
from app.api.watchlist import build_app
from app.backup import restore_or_reset
from app.config import settings
from app.db import init_db
from app.integrations.akshare_adapter import (
    akshare_calendar_fetcher,
    akshare_index_fetcher,
    akshare_kline_fetcher,
    akshare_spot_fetcher,
)
from app.models.quote import DataStatus
from app.push.lark_client import FailureKind, LarkClient, SendResult, build_default_client
from app.services.anomaly_scheduler import is_trading_hours
from app.services.anomaly_service import AnomalyService
from app.services.anomaly_service import QuoteSnapshot as AnomalyQuote
from app.services.briefing_scheduler import BriefingScheduler
from app.services.briefing_service import BriefingService
from app.services.calendar_source import CalendarSource
from app.services.context_assembler import ContextAssembler
from app.services.explain_service import ExplainService
from app.services.kline_service import KlineService
from app.services.llm_service import LLMService, OpenAICompatClient, build_default_service
from app.services.market_overview_source import MarketOverviewSource
from app.services.news_source import NewsSource
from app.services.push_service import PushService
from app.services.quote_service import QuoteService
from app.services.trading_calendar import TradingCalendar

logger = logging.getLogger(__name__)

PURGE_INTERVAL_S = 60
STOCK_REFRESH_INTERVAL_S = 24 * 3600
ANOMALY_SCAN_INTERVAL_S = 60


async def _every(interval: float, fn, *, fire_first: bool = False) -> None:
    if fire_first:
        try:
            await asyncio.to_thread(fn)
        except Exception:
            logger.exception("Background task initial run failed")
    while True:
        await asyncio.sleep(interval)
        try:
            await asyncio.to_thread(fn)
        except Exception:
            logger.exception("Background task iteration failed")


# ── F1 quote/kline/calendar — real AkShare adapters ────────────────────
_quote_service = QuoteService(
    spot_fetcher=akshare_spot_fetcher,
    index_fetcher=akshare_index_fetcher,
)
_kline_service = KlineService(fetcher=akshare_kline_fetcher)
_trading_calendar = TradingCalendar(fetcher=akshare_calendar_fetcher)


@asynccontextmanager
async def lifespan(running_app: FastAPI):
    settings.DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    init_db(settings.DB_PATH)
    restore_or_reset(settings.DB_PATH)

    bg_tasks = [
        asyncio.create_task(
            _every(PURGE_INTERVAL_S, running_app.state.svc.purge_expired_soft_deletes)
        ),
        asyncio.create_task(
            _every(STOCK_REFRESH_INTERVAL_S, running_app.state.stock_svc.refresh, fire_first=True)
        ),
    ]

    # ── APScheduler: F2 anomaly scan + F4 briefing ───────────────
    scheduler = BackgroundScheduler(timezone="Asia/Shanghai")

    def _maybe_scan():
        if is_trading_hours(datetime.now()):
            try:
                running_app.state.anomaly_service.scan_cycle()
            except Exception:
                logger.exception("anomaly scan_cycle failed")

    scheduler.add_job(_maybe_scan, "interval", seconds=ANOMALY_SCAN_INTERVAL_S, id="anomaly_scan")

    # Attach to BriefingScheduler so it can register its cron jobs
    running_app.state.briefing_scheduler.scheduler = scheduler
    running_app.state.briefing_scheduler.register()

    scheduler.start()
    running_app.state.scheduler = scheduler
    logger.info("APScheduler started — anomaly scan + briefing jobs registered")

    try:
        yield
    finally:
        scheduler.shutdown(wait=False)
        for t in bg_tasks:
            t.cancel()


# ── F5 watchlist app + lifespan ────────────────────────────────────────
app = build_app(settings.DB_PATH, refresh_on_boot=False, lifespan=lifespan)

# ── F1 /quotes routes ─────────────────────────────────────────────────
app.include_router(
    build_quotes_router(
        watchlist_service=app.state.svc,
        quote_service=_quote_service,
        kline_service=_kline_service,
        calendar=_trading_calendar,
    )
)

# ── F6 PushService (real lark-oapi if creds, else mock) ────────────────
if settings.LARK_APP_ID and settings.LARK_APP_SECRET and settings.LARK_RECEIVE_ID:
    _lark_client: LarkClient = build_default_client(settings.LARK_APP_ID, settings.LARK_APP_SECRET)
    _lark_ok = True
    logger.info("Lark real client constructed (receive_id=%s)", settings.LARK_RECEIVE_ID)
else:
    _lark_client = MagicMock()  # type: ignore[assignment]
    _lark_client.send.return_value = SendResult(ok=False, failure_kind=FailureKind.invalid_credential)
    _lark_ok = False
    logger.warning("LARK_RECEIVE_ID missing — using MagicMock client (no real pushes)")

_push_service = PushService(
    lark_client=_lark_client,
    db_path=settings.DB_PATH,
    receive_id=settings.LARK_RECEIVE_ID or "oc_mock",
    receive_id_type=settings.LARK_RECEIVE_ID_TYPE,
    rate_limit_per_min=settings.RATE_LIMIT,
    dedup_ttl=settings.DEDUP_TTL,
    undelivered_max=settings.UNDELIVERED_MAX,
    muted=settings.MUTE_FLAG,
)
_push_service.connection_ok = _lark_ok
app.include_router(build_push_router(_push_service))

# ── F2 /anomaly routes + service wiring ───────────────────────────────
_anomaly_state = StateManager()
_rule_store = RuleConfigStore()
app.include_router(build_anomaly_router(state_manager=_anomaly_state, rule_store=_rule_store))


def _quote_for_anomaly(code: str) -> AnomalyQuote | None:
    snaps = _quote_service.get_snapshots([code])
    q = snaps.get(code)
    if q is None or q.status == DataStatus.NO_DATA or q.price is None:
        return None
    return AnomalyQuote(
        code=q.code,
        price=q.price,
        change_pct=q.change_pct or 0.0,
        volume=q.volume or 0,
        volume_ratio=q.volume_ratio or 1.0,
        ts=q.updated_at.timestamp(),
    )


def _kline_for_anomaly(code: str) -> list[float]:
    return _kline_service.recent_closes(code, n=60)


# ── F3 explain (real LLM if creds, else template_mode) ────────────────
_news_source = NewsSource()
_context_assembler = ContextAssembler(news=_news_source)


_llm_service = build_default_service(settings)
if settings.LLM_PRIMARY_API_KEY:
    logger.info("LLM primary client ready (model=%s)", settings.LLM_PRIMARY_MODEL)
else:
    logger.warning("LLM_PRIMARY_API_KEY missing — template_mode enabled")
_explain_service = ExplainService(
    assembler=_context_assembler,
    llm=_llm_service,
    db_path=settings.DB_PATH,
    daily_budget=settings.LLM_DAILY_BUDGET,
    template_mode=settings.llm_template_mode,
)
app.include_router(build_explain_router(lambda: _explain_service))

# ── F2 AnomalyService (constructed after F3 explain ready) ────────────
_anomaly_service = AnomalyService(
    watchlist_service=app.state.svc,
    quote_fetcher=_quote_for_anomaly,
    kline_fetcher=_kline_for_anomaly,
    news_source=_news_source,
    explain_service=_explain_service,
    push_service=_push_service,
    rule_store=_rule_store,
    state_manager=_anomaly_state,
)
app.state.anomaly_service = _anomaly_service

# ── F4 briefing routes + service + scheduler ──────────────────────────
app.include_router(build_briefing_router(db_path=settings.DB_PATH))

_market_source = MarketOverviewSource(
    fetch_global=lambda: [],
    fetch_yesterday=lambda: {},
    fetch_sectors=lambda: [],
)
_calendar_source = CalendarSource(
    fetch_earnings=lambda: [],
    fetch_econ=lambda: [],
)
_briefing_service = BriefingService(
    db_path=settings.DB_PATH,
    push=_push_service,
    llm=_llm_service,
    market_source=_market_source,
    calendar_source=_calendar_source,
    news_source=_news_source,
    watchlist_snapshot=app.state.svc.snapshot,
)
_briefing_scheduler = BriefingScheduler(
    db_path=settings.DB_PATH,
    service=_briefing_service,
    scheduler=None,  # set in lifespan
)
app.state.briefing_scheduler = _briefing_scheduler
