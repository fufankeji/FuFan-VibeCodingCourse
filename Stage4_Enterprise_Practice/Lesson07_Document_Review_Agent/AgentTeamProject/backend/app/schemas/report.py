import json
from datetime import datetime
from typing import Optional, Any

from pydantic import BaseModel, model_validator


class ReviewReportResponse(BaseModel):
    id: str
    session_id: str
    report_status: str
    generated_at: Optional[datetime] = None
    summary: Optional[dict] = None
    item_stats: Optional[dict] = None
    coverage_statement: Optional[dict] = None
    disclaimer: str
    pdf_path: Optional[str] = None
    json_path: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}

    @model_validator(mode="before")
    @classmethod
    def parse_json_fields(cls, data: Any) -> Any:
        if hasattr(data, "__dict__"):
            obj = data.__dict__.copy()
            obj["summary"] = _safe_json_load(getattr(data, "summary_json", "{}"))
            obj["item_stats"] = _safe_json_load(getattr(data, "item_stats_json", "{}"))
            obj["coverage_statement"] = _safe_json_load(getattr(data, "coverage_statement_json", "{}"))
            return obj
        if isinstance(data, dict):
            data = dict(data)
            data["summary"] = _safe_json_load(data.pop("summary_json", "{}"))
            data["item_stats"] = _safe_json_load(data.pop("item_stats_json", "{}"))
            data["coverage_statement"] = _safe_json_load(data.pop("coverage_statement_json", "{}"))
        return data


def _safe_json_load(value: str) -> dict:
    try:
        return json.loads(value or "{}")
    except (json.JSONDecodeError, TypeError):
        return {}
