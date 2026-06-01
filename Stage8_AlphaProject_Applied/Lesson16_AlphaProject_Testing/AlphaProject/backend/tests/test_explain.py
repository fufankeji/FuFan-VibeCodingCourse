"""T014: consolidated explain feature tests + ops-visible real-provider gate.

Most coverage already lives in the per-task files (test_explain_*.py,
test_llm_service.py, test_sensitive_filter.py, test_context_assembler.py,
test_news_source.py, test_api_explain.py). This file does two extra things:

1. End-to-end gold-path: build the full ExplainService from the public
   factory (build_default_service) with template_mode forced on, hit a
   summary request, and confirm the disclaimer + ≤200 char body invariant
   holds in the wiring used by production main.
2. A skipped integration test that calls the real primary LLM iff
   `LLM_PRIMARY_API_KEY` is set in the env — visible to ops but green by
   default. Document missing creds in session.md per project policy.
"""
from __future__ import annotations

import os
from pathlib import Path

import pytest

from app.config import Settings
from app.db import init_db
from app.explain.sensitive_filter import DISCLAIMER
from app.models.explain import (
    AnomalyType,
    ExplainRequest,
)
from app.services.context_assembler import ContextAssembler
from app.services.explain_service import ExplainService
from app.services.llm_service import build_default_service
from app.services.news_source import NewsSource


def test_end_to_end_template_mode(tmp_path: Path, monkeypatch):
    """No keys + budget 5 → template_mode=True → pure rule-based render."""
    monkeypatch.delenv("LLM_PRIMARY_API_KEY", raising=False)
    s = Settings(_env_file=None)
    assert s.llm_template_mode is True

    db = tmp_path / "alpha.db"
    init_db(db)

    news = NewsSource(ttl_s=60)
    # No quote provider → industry/sector None, but news source still ok
    asm = ContextAssembler(news=news, quote=None)

    # Replace news fetch with empty result to keep test offline
    monkeypatch.setattr(news, "fetch_telegraph", lambda: [])
    monkeypatch.setattr(news, "fetch_announcements", lambda code: [])

    llm = build_default_service(s)  # all-None providers under template_mode

    svc = ExplainService(
        assembler=asm,
        llm=llm,
        db_path=db,
        daily_budget=s.LLM_DAILY_BUDGET,
        template_mode=s.llm_template_mode,
    )

    res = svc.explain(
        ExplainRequest(
            code="600519",
            name="贵州茅台",
            anomaly_type=AnomalyType.LIMIT_UP,
            price=1888.0,
            change_pct=10.0,
        )
    )
    assert res.text.endswith(DISCLAIMER)
    body = res.text[: -len(DISCLAIMER)].strip()
    assert len(body.rstrip(".")) <= 200
    assert res.source.value == "template"


@pytest.mark.skipif(
    not os.environ.get("LLM_PRIMARY_API_KEY"),
    reason=(
        "Real-provider smoke test — needs LLM_PRIMARY_API_KEY. "
        "Tracked in specs/004-llm-anomaly-explain/session.md 待凭证 section."
    ),
)
def test_real_primary_llm_smoke(tmp_path: Path):
    """Ops-only: confirms wiring against the real primary LLM works.

    Skipped by default so CI stays green without credentials. To run:
        export LLM_PRIMARY_API_KEY=sk-...
        export LLM_PRIMARY_BASE_URL=https://api.deepseek.com/v1
        export LLM_PRIMARY_MODEL=deepseek-chat
        pytest tests/test_explain.py::test_real_primary_llm_smoke
    """
    s = Settings()
    db = tmp_path / "alpha.db"
    init_db(db)

    news = NewsSource(ttl_s=60)
    asm = ContextAssembler(news=news, quote=None)
    llm = build_default_service(s)

    svc = ExplainService(
        assembler=asm,
        llm=llm,
        db_path=db,
        daily_budget=s.LLM_DAILY_BUDGET,
        template_mode=False,
    )

    res = svc.explain(
        ExplainRequest(
            code="600519",
            name="贵州茅台",
            anomaly_type=AnomalyType.LIMIT_UP,
            price=1888.0,
            change_pct=10.0,
        )
    )
    assert res.text.endswith(DISCLAIMER)
    assert res.source.value in {"llm_primary", "llm_backup", "llm_local"}
