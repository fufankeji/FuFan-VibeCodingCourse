"""T014/T015 — F2 异动 API.

- GET  /anomaly/badges → {code: [badge,...]}  (F1 拉取回填徽章, FR-007)
- GET  /anomaly/rules  → 当前 RuleConfig
- PATCH /anomaly/rules → 部分更新（开关 + 阈值覆盖, FR-008/FR-013）

build_anomaly_router(state_manager, rule_store) — 注入式，避免单例依赖.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.anomaly.anomaly_state import StateManager
from app.anomaly.rule_config import RuleConfigStore
from app.models.anomaly import RuleConfig


def build_anomaly_router(*, state_manager: StateManager, rule_store: RuleConfigStore) -> APIRouter:
    router = APIRouter(prefix="/anomaly", tags=["anomaly"])

    @router.get("/badges")
    def get_badges() -> dict[str, list[str]]:
        return state_manager.state.all_badges()

    @router.get("/rules")
    def get_rules() -> RuleConfig:
        return rule_store.current()

    @router.patch("/rules")
    def patch_rules(patch: dict) -> RuleConfig:
        # ignore unknown keys via model_copy with valid fields only
        valid = {k: v for k, v in patch.items() if k in RuleConfig.model_fields}
        return rule_store.patch(**valid)

    return router


__all__ = ["build_anomaly_router"]
