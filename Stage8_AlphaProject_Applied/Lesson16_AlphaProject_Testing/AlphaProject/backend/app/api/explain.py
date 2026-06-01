"""F3 T013 — REST endpoint.

Single POST /explain consumed by:
  - F1 Dashboard "为什么" button (anomaly_type may be "summary")
  - F2 anomaly detector (sync call with concrete anomaly_type)

Returns ExplainResult JSON. Server-side errors degrade to template inside
ExplainService, so this endpoint should never raise 5xx for normal traffic.
"""
from __future__ import annotations

from collections.abc import Callable

from fastapi import APIRouter, Depends

from app.models.explain import ExplainRequest, ExplainResult
from app.services.explain_service import ExplainService


def build_explain_router(
    get_service: Callable[[], ExplainService],
) -> APIRouter:
    router = APIRouter()

    def _svc() -> ExplainService:
        return get_service()

    @router.post("/explain", response_model=ExplainResult)
    def explain(req: ExplainRequest, svc: ExplainService = Depends(_svc)) -> ExplainResult:
        return svc.explain(req)

    return router
