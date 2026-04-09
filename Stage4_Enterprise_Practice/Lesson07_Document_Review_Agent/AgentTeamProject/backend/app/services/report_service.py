"""
Report Service — generate and persist review reports.
"""

import json
import os
from datetime import datetime
from pathlib import Path

from sqlalchemy.orm import Session

from app.config import settings
from app.core.sse import sse_manager
from app.models.audit_log import AuditLog
from app.models.extracted_field import ExtractedField
from app.models.report import ReviewReport
from app.models.review_item import ReviewItem
from app.models.session import ReviewSession
from app.schemas.report import ReviewReportResponse

_DISCLAIMER = (
    "本报告由 AI 辅助生成，仅供参考，不构成法律意见。"
    "请在专业法律人员指导下使用，最终法律判断以人工审核为准。"
)

_COVERAGE_STATEMENT = {
    "scope": "本次审核基于上传文件的文本内容，采用规则引擎和 AI 推理相结合的方式。",
    "limitations": [
        "扫描件 OCR 可能导致文字识别误差",
        "附件及图片内容未纳入分析范围",
        "特定行业专项法规可能未完全覆盖",
    ],
    "confidence_note": "置信度得分仅反映模型确定性，不代表法律效力评级",
}


def generate_report_sync(session_id: str, db: Session) -> None:
    """Synchronous wrapper for report generation (used from background threads)."""
    import asyncio
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # We're in an async context — schedule as a task
            import concurrent.futures
            future = concurrent.futures.Future()

            async def _run():
                try:
                    result = await generate_report(session_id, db)
                    future.set_result(result)
                except Exception as e:
                    future.set_exception(e)

            asyncio.ensure_future(_run())
            return
        else:
            loop.run_until_complete(generate_report(session_id, db))
    except RuntimeError:
        # No event loop in this thread — create one
        asyncio.run(generate_report(session_id, db))


async def generate_report(session_id: str, db: Session) -> ReviewReportResponse:
    session: ReviewSession | None = db.query(ReviewSession).filter(ReviewSession.id == session_id).first()
    if not session:
        from app.core.errors import APIError
        raise APIError.not_found("ReviewSession")

    # Aggregate data
    items = db.query(ReviewItem).filter(ReviewItem.session_id == session_id).all()
    fields = db.query(ExtractedField).filter(ExtractedField.session_id == session_id).all()

    # Item statistics
    item_stats = _compute_item_stats(items)

    # Build summary
    summary = _build_summary(session, items, fields, item_stats)

    # Create or update report record
    report = db.query(ReviewReport).filter(ReviewReport.session_id == session_id).first()
    now = datetime.utcnow()
    if not report:
        report = ReviewReport(session_id=session_id)
        db.add(report)

    report.report_status = "generating"
    report.summary_json = json.dumps(summary, ensure_ascii=False)
    report.item_stats_json = json.dumps(item_stats, ensure_ascii=False)
    report.coverage_statement_json = json.dumps(_COVERAGE_STATEMENT, ensure_ascii=False)
    report.disclaimer = _DISCLAIMER
    db.commit()
    db.refresh(report)

    # Persist JSON report to storage
    report_dir = Path(settings.storage_path) / "reports" / session_id
    report_dir.mkdir(parents=True, exist_ok=True)
    json_path = str(report_dir / "report.json")

    full_report = {
        "report_id": report.id,
        "session_id": session_id,
        "generated_at": now.isoformat(),
        "summary": summary,
        "item_stats": item_stats,
        "coverage_statement": _COVERAGE_STATEMENT,
        "disclaimer": _DISCLAIMER,
        "items": [_serialize_item(i) for i in items],
        "fields": [_serialize_field(f) for f in fields],
    }
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(full_report, f, ensure_ascii=False, indent=2, default=str)

    # Update report record as ready
    report.report_status = "ready"
    report.generated_at = now
    report.json_path = json_path
    db.add(report)

    # Update session state
    session.state = "report_ready"
    session.completed_at = now
    session.updated_at = now
    db.add(session)

    # Audit log
    audit = AuditLog(
        session_id=session_id,
        event_type="report_generated",
        actor_id="system",
        actor_type="system",
        occurred_at=now,
        metadata_json=json.dumps({"json_path": json_path}),
    )
    db.add(audit)
    db.commit()
    db.refresh(report)

    # SSE push
    await sse_manager.publish(
        session_id,
        "report_ready",
        {"session_id": session_id, "report_id": report.id},
    )

    return ReviewReportResponse.model_validate(report)


def _compute_item_stats(items: list[ReviewItem]) -> dict:
    total = len(items)
    high = sum(1 for i in items if i.risk_level == "HIGH")
    medium = sum(1 for i in items if i.risk_level == "MEDIUM")
    low = sum(1 for i in items if i.risk_level == "LOW")
    confirmed = sum(1 for i in items if i.human_decision == "confirmed")
    rejected = sum(1 for i in items if i.human_decision == "rejected")
    false_positive = sum(1 for i in items if i.is_false_positive)
    pending = sum(1 for i in items if i.human_decision == "pending")

    return {
        "total": total,
        "by_risk": {"HIGH": high, "MEDIUM": medium, "LOW": low},
        "by_decision": {
            "confirmed": confirmed,
            "rejected": rejected,
            "false_positive": false_positive,
            "pending": pending,
        },
    }


def _build_summary(
    session: ReviewSession,
    items: list[ReviewItem],
    fields: list[ExtractedField],
    stats: dict,
) -> dict:
    high_count = stats["by_risk"]["HIGH"]
    medium_count = stats["by_risk"]["MEDIUM"]

    # Non-absolute risk conclusion
    if high_count >= 3:
        risk_conclusion = "合同存在多项高风险条款，建议在签署前进行专业法律审查"
    elif high_count >= 1:
        risk_conclusion = "合同存在高风险条款，建议重点关注并考虑修改"
    elif medium_count >= 3:
        risk_conclusion = "合同存在若干中等风险条款，建议结合实际情况评估"
    else:
        risk_conclusion = "未发现明显高风险条款，建议仍由专业人员进行最终确认"

    return {
        "risk_conclusion": risk_conclusion,
        "total_issues": stats["total"],
        "high_risk_count": high_count,
        "medium_risk_count": medium_count,
        "low_risk_count": stats["by_risk"]["LOW"],
        "field_extraction_count": len(fields),
        "session_state": session.state,
    }


def _serialize_item(item: ReviewItem) -> dict:
    return {
        "id": item.id,
        "clause_text": item.clause_text,
        "risk_level": item.risk_level,
        "risk_category": item.risk_category,
        "ai_finding": item.ai_finding,
        "human_decision": item.human_decision,
        "human_note": item.human_note,
        "is_false_positive": item.is_false_positive,
    }


def _serialize_field(field: ExtractedField) -> dict:
    return {
        "id": field.id,
        "field_name": field.field_name,
        "field_value": field.field_value,
        "confidence_score": field.confidence_score,
        "verification_status": field.verification_status,
    }
