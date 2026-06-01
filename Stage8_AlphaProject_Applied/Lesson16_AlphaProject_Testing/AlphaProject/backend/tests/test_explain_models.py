"""T003: ExplainRequest / ExplainResult / ExplainContext schemas.

[出参验证] 模型校验；异动类型枚举（与 F2 徽章对齐）。
"""
import pytest
from pydantic import ValidationError

from app.models.explain import (
    AnomalyType,
    ExplainContext,
    ExplainRequest,
    ExplainResult,
    ResultSource,
)


def test_anomaly_type_enum_covers_f2_badges():
    # Aligned with F2 anomaly badges + Dashboard summary call.
    values = {a.value for a in AnomalyType}
    assert {"limit_up", "limit_down", "breakout", "breakdown", "volume", "summary"} <= values


def test_explain_request_valid():
    r = ExplainRequest(
        code="600519",
        name="贵州茅台",
        anomaly_type=AnomalyType.LIMIT_UP,
        price=1888.0,
        change_pct=10.0,
        on_demand=True,
    )
    assert r.code == "600519"
    assert r.anomaly_type == AnomalyType.LIMIT_UP


def test_explain_request_rejects_empty_code():
    with pytest.raises(ValidationError):
        ExplainRequest(
            code="",
            name="x",
            anomaly_type=AnomalyType.LIMIT_UP,
            price=1.0,
            change_pct=1.0,
        )


def test_explain_result_defaults():
    res = ExplainResult(text="测试。", source=ResultSource.TEMPLATE)
    assert res.partial is False
    assert res.source == ResultSource.TEMPLATE


def test_explain_context_defaults():
    ctx = ExplainContext()
    assert ctx.sector is None
    assert ctx.industry is None
    assert ctx.news == []
    assert ctx.announcements == []
